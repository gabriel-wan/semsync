import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { openDb, type Db } from '../src/lib/database';

/**
 * A fresh in-memory Postgres (PGlite) on a free local port, reached through openDb like Supabase in production.
 * Call `stop` when done.
 */
export async function testDb(): Promise<{ db: Db; url: string; stop: () => Promise<void> }> {
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, maxConnections: 10 });
  await server.start();
  const url = `postgres://postgres@${server.getServerConn()}/postgres`;
  const db = openDb(url);
  return {
    db,
    url,
    async stop() {
      await db.close();
      await server.stop();
      await pg.close();
    },
  };
}
