# AGENTS.md

Guidance for AI agents working on this codebase.

## Project Overview

Semsync puts NUS students' Canvas deadlines, NUSMods classes and exams into their calendar and keeps them up to date
every hour. It's a server rendered TypeScript web app on Vercel, live at [semsync.live](https://semsync.live). People
sign in with Google, paste two links, and Semsync syncs an "NUS semester" calendar in their Google account, or serves
it as a subscribe link for Outlook and Apple Calendar.

The people using it are students, not developers. Everything on screen should make sense to them.

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/app.tsx` | Every route: pages, Google sign in, setup, settings, sync, subscribe links (`/feed/…`), the scheduled run (`/api/cron`) |
| `src/views/pages.tsx` | All pages, as Hono JSX rendered on the server |
| `src/views/styles.ts` | What each page carries inline: the tokens as CSS variables, spacing helpers, and the theme script that runs before the page draws |
| `public/site.css` | Every style rule, using only the token variables |
| `public/app.js` | The browser script, loaded with `defer` on every page |
| `src/views/tokens.ts` | Design tokens: spacing, radii, colours for light and dark mode, text styles |
| `src/views/icons.tsx` | Icons (Phosphor), the Semsync mark, and the Canvas, NUSMods, GitHub and Google marks |
| `src/lib/sync.ts` | The sync: build the events someone should have, compare with what was written, send only the changes |
| `src/lib/canvas.ts`, `nusmods.ts` | Reading a Canvas feed and NUSMods timetables |
| `src/lib/feed.ts` | Writing the `.ics` behind subscribe links |
| `src/lib/holidays.ts` | Public holidays from MOM's calendar files, with built-in fallbacks |
| `src/config.ts` | NUS term dates (worked out with NUSMods' rule, never typed in), week names |
| `src/lib/db.ts`, `database.ts` | Queries, and the Postgres adapter (postgres.js on Supabase, PGlite locally) |
| `src/lib/calendar/` | Google Calendar client, OAuth tokens, a fake calendar for development, the no-op backend for subscribe-link-only users |
| `migrations/` | Numbered SQL migrations, applied once each |
| `test/` | Vitest tests, including a real in-memory Postgres |
| `docs/deploying.md` | Running your own copy: Google Cloud, Vercel, Supabase, the hourly sync, a custom domain |

## Commands

```bash
npm install
npm run dev          # http://localhost:8787, with an in-process Postgres
npm test             # every test
npm run typecheck    # TypeScript, no output files
npm run build        # compile to dist/ (production builds also apply migrations)
```

Copy `.env.example` to `.env.local` first. With `DEV_LOGIN=1` and `FAKE_GOOGLE=1` you can sign in as any email, use
`sample` as the Canvas link, and see what was written at `/dev/calendar`; `/foundations` shows every design token.
`npm run dev` doesn't always pick up a change: restart it before checking one in the browser.

## Before You Finish

- `npm test` and `npm run typecheck` both pass.
- New behaviour has a test. Tests that depend on today's date pass a fixed date.
- A change people can see is checked in a browser, on a phone width (390px) and a desktop width, in light and dark
  mode, with nothing sticking out past the screen edge.

## Conventions

**Code**

- TypeScript ES modules: imports inside `src` end in `.js`.
- Pages are Hono JSX on the server. There's no client framework: the little browser behaviour there is lives in
  `public/app.js`, plain JavaScript that runs in every modern browser without a build step. Every page must still work
  without it. A test checks it parses.
- Styles live in `public/site.css`. `public/` is served as is (by the CDN on Vercel, by `npm run dev` locally), so
  nothing there is compiled; keep both files readable rather than minified.
- Comments say why, in full sentences. Keep the existing style.

**Words on screen**

- Plain, short sentences a student would use. No jargon, no marketing filler.
- The copy tests fail on hyphenated words, filler such as "effortless" or "supercharge", a period in the hero heading,
  more than one call to action at the top of the landing page, and pages without Privacy and Terms links.
- Dates and times are Singapore time.

**Design**

- Every colour, spacing and radius comes from `tokens.ts`. Never hard-code a colour in a page; the tests check
  contrast in both modes and that every `var(--…)` exists.
- Phones first: layouts must work at 390px.

**Database**

- Change the schema with a new numbered file in `migrations/`. Never edit one that's been applied.
- Queries use `?` placeholders. Every table keeps row-level security on with no policies.

**Security and privacy**

- Canvas links, Google tokens and subscribe secrets are like passwords: store them encrypted, never log them, never
  put them in a URL other than the subscribe link itself.
- Every POST checks the CSRF token. Canvas links must stay on `ALLOWED_CANVAS_HOSTS`.
- Semsync only changes events it made, in calendars it made. Keep it that way.
- See [SECURITY.md](SECURITY.md).

**The sync**

- If Canvas or NUSMods can't be read, throw before changing anything, so nothing is deleted by mistake.
- When the same inputs should now give different events (a new rule, title or kind), bump `SYNC_VERSION` in
  `src/lib/sync.ts` so everyone gets a full sync once.
- Event ids come from each source item's key. Changing a key duplicates events, so don't.

## Deploying

- Vercel's live site deploys from **`main`**. Pushes to other branches (including `vercel`) only make preview
  deployments. Production builds apply new migrations before going live.
- The scheduled sync is run by Supabase's own scheduler (`pg_cron`), which every production build sets up again
  (`src/lib/scheduler.ts`, called from `scripts/migrate.ts`). GitHub's workflow (`.github/workflows/hourly-sync.yml`,
  run from `main`) is a backup.
- `MOVE_OLD_ADDRESS=1` on Vercel sends visitors from the old `.vercel.app` address to `semsync.live`. Leave it off
  until the domain resolves on NUS networks.
- Commit or push only when asked. This repo keeps `main` and `vercel` level: `git push origin vercel` then
  `git push origin vercel:main`.

## Don't

- Commit `.env*` files, secrets, or anything from `local-pg/`, `dist/` or `brag-output*/`.
- Change `ENCRYPTION_KEY` handling in a way that would stop stored links from decrypting.
- Ask for a broader Google permission than `calendar.app.created`: a sensitive scope brings back Google's
  "unverified app" screen.
- Add a dependency for something a few lines of code can do.
