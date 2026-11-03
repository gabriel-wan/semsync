# Semsync

Canvas deadlines, NUSMods classes and exams, synced into Google Calendar and kept up to date.

Students sign in with Google, paste their Canvas calendar feed link and optionally a NUSMods share link, then pick where
events go:

- **Main calendar (default).** They grant calendar access and events go straight into their own Google Calendar, with
  reminders (1 day and 3 hours before deadlines, 1 week and 1 day before exams). Every event is tagged, and Semsync only
  ever changes or removes its own.
- **Separate shared calendar.** No calendar permission at all: Semsync creates "NUS semester" in its own Google account
  (a service account) and shares it with them read-only.

Sign-in itself only asks for `openid email profile`. Calendar access (`calendar.events.owned`) is requested separately,
only from people who choose the main calendar.

## How it works

```
Canvas feed (.ics) ──┐
                     ├─► desired events ─► diff against what we wrote last time ─► Google Calendar batch API
NUSMods API ─────────┘     (src/lib/canvas.ts,        (src/lib/sync.ts,                (src/lib/calendar/google.ts)
                            src/lib/nusmods.ts)         synced_events table)            as the user, or as the app
```

- **Stable event ids** are derived from each source item, so re-syncs update events instead of duplicating them.
- **Only changes are sent.** Each event's content is hashed; an unchanged semester costs zero Google API calls.
- **Nothing is deleted by mistake.** If Canvas or NUSMods can't be read, the sync stops before changing anything.
  Only upcoming events are removed when they disappear (Canvas drops items ~30 days after they happen).
- **No back-filling.** After the first sync, newly appearing events in the past (like a new tutorial slot) are skipped.
- **Switching modes** removes everything from the old place first. **Deleting data** removes every event Semsync added
  and revokes its Google access.
- **Revoked access** (e.g. from myaccount.google.com/permissions) pauses syncing and the home page asks to reconnect.
- **Teaching weeks** come from the NUS Registrar calendar in `src/config.ts`: recess week and university holidays are
  skipped. Add each new academic year there.

## Stack

