// Vercel's zero-config entry point: it looks for a Hono app exported from src/index.ts.
// The app itself lives in app.tsx so it can use JSX.
import 'hono';

export { default } from './app.js';
