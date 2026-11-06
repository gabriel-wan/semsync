# Semsync

Canvas deadlines, NUSMods classes and exams in your Google Calendar, kept up to date every hour.
Free for NUS students at **[getsemsync.vercel.app](https://getsemsync.vercel.app)**.

https://github.com/user-attachments/assets/32ada096-2538-4f55-8997-1c42293b7316

## What it does

Sign in with Google and paste your Canvas calendar feed and, if you like, your NUSMods share link. Semsync makes an
"NUS semester" calendar in your Google account, with reminders 1 day and 3 hours before deadlines and 1 week and 1 day
before exams, and a colour per module (exams stay red). It asks for `calendar.app.created`, which only covers calendars
it makes itself; Google classes it as non-sensitive, so there's no unverified app screen.

In Settings you can switch off any course, and turn off the "Week 7" labels Semsync puts on each Monday.

Early versions also offered a calendar that Semsync kept in its own Google account and shared with you. That option is
gone because it couldn't have reminders or colours. Anyone still on one keeps syncing, and their page offers a one-step
move to their own calendar.

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
