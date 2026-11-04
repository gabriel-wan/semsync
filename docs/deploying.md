# Deploying

The live copy runs at https://getsemsync.vercel.app. These are the steps to set up your own.

## 1. Google Cloud (one project, free)

1. Create a project at console.cloud.google.com.
2. **APIs & Services → Library:** enable **Google Calendar API**.
3. **Service account** (only needed for the shared-calendar option): IAM & Admin → Service accounts → Create. No roles
   needed. Open it → Keys → Add key → JSON. Keep this file secret; it's `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. **Consent screen:** Google Auth Platform → Branding/Audience → External. App name "Semsync", your support email,
   homepage and privacy page on your domain. Don't upload a logo yet (it adds a brand review).
   Under **Data access**, add `openid`, `email`, `profile` and `https://www.googleapis.com/auth/calendar.events.owned`.
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
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | optional, the whole JSON on one line (shared-calendar option) |

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

Then **Actions → Hourly sync → Run workflow** once to check it works. After that it runs every hour on its own.
(Vercel also calls the same endpoint once a day, as a backup.)

## 4. Google's review (to lift the 100-user cap)

`calendar.events.owned` is a **sensitive** scope. Until Google verifies the app:

- People who connect their calendar see "Google hasn't verified this app" and choose Advanced → Go to Semsync
  (the setup page tells them).
- At most **100 people** can grant calendar access. The shared-calendar option has no cap, so point extra users there.

Verification is free, needs no security audit (that's only for restricted scopes like Gmail), and Google says it can take
up to about 10 days. You need:

1. A domain you own, verified in Google Search Console, serving the homepage. Add it in Vercel under
   **Settings → Domains**, then use it for the Branding links and redirect URI.
2. The privacy page on that same domain (it's at `/privacy`). It has no contact line yet: if Google asks for one, add a
   Contact section to `Privacy` in `src/views/pages.tsx` with an address you're happy to publish.
3. An unlisted YouTube video showing: the consent screen with the app name, your OAuth client ID in the browser's address
   bar, and events appearing in Google Calendar after connecting.
4. A justification for the scope, for example: "Semsync adds a student's Canvas deadlines, class timetable and exam dates
   to their primary Google Calendar and keeps them updated hourly. It only creates, updates and deletes events it created
   (tagged with a private extended property). `calendar.events.owned` is the narrowest scope that can write to the user's
   primary calendar; `calendar.app.created` only covers secondary calendars the app creates."

Then submit from Google Auth Platform → Verification centre.

## Limits to know

- **Vercel Hobby** runs each request for up to 300 seconds. The sync endpoint stops picking up new users after
  4 minutes, and anyone left over is first in line on the next hourly run. Cron jobs can only run daily on Hobby,
  which is why the hourly run comes from GitHub Actions (free; GitHub may start it a few minutes late).
- **GitHub Actions:** an hourly job uses about 720 short runs a month, well inside the free minutes for a private repo.
  GitHub pauses scheduled workflows in public repos after 60 days without activity; push a commit to wake it up.
- **Supabase's free plan** (500 MB database) is plenty for a student project. It pauses a project after a week with no
  activity at all; the hourly sync queries the database every hour, so that doesn't happen while the sync is running.
  Every table has row-level security on with no policies, so Supabase's public web API can't read them.
- **Shared calendars** count against Google's per-account limits: about 60 new calendars and 750 shares in a short
  period, and 100,000 events. Main-calendar users don't, since events go into their own calendar.
