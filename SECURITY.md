# Security Policy

Semsync holds links and access that work like passwords, so security reports are welcome and taken seriously. Thank
you for reporting responsibly.

## Security Model

Semsync is a web app at [semsync.live](https://semsync.live). People sign in with Google, give it their Canvas
calendar feed link and NUSMods share link, and Semsync keeps an "NUS semester" calendar up to date for them. They can
also let an AI assistant read that semester through Semsync's MCP server ([docs/mcp.md](docs/mcp.md)).

### What Semsync holds

| Data | How it's kept |
| --- | --- |
| Google account ID, name and email | Plain, to know who's signed in |
| Canvas calendar feed link | Encrypted (AES-GCM). The link alone lets anyone read that person's Canvas calendar |
| Google access (a refresh token) | Encrypted. It covers only `calendar.app.created`: calendars Semsync made itself, nothing else |
| NUSMods share link | Plain. It only lists the classes someone picked |
| Subscribe link secret (Outlook, Apple Calendar) | Encrypted to show it again, and as a SHA-256 hash to look it up |
| Events Semsync added, and a copy of the calendar for subscribe links | Plain, so each sync sends only changes |
| AI assistants someone allowed | The app's name, return address and when it was last used, plain. Codes and passes only as SHA-256 hashes |

Deleting your data in Settings removes all of it, deletes the calendar Semsync made, revokes its Google access and
cuts off every AI assistant.

### Trust boundaries

- **Sign in:** Google OAuth, with a random `state` checked on return. Sessions are signed cookies (`HttpOnly`,
  `Secure`, `SameSite=Lax`).
- **Every change is a POST with a CSRF token** tied to the signed-in user.
- **Outgoing requests:** Canvas links must be on an allowed host (`canvas.nus.edu.sg` on the live site), so Semsync
  can't be pointed at other servers. NUSMods data comes from `api.nusmods.com` and public holidays from `mom.gov.sg`.
- **Google Calendar:** Semsync only ever changes events it tagged as its own, in calendars it made.
- **Database:** Postgres on Supabase. Row-level security is on for every table with no policies, so Supabase's public
  API can't read anything; only the app's own connection can.
- **The scheduled sync** (`/api/cron`) needs a bearer secret.
- **Subscribe links are bearer links by design:** anyone with one can read that calendar. They're long random
  secrets, and people can replace theirs in Settings at any time.
- **AI assistants** (`/mcp`) get read only access through OAuth 2.1: they register, the person allows them on Semsync's
  approval page, and PKCE, single use codes and passes bound to `/mcp` follow. Apps may only return people to known
  addresses (Claude, ChatGPT) or their own computer. Passes last an hour, refresh passes are replaced on each use (a
  reused one cuts the connection off), only hashes are stored, and people can remove an app in Settings at any time.

### Contributor and automation tooling

Local development switches (`DEV_LOGIN`, `FAKE_GOOGLE`) sign anyone in without Google. They're ignored on Vercel, and
`.env.local` is never committed. The database's scheduler keeps the cron secret encrypted in Supabase Vault, and the GitHub workflow that runs the sync
by hand holds only the site address and the cron secret.

## Hardening Recommendations

For anyone running their own copy (see [docs/deploying.md](docs/deploying.md)):

- Make `SESSION_SECRET`, `ENCRYPTION_KEY` and `CRON_SECRET` long and random, and never reuse them.
- Never change `ENCRYPTION_KEY` after launch: stored links and tokens can't be decrypted without it.
- Keep `ALLOWED_CANVAS_HOSTS` to your university's Canvas.
- Leave row-level security on for every table, and don't add Supabase policies.
- Never set `DEV_LOGIN` or `FAKE_GOOGLE` anywhere other people can reach.

## Supported Versions

Only the live site, [semsync.live](https://semsync.live), and the latest `main` branch get security fixes.

## Reporting a Vulnerability

**Do not** open a public GitHub issue for security reports.

Report privately through **GitHub Security Advisories:**
[Report a vulnerability](https://github.com/gabriel-wan/semsync/security/advisories/new).

### What to Include in Your Report

- What the problem is, and what someone could do with it
- Steps to reproduce it, on your own account
- The page, route or file involved
- How you'd like to be credited, if at all

Never include other people's data, Canvas links or subscribe links. If you came across any, say so and don't keep it.

### Common Triage Outcomes

- **In scope:** reading or changing someone else's data or calendar; signing in as someone else; getting past the
  CSRF or cron checks; getting Semsync to touch calendars or events it didn't make; recovering Canvas links, tokens or
  subscribe secrets from responses, logs or the database's public API; making the server request hosts other than
  the ones above; script injection on semsync.live; guessing subscribe links; getting an AI assistant's pass without
  the person choosing Allow, or using one to read anything beyond that person's semester.
- **Out of scope:** someone who already has a person's Canvas link or subscribe link reading that calendar (they're
  bearer secrets by design); attacks that need a compromised device, browser or Google account; volume based denial of
  service; missing headers or best practices with no demonstrated impact; social engineering; problems in Google,
  Canvas, NUSMods, Vercel or Supabase themselves (please report those to them); copies run by other people.

## Response Timeline

Semsync is a one person student project, so these are goals rather than guarantees:

- Acknowledge your report within **3 days**
- Assess it and reply with next steps within **7 days**
- Fix serious issues as fast as possible, and tell you when it's done

## Safe Harbor

Research done in good faith under this policy is welcome, and won't be pursued or reported to anyone. That means:

- Test only with your own account and data
- Don't access, change or keep other people's data
- Don't degrade the service for others, for example with automated scanning at volume
- Give a reasonable time to fix the issue before telling anyone else

## Coordinated Disclosure

Please keep the details private until a fix is live, or for 90 days after your report, whichever comes first. Once
it's fixed, you're welcome to write about it, and you'll be credited in the fix if you'd like.
