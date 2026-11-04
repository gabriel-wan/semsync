import postgres from 'postgres';
import { within } from './http.js';

// Postgres has no time limit of its own here, so a query stuck on a dead connection would wait until the platform kills
// the request. These end it with an error that says which query, and ask Postgres to cancel it.
const QUERY_MS = 20_000;
const TRANSACTION_MS = 30_000;
const short = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 70);

/**
 * The small, D1-style database API the app uses, backed by Postgres through postgres.js: Supabase in production, and
 * PGlite (Postgres in this process) served on a local port in development and tests, so every query takes the same path.
 * Queries are written with `?` placeholders, which become Postgres's `$1, $2, …`.
 */
export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ changes: number }>;
}

export interface Db {
  prepare(sql: string): Statement;
  /** Runs the statements in one transaction. */
  batch(statements: Statement[]): Promise<void>;
  /** Runs a script of several statements in one transaction (used by migrations). */
  exec(sql: string): Promise<void>;
  /** Closes the connections, so a script can exit. */
  close(): Promise<void>;
}

type Sql = postgres.Sql<{ int8: number }>;
type Params = postgres.ParameterOrJSON<number>[];

/** Turns `?` placeholders into `$1, $2, …`, leaving any `?` inside a quoted string alone. */
export function numberPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/'(?:[^']|'')*'|\?/g, (match) => (match === '?' ? `$${++n}` : match));
}

/**
 * The connections in use, with a way to start over. A query that timed out may have left its connection waiting for an
 * answer that never comes, and every later query on it would wait too, so after a timeout the old connections are
 * dropped and fresh ones opened.
 */
type Pool = { current: () => Sql; reset: (stale: Sql) => void };

class PgStatement implements Statement {
  readonly text: string;

  constructor(
    private pool: Pool,
    text: string,
    readonly args: unknown[] = [],
  ) {
    this.text = numberPlaceholders(text);
  }

  bind(...args: unknown[]): Statement {
    // this.text has no `?` left, so numbering it again changes nothing.
    return new PgStatement(this.pool, this.text, args.map((a) => (a === undefined ? null : a)));
  }

  async first<T>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = await this.execute();
    return { results: [...rows] as T[] };
  }

  async run(): Promise<{ changes: number }> {
    const rows = await this.execute();
    return { changes: rows.count };
  }

  private execute() {
    const sql = this.pool.current();
    const query = sql.unsafe(this.text, this.args as Params);
    return within(QUERY_MS, `The database (${short(this.text)})`, query, () => {
      void query.cancel();
      this.pool.reset(sql);
    });
  }
}

/** Postgres's 64-bit integers (our millisecond timestamps, and COUNT(*)) as plain numbers, which hold them exactly. */
const int8AsNumber: postgres.PostgresType<number> = {
  to: 20,
  from: [20],
  serialize: (value) => String(value),
  parse: (raw: string) => Number(raw),
};

export function openDb(url: string): Db {
  const parsed = new URL(url);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  const sslmode = parsed.searchParams.get('sslmode') ?? (local ? 'disable' : 'require');
  // postgres.js would send any other URL parameter (Supabase adds `supa=…`) to the server as a setting.
  parsed.search = '';

  const connect = (): Sql => postgres(parsed.href, {
    ssl: sslmode === 'disable' ? false : (sslmode as 'require'),
    // Supabase's pooler runs in transaction mode, which can't keep named prepared statements.
    prepare: false,
    // Locally the database is PGlite, which serves every connection from one session, so two connections running at once
    // can replace each other's unnamed statement. One connection keeps queries in order there.
    max: local ? 1 : 5,
    // When all connections are busy, postgres.js sends further queries down a busy connection without waiting
    // (pipelining). Supabase's pooler in transaction mode can lose those, and the query never answers: a sync looking up
    // six NUSMods modules at once over five connections stalled every time. So each connection runs one query at a time.
    max_pipeline: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: false,
    types: { int8: int8AsNumber },
    onnotice: () => {},
  });

  let sql = connect();
  const pool: Pool = {
    current: () => sql,
    reset(stale) {
      if (stale !== sql) return; // already replaced by another query that timed out
      sql = connect();
      console.warn('database connections reset after a query timed out');
      void stale.end({ timeout: 0 }).catch(() => {});
    },
  };

  return {
    prepare: (text) => new PgStatement(pool, text),
    async batch(statements) {
      if (statements.length === 0) return;
      const s = pool.current();
      await within(TRANSACTION_MS, `The database (${statements.length} writes)`, s.begin(async (tx) => {
        for (const st of statements as PgStatement[]) await tx.unsafe(st.text, st.args as Params);
      }), () => pool.reset(s));
    },
    async exec(script) {
      await pool.current().begin((tx) => tx.unsafe(script).simple());
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
