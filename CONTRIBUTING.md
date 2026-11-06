# Contributing to Semsync

Thanks for helping. Bug reports, ideas and code are all welcome.

## Reporting a bug or asking for something

[Open an issue](https://github.com/gabriel-wan/semsync/issues) and say what you did, what you expected and what
happened instead. A screenshot helps.

**Never paste your Canvas feed link or a Semsync subscribe link** into an issue: anyone with either can read your
calendar. If you shared a subscribe link by mistake, replace it in Semsync's Settings.

## Running it locally

You need Node 24 and nothing else: the database runs inside Node ([PGlite](https://pglite.dev)), and Google can be
faked.

```bash
npm install
cp .env.example .env.local   # then fill in SESSION_SECRET, ENCRYPTION_KEY and CRON_SECRET
npm run dev                  # http://localhost:8787
```

Make each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

With `DEV_LOGIN=1` and `FAKE_GOOGLE=1` in `.env.local` (the example file has them on):

- sign in as any email address,
- type `sample` as the Canvas link to use a built-in sample feed,
- see what Semsync wrote to the "calendar" at `/dev/calendar`,
- and see every design token and component state at `/foundations`.

`npm run dev` restarts when files change. If a change doesn't show up, stop it and start it again.

## Checks

```bash
npm test            # every test, including a real Postgres in memory
npm run typecheck
```

Both must pass before a change goes in. The tests also check the design and the words:

- `test/design.test.ts` checks colour contrast in light and dark mode, that every colour comes from
  `src/views/tokens.ts`, and that the browser script (`public/app.js`) still parses.
- `test/copy.test.ts` renders every page and fails on things like hyphenated words, filler words, or more than one
  call to action at the top of the landing page.

## How it's put together

| Where | What |
| --- | --- |
| `src/app.tsx` | Every route: pages, sign in, setup, sync, the subscribe link, the scheduled run |
| `src/views/` | The pages (`pages.tsx`, server rendered with Hono JSX), design tokens (`tokens.ts`), icons |
| `public/site.css`, `public/app.js` | The styles and the browser script, served as they are |
| `src/lib/sync.ts` | The sync: what should be in the calendar, what changed, and sending only that to Google |
| `src/lib/canvas.ts`, `nusmods.ts` | Reading the Canvas feed and NUSMods timetables |
| `src/config.ts`, `src/lib/holidays.ts` | NUS term dates (worked out, never typed in) and public holidays |
| `src/lib/feed.ts` | The `.ics` file behind subscribe links for Outlook and Apple Calendar |
| `src/lib/db.ts`, `migrations/` | Database queries and the schema |

How a sync works:

- Canvas and NUSMods give the events someone should have. Semsync compares them with what it wrote last time and
  sends only the differences to Google Calendar, in batches.
- Event ids come from each source item, so syncing again updates events instead of duplicating them.
- If Canvas or NUSMods can't be read, the sync stops before changing anything.
- If nothing changed since the last full sync, an hourly sync stops right after downloading the Canvas feed.

## Making a change

1. Fork the repo and branch from `main`.
2. Keep the change focused, and add or update tests for it.
3. Changing the database? Add a new numbered file in `migrations/`. Never edit one that's already been applied.
4. Write on screen copy in plain words, the way the rest of the site does: short sentences, no jargon.
5. Run `npm test` and `npm run typecheck`, then open a pull request that says what changed and why.

Changed the headline or colours? Regenerate the link preview image with the dev server running:

```bash
msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 --screenshot=public/og.png http://localhost:8787/og
```

## Running your own copy

[docs/deploying.md](docs/deploying.md) covers Google Cloud, Vercel, Supabase and the hourly sync, all on free plans.

## License

By contributing, you agree that your contributions are licensed under the [MIT license](LICENSE).
