import { createClient, type Client, type InValue } from '@libsql/client';

/**
 * The small, D1-style database API the app uses. It's backed by libSQL: a local SQLite file in development
 * (`file:local.db`) and Turso in production, so every query is the same SQLite SQL in both.
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
  /** Runs a script of several statements (used by migrations). */
  exec(sql: string): Promise<void>;
}

class LibsqlStatement implements Statement {
  constructor(
    private client: Client,
    readonly sql: string,
    readonly args: InValue[] = [],
  ) {}

  bind(...args: unknown[]): Statement {
    return new LibsqlStatement(this.client, this.sql, args.map((a) => (a === undefined ? null : (a as InValue))));
  }

  async first<T>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: rs.rows.map((row) => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])) as T) };
  }

  async run(): Promise<{ changes: number }> {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { changes: rs.rowsAffected };
  }
}

export function libsqlDb(client: Client): Db {
  return {
    prepare: (sql) => new LibsqlStatement(client, sql),
    async batch(statements) {
      if (statements.length === 0) return;
      await client.batch(
        statements.map((s) => {
          const st = s as LibsqlStatement;
          return { sql: st.sql, args: st.args };
        }),
        'write',
      );
    },
    exec: (sql) => client.executeMultiple(sql),
  };
}

export function openDb(url: string, authToken?: string): Db {
  return libsqlDb(createClient({ url, authToken }));
}
