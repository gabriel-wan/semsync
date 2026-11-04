import postgres from 'postgres';

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

class PgStatement implements Statement {
  readonly text: string;

  constructor(
    private sql: Sql,
    text: string,
    readonly args: unknown[] = [],
  ) {
    this.text = numberPlaceholders(text);
  }

  bind(...args: unknown[]): Statement {
    // this.text has no `?` left, so numbering it again changes nothing.
    return new PgStatement(this.sql, this.text, args.map((a) => (a === undefined ? null : a)));
  }

  async first<T>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = await this.sql.unsafe(this.text, this.args as Params);
    return { results: [...rows] as T[] };
  }

  async run(): Promise<{ changes: number }> {
    const rows = await this.sql.unsafe(this.text, this.args as Params);
    return { changes: rows.count };
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

  const sql: Sql = postgres(parsed.href, {
    ssl: sslmode === 'disable' ? false : (sslmode as 'require'),
    // Supabase's pooler runs in transaction mode, which can't keep named prepared statements.
    prepare: false,
    // Locally the database is PGlite, which serves every connection from one session, so two connections running at once
    // can replace each other's unnamed statement. One connection keeps queries in order there.
    max: local ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: false,
    types: { int8: int8AsNumber },
    onnotice: () => {},
  });

  return {
    prepare: (text) => new PgStatement(sql, text),
    async batch(statements) {
      if (statements.length === 0) return;
      await sql.begin(async (tx) => {
        for (const s of statements as PgStatement[]) await tx.unsafe(s.text, s.args as Params);
      });
    },
    async exec(script) {
      await sql.begin((tx) => tx.unsafe(script).simple());
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
