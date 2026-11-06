# Deploying

The live copy runs at https://semsync.live. These are the steps to set up your own.

## 1. Google Cloud (one project, free)

1. Create a project at console.cloud.google.com.
2. **APIs & Services → Library:** enable **Google Calendar API**.
3. **Service account:** not needed for a new deployment. It only served the old shared-calendar option; keep
   `GOOGLE_SERVICE_ACCOUNT_JSON` set if any of your users are still on a shared calendar.
4. **Consent screen:** Google Auth Platform → Branding/Audience → External. App name "Semsync", your support email,
   homepage and privacy page on your domain. Don't upload a logo yet (it adds a brand review).
   Under **Data access**, add `openid`, `email`, `profile` and `https://www.googleapis.com/auth/calendar.app.created`
   (non-sensitive: it only covers calendars the app makes).
   Under **Audience**, set publishing status to **In production**. In "Testing" mode, refresh tokens expire after
   7 days and everyone would have to reconnect every week.
5. **Clients → Create client → Web application.** One authorised redirect URI per host:
   `http://localhost:8787/auth/callback` and `https://<your-project>.vercel.app/auth/callback` (plus your own domain later).
   This gives `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.

Until you have a domain, keep the app in **Testing** and add yourself and up to 100 friends under **Audience → Test
users**. Testing mode makes calendar access expire after 7 days; Semsync then shows "Connect Google Calendar" and one click
renews it.

Test with real Google locally first: put the values in `.env.local`, remove `DEV_LOGIN` and `FAKE_GOOGLE`, restart
`npm run dev`, and set up your own calendar.

## 2. Vercel and Supabase (free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub (the free Hobby plan is for personal, non-commercial projects).
2. **Add New → Project →** import `gabriel-wan/semsync`. Vercel detects Hono; leave the build settings as they are.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | a random string (see below) |
   | `ENCRYPTION_KEY` | a random string; never change it after launch |
   | `CRON_SECRET` | a random string |
   | `GOOGLE_OAUTH_CLIENT_ID` | from Google Cloud |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | from Google Cloud |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | optional, only for users still on the old shared calendar |

4. **Deploy.** Until the database is connected in the next step, the public pages work but signing in shows an error page.
5. **Storage → Create Database → Supabase** (Marketplace). Pick the **Singapore** region and the free plan, and connect
   it to the project. This adds `POSTGRES_URL` (the pooled connection Semsync uses) and Supabase's other settings.
6. **Deployments → Redeploy.** Production builds run `npm run build`, which applies the database migrations.
7. Your app is at `https://<your-project>.vercel.app`. Add its `/auth/callback` to the Google client (step 1, item 5).

Generate the secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Never change `ENCRYPTION_KEY` after launch: stored Canvas links and Google tokens can't be decrypted without it.

## 3. The hourly sync

**One clock: the database.** On Supabase, every production deploy sets up Postgres's own scheduler (`pg_cron`) to call
`/api/cron` at :02, :22 and :42 past each hour, with `CRON_SECRET` kept encrypted in Supabase Vault. Each call syncs
whoever hasn't been synced for 55 minutes, so everyone is synced about hourly. There's nothing to do by hand: the
build log says `Scheduled sync: scheduled semsync-sync …`. It needs `CRON_SECRET` set in Vercel and the site's
address (the production domain, or `APP_URL`).

To see it working, run this in Supabase's **SQL Editor**:

```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, left(content::text, 300) from net._http_response order by created desc limit 5;
```

To switch it off: `select cron.unschedule('semsync-sync');` (the next deploy sets it up again).

Each call answers with a tally (synced, unchanged, needing the user, failed, and the errors grouped), which the second
query above shows. A run where most syncs fail on Semsync's side answers 500. Vercel also calls the endpoint once a
day (`vercel.json`), as a safety net if the database's scheduler ever stops.

**Running it by hand.** The **Sync now** workflow on GitHub (Actions → Sync now → Run workflow) calls the same
endpoint once, which is handy to check things work. It needs two repository secrets under **Settings → Secrets and
variables → Actions**: `SEMSYNC_URL` (`https://<your domain>`) and `CRON_SECRET` (the same value as in Vercel).

