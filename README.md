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

**Outlook, Apple Calendar and others:** instead of Google Calendar (or as well), Semsync gives each person a private
subscribe link to an `.ics` file with the same events and reminders. Those apps refresh subscriptions on their own
schedule, every few hours. Notion Calendar shows Google calendars, so it works through the Google option.

**Next semester and next year:** Canvas feeds carry on by themselves. Term dates are worked out with NUSMods' rule
(Week 0 starts on the first Monday of August), public holidays come from the Ministry of Manpower's calendar file for
each year, and two weeks before each new term Semsync puts a reminder in your calendar to paste that term's NUSMods
link, since those are made one semester at a time.

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
- Teaching weeks are worked out in `src/config.ts`; holidays come from MOM (`src/lib/holidays.ts`), with this year's
  built in as a fallback. The only dates added by hand are NUS Well-Being Days, which aren't public holidays.
- An hourly sync downloads the Canvas feed and stops there if nothing changed since the last full sync, which runs at
  least daily. So most syncs never read NUSMods data or call Google.

## Stack

- **[Hono](https://hono.dev) on Vercel** (Singapore). `npm run build` compiles `src/` to `dist/`, and Vercel runs `dist/app.js`.
- **[Supabase](https://supabase.com) Postgres** (Singapore) through postgres.js. Locally and in tests,
  [PGlite](https://pglite.dev) runs Postgres inside Node, so you don't need an account.
- **Hourly sync:** `GET /api/cron`, protected by `CRON_SECRET`. A GitHub Action calls it three times an hour (each
  run takes whoever is due), and Vercel Cron calls it once a day as a backup.
- **Subscribe links:** `GET /feed/<secret>.ics`, served from a gzipped copy each sync writes.

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
