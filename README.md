# Semsync

Canvas deadlines, NUSMods classes and exams in your Google Calendar, kept up to date every hour.
Free for NUS students at **[getsemsync.vercel.app](https://getsemsync.vercel.app)**.

[![Semsync in 20 seconds (click to watch)](docs/media/semsync-launch.jpg)](docs/media/semsync-launch.mp4)

## What it does

Sign in with Google, paste your Canvas calendar feed and, if you like, your NUSMods share link, then pick where events go:

- **Your own Google Calendar** (the default), with reminders 1 day and 3 hours before deadlines and 1 week and 1 day
  before exams. Calendar access (`calendar.events.owned`) is asked for separately; sign-in only asks for your name and email.
- **A separate "NUS semester" calendar** that Semsync shares with you. It needs no calendar permission.

Every event Semsync adds is tagged, and it only ever changes or removes its own. Deleting your data removes all of them
and revokes its access.

## How it works

The Canvas feed and the NUSMods API give the events you should have. Semsync compares them with what it wrote last time
and sends only the differences to Google Calendar's batch API.

- Event ids come from each source item, so a re-sync updates events instead of duplicating them.
- If Canvas or NUSMods can't be read, the sync stops before changing anything.
- Teaching weeks (recess week, public holidays) come from the NUS Registrar calendar in `src/config.ts`. Add each new
  academic year there.

## Stack

- **[Hono](https://hono.dev) on Vercel** (Singapore). `npm run build` compiles `src/` to `dist/`, and Vercel runs `dist/app.js`.
- **[Supabase](https://supabase.com) Postgres** (Singapore) through postgres.js. Locally and in tests,
  [PGlite](https://pglite.dev) runs Postgres inside Node, so you don't need an account.
- **Hourly sync:** `GET /api/cron`, protected by `CRON_SECRET`. A GitHub Action calls it every hour, and Vercel Cron
  calls it once a day as a backup.

## Local development

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill SESSION_SECRET, ENCRYPTION_KEY and CRON_SECRET
npm run dev                  # http://localhost:8787
npm test
```

With `DEV_LOGIN=1` and `FAKE_GOOGLE=1` you can sign in as any email, type `sample` as the Canvas link, and see what
Semsync wrote at `/dev/calendar`.

## More

- **[Deploying](docs/deploying.md):** Google Cloud, Vercel, Supabase, the hourly sync, Google's review, and the limits.
- **[Design system](docs/design.md):** tokens, palette, the `/foundations` page, and the tests that enforce them.
- **[Landing page brief](docs/landing-page-brief.md):** the strategy behind the landing page.