Don't add another scheduler (GitHub's schedule, cron-job.org) on top: it's harmless, since each run skips anyone synced
in the last 55 minutes, but it makes it hard to tell what's running.

## 4. Publish the app (no Google review needed)

Semsync asks only for `openid`, `email`, `profile` and `calendar.app.created`, and Google classes all four as
non-sensitive. So once the app is published (**Audience → Publish app**), anyone can sign in, with no "Google hasn't
verified this app" screen and no 100-user cap, and there's nothing to submit for review.

Two things would bring the review back: adding a sensitive scope (like `calendar.events.owned`, which Semsync used
before it made its own calendar), or uploading an app logo in **Branding**, which needs a lighter brand check.

## 5. Your own domain (optional)

1. **Vercel → your project → Settings → Domains → Add** your domain (for example `semsync.live`). Vercel shows the DNS
   records it needs.
2. Add those records where you bought the domain (on name.com: **My Domains → your domain → Manage DNS Records**).
   It usually works within minutes, and at most a day.
3. **Google Cloud → Google Auth Platform:** under **Clients**, add `https://<your domain>/auth/callback` to the
   authorized redirect URIs; under **Branding**, add the domain to the authorized domains and update the homepage,
   privacy and terms links.
4. **GitHub → Settings → Secrets and variables → Actions:** set `SEMSYNC_URL` to `https://<your domain>`.

Keep the old `.vercel.app` address working (Vercel does by default): subscribe links people already added and existing
sign ins use it. Links Semsync puts in calendars use the production domain on their own, or whatever `APP_URL` says.

A brand new domain can take a while to show up on some networks: a school's own DNS may remember "this domain doesn't
exist" for an hour, and some block domains for their first few weeks. Once yours loads on the networks your users are
on (for NUS, campus Wi-Fi), set `MOVE_OLD_ADDRESS=1` in Vercel and redeploy. Visitors to the old address are then sent
to the new one, except the scheduled sync and subscribe links, which keep working where they are.

## Ready for 1,000 users

What it costs per hour at 1,000 people, and why it fits the free plans:

- **Most syncs stop early.** A sync downloads the Canvas feed and compares it, with the NUSMods link and settings,
  to what the last full sync was built from. If nothing changed, it stops: no NUSMods data, no reading past events, no
  Google calls. A full sync still runs at least once a day, for NUSMods changes and new weeks.
- **Several at once.** A run works on 8 people at a time (`SYNC_CONCURRENCY`), mostly waiting on Canvas, so about
  1,000 people take a couple of minutes, well inside the 4-minute budget. Runs come three times an hour, so each one
  only has about a third of everyone, and the database's scheduler waits up to 5 minutes for each to finish.
- **No double syncs.** A run claims the people it takes, so a late run and the next one never sync the same person.
- **Database transfer.** Supabase's free plan includes 5 GB of transfer a month. A sync that stops early reads one
  row. NUSMods module data, the biggest read, is read once per run per module rather than once per student.
- **Google Calendar API.** Only changes are sent, batched 50 to a request, far below the default 1,000,000 a day.
- **Subscribe links** are stored gzipped (about a tenth of the size) and answer "not modified" when the app already
  has the latest, so the apps that poll them every few hours cost little.

Before a big launch, check that the Google app is **published** (Audience → Publish app). In Testing, only listed
test users can sign in, and their access expires after 7 days.

## Limits to know

- **Vercel Hobby** runs each request for up to 300 seconds. The sync endpoint stops picking up new users after
  4 minutes, and anyone left over is first in line on the next run. Vercel's own cron jobs can only run daily on
  Hobby, which is why the regular runs come from the database's scheduler.
- **Supabase's free plan** (500 MB database) is plenty for a student project. It pauses a project after a week with no
  activity at all; the scheduled sync uses the database every 20 minutes, so that doesn't happen while it's running.
  Every table has row-level security on with no policies, so Supabase's public web API can't read them.
- **Shared calendars** count against Google's per-account limits: about 60 new calendars and 750 shares in a short
  period, and 100,000 events. Main-calendar users don't, since events go into their own calendar.
