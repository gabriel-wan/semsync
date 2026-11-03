// Local development server: `npm run dev`. On Vercel, `npm run build` compiles the app to dist/app.js and public/ is served by the CDN.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import app from './app.js';

const server = new Hono();
server.use('/*', serveStatic({ root: './public' }));
server.all('*', (c) => app.fetch(c.req.raw));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: server.fetch, port }, () => console.log(`Semsync running at http://localhost:${port}`));