- **[Hono](https://hono.dev)** on **Vercel**. `npm run build` compiles `src/` to `dist/`, and Vercel runs `dist/app.js`
  (the `main` in `package.json`); `public/` is served by the CDN. We compile ourselves because Vercel's per-file
  TypeScript step can't follow a `./x.js` import to a `.tsx` file.
- **[Turso](https://turso.tech)** (hosted SQLite) for the database, through `@libsql/client` (its fetch-based web client
  for Turso, so the function needs no native binary). Locally it's a plain file, `local.db`, so development needs no
  account.
- **Hourly sync:** `GET /api/cron`, protected by `CRON_SECRET`. A free GitHub Action calls it every hour, and Vercel Cron
  calls it once a day as a backup (Vercel's Hobby plan only allows daily cron jobs).

## Local development

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill SESSION_SECRET, ENCRYPTION_KEY and CRON_SECRET
npm run db:migrate
npm run dev                  # http://localhost:8787, reloads on changes
```

With `DEV_LOGIN=1` and `FAKE_GOOGLE=1` you can sign in as any email, use `sample` as the Canvas link, "connect" a calendar
without Google, and see what Semsync wrote at `/dev/calendar`. Run the hourly sync by hand with
`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8787/api/cron`, and look at the data with
`npm run sql -- "SELECT id, email, mode, last_sync_at FROM users"`.

```bash
npm test          # unit tests, plus database, colour contrast and copy rules (see below)
npm run typecheck
```

## Design system

The UI follows the `landing-page-design` and `figma-designer` skills from
[elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills), applied in code rather than in Figma:

- **Strategy first:** [`docs/landing-page-brief.md`](docs/landing-page-brief.md) has the skill's Part A: intake answers,
  outline, hero copy, benefits, FAQ, SEO and answer engine plan, and the layout type (A) with its rationale.
- **One source of truth:** `src/views/tokens.ts` holds the spacing and radius scales, the Core Colors palettes
  (Primary, Secondary, Accent, Grayscale, Red, Green, Yellow, Grayscale Alpha), the skill's full standard Color System
  (Border, Surface, Action, Text, Icon, Overlay) with Light and Dark modes, and the named text styles
  (`heading-1` … `caption-5`). The CSS and the `/foundations` page are both generated from it.
- **Skill values by default, exceptions in writing:** Dark uses the skill's aliases and Light mirrors them. Where that
  fails contrast or reads badly with these palettes, the token carries an override and a reason, shown on `/foundations`.
  The one rule the two skills can't both satisfy is heading weight (Regular vs Semibold); this site uses Semibold.
- **`/foundations`** shows every token and every component state in both modes side by side: buttons in 3 sizes ×
  5 types × 5 states, inputs (default, hover, pressed, focus, filled, error, disabled), choice cards in every state,
  notices, chips, and the list's loading, empty, error and filled views. `/foundations?section=components` shows just
  the components.
- **Tests enforce the rules:** `test/design.test.ts` checks that every token in the skill's standard set exists, that
  every override and added token has a reason, that every `var(--…)` the CSS or pages use is defined, WCAG contrast for
  every text and UI pair the pages use in both modes, visible disabled labels, the accents' saturation, and the allowed
  dark backgrounds. `test/copy.test.ts` renders every page and fails on hyphenated words, banned filler words, a period in
  the hero heading, more than one call to action above the fold, missing FAQ structured data, or a missing Privacy or
  Terms link.
- **Proof:** the landing page shows what Semsync works with until there's a real quote. Add one, with permission, as
  `TESTIMONIAL` in `src/config.ts`; never invent one.
- **Not in Figma:** the figma-designer skill builds inside Figma through Figma's MCP tools. This project applies its system
  in code; with Figma connected, these tokens can become Figma variables and `/foundations` a Foundations frame.
- **Link preview:** `public/og.png` is a screenshot of `/og`. After changing the headline or colours, regenerate it
  with the dev server running:

  ```bash
  msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 --screenshot=public/og.png http://localhost:8787/og
  ```

## Going live

### 1. Google Cloud (one project, free)

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

### 2. Vercel and Turso (free)

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

4. **Deploy.** Until the database is connected in the next step, the site shows an error page; that's expected.
5. **Storage → Create Database → Turso Cloud** (Marketplace). Pick the **Singapore** region and connect it to the project.
   This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
6. **Deployments → Redeploy.** Production builds run `npm run build`, which applies the database migrations.
7. Your app is at `https://<your-project>.vercel.app`. Add its `/auth/callback` to the Google client (step 1.5).

Generate the secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Never change `ENCRYPTION_KEY` after launch: stored Canvas links and Google tokens can't be decrypted without it.

### 3. Turn on the hourly sync

On GitHub, open the repo's **Settings → Secrets and variables → Actions** and add two repository secrets:

- `SEMSYNC_URL`: `https://<your-project>.vercel.app`
- `CRON_SECRET`: the same value as in Vercel

Then **Actions → Hourly sync → Run workflow** once to check it works. After that it runs every hour on its own.
(Vercel also calls the same endpoint once a day, as a backup.)

### 4. Google's review (to lift the 100-user cap)

`calendar.events.owned` is a **sensitive** scope. Until Google verifies the app:

- People who connect their calendar see "Google hasn't verified this app" and choose Advanced → Go to Semsync
  (the setup page tells them).
- At most **100 people** can grant calendar access. The shared-calendar option has no cap, so point extra users there.

Verification is free, needs no security audit (that's only for restricted scopes like Gmail), and Google says it can take
up to about 10 days. You need:

1. A domain you own, verified in Google Search Console, serving the homepage. Add it in Vercel under
   **Settings → Domains**, then use it for the Branding links and redirect URI.
2. The privacy page on that same domain (it's at `/privacy`; fill in `{{contact email}}` in `src/views/pages.tsx`).
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
- **Turso's free plan** is plenty for a student project; check its current limits on turso.tech.
- **Shared calendars** count against Google's per-account limits: about 60 new calendars and 750 shares in a short
  period, and 100,000 events. Main-calendar users don't, since events go into their own calendar.

## Not yet verified against real Google

Everything above was tested locally against a fake Google Calendar that copies Google's behaviour. The real Google calls
need a first run with your credentials: sign-in, granting calendar access (including unticking the box), token refresh and
revocation, batch requests, and, for the shared option, the service account, sharing and the "Add to Google Calendar" link.
