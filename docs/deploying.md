# Deploying

The live copy runs at https://getsemsync.vercel.app. These are the steps to set up your own.

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

## 3. Turn on the hourly sync

On GitHub, open the repo's **Settings → Secrets and variables → Actions** and add two repository secrets:

- `SEMSYNC_URL`: `https://<your-project>.vercel.app`
- `CRON_SECRET`: the same value as in Vercel

Then **Actions → Hourly sync → Run workflow** once to check it works. After that it runs three times an hour on its
own, and each run syncs whoever hasn't been synced for 55 minutes, so everyone is synced about hourly.
(Vercel also calls the same endpoint once a day, as a backup.)

If a run fails for most people for a reason on Semsync's side, the endpoint answers 500, the Action fails, and GitHub
emails you. Each run's tally (synced, unchanged, needing the user, failed, and the errors grouped) is in the Action's
log, which GitHub keeps for 90 days; Vercel's own logs only last an hour on Hobby.

## 4. Publish the app (no Google review needed)

Semsync asks only for `openid`, `email`, `profile` and `calendar.app.created`, and Google classes all four as
non-sensitive. So once the app is published (**Audience → Publish app**), anyone can sign in, with no "Google hasn't
verified this app" screen and no 100-user cap, and there's nothing to submit for review.

Two things would bring the review back: adding a sensitive scope (like `calendar.events.owned`, which Semsync used
before it made its own calendar), or uploading an app logo in **Branding**, which needs a lighter brand check.

## Ready for 1,000 users

What it costs per hour at 1,000 people, and why it fits the free plans:

- **Most syncs stop early.** A sync downloads the Canvas feed and compares it, with the NUSMods link and settings,
  to what the last full sync was built from. If nothing changed, it stops: no NUSMods data, no reading past events, no
  Google calls. A full sync still runs at least once a day, for NUSMods changes and new weeks.
- **Several at once.** A run works on 8 people at a time (`SYNC_CONCURRENCY`), mostly waiting on Canvas, so about
  1,000 people take a couple of minutes, well inside the 4-minute budget. Runs come three times an hour, so each one
  only has about a third of everyone.
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
  4 minutes, and anyone left over is first in line on the next run. Cron jobs can only run daily on Hobby, which is
  why the regular runs come from GitHub Actions (free; GitHub may start them a few minutes late).
- **GitHub Actions** minutes are free for public repos. GitHub pauses scheduled workflows in public repos after
  60 days without activity; push a commit to wake it up. A private repo gets 2,000 free minutes a month, enough for
  hourly runs but not three an hour: change the schedule in `.github/workflows/hourly-sync.yml` to once an hour.
- **Supabase's free plan** (500 MB database) is plenty for a student project. It pauses a project after a week with no
  activity at all; the hourly sync queries the database every hour, so that doesn't happen while the sync is running.
  Every table has row-level security on with no policies, so Supabase's public web API can't read them.
- **Shared calendars** count against Google's per-account limits: about 60 new calendars and 750 shares in a short
  period, and 100,000 events. Main-calendar users don't, since events go into their own calendar.
