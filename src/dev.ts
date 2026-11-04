// Local development server: `npm run dev`. On Vercel, `npm run build` compiles the app to dist/app.js and public/ is served by the CDN.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import app from './app.js';
import { LOCAL_DATABASE_URL } from './env.js';
import { openDb } from './lib/database.js';
import { migrate } from './lib/migrate.js';

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  // No database set: run Postgres in this process (PGlite, saved in local-pg/) and serve it on the port the app and
  // `npm run sql` use by default, so they reach it the same way the deployed app reaches Supabase.
  const pg = await PGlite.create('./local-pg');
  await new PGLiteSocketServer({ db: pg, port: Number(new URL(LOCAL_DATABASE_URL).port), maxConnections: 10 }).start();
  const db = openDb(LOCAL_DATABASE_URL);
  for (const name of await migrate(db)) console.log(`Applied ${name}`);
  await db.close();
}

const server = new Hono();
server.use('/*', serveStatic({ root: './public' }));
server.all('*', (c) => app.fetch(c.req.raw));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: server.fetch, port }, () => console.log(`Semsync running at http://localhost:${port}`));
