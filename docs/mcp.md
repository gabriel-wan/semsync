# The MCP server

How Semsync's read only [MCP](https://modelcontextprotocol.io) server works, for developers. To connect an assistant,
see the [README](../README.md#ask-claude-chatgpt-or-another-ai-assistant) or the
[help page](https://semsync.live/help#ai).

The code is in `src/lib/mcp.ts` (the tools) and `src/lib/oauth.ts` (sign in).

## The server

- `POST https://semsync.live/mcp`, or `<APP_URL>/mcp` on your own copy.
- Stateless Streamable HTTP: each POST gets one plain JSON answer, with no sessions and no server sent events.
- Protocol versions `2025-11-25`, `2025-06-18` and `2025-03-26`.
- Each connection can make 60 calls a minute.

## Tools

Each one only reads, and every input is optional.

- **`upcoming`**: what's coming up from today (deadlines, Canvas events, classes and exams). `days` sets how many
  days, counting today (1 to 120, default 7), and `types` keeps only some of `deadline`, `exam`, `class` and `event`.
- **`week`**: everything in one week, Monday to Sunday, with its NUS name such as "Week 10" or "Recess week". Ask by
  `week` ("Week 1" to "Week 13", "Recess week", "Reading week", "Exams", "this week", "next week" or "last week") or by
  `date` (any day in that week, as `YYYY-MM-DD`). With neither, it's this week.
- **`courses`**: each module, whether it's in the calendar, how many deadlines are still ahead, the next one, and the
  final exam.

Each event comes back as its title, type, module code, date, weekday, start time (none for all day events) and NUS
week, in Singapore time. Links, rooms and Canvas descriptions never leave Semsync.

## Sign in

OAuth 2.1, as the MCP spec describes:

1. A call without a pass gets a 401 pointing to `/.well-known/oauth-protected-resource/mcp`, which points to
   `/.well-known/oauth-authorization-server`.
2. The app registers itself at `/oauth/register` (dynamic client registration).
3. It sends the student to `/oauth/authorize`, with PKCE (`S256`, required). They sign in and choose Allow.
4. It swaps the code at `/oauth/token` for a pass to `/mcp` (scope `read`).

Passes last an hour. Refresh passes last 60 days and are replaced each time they're used; using an old one again cuts
the app off. Only hashes are stored. Students see and remove each app in Settings.

Apps can only send people back to Claude (`claude.ai`, `claude.com`), ChatGPT (`chatgpt.com`) or the app's own
computer (`localhost`, `127.0.0.1` or `[::1]`, any port). To let in another website, add its exact callback address
to `HOSTED_REDIRECTS` in `src/lib/oauth.ts`.

## Trying it locally

With `npm run dev` running, add the local server to Claude Code, then run `/mcp` in Claude Code to sign in with the
dev login:

```bash
claude mcp add --transport http semsync-dev http://localhost:8787/mcp
```

## Changing it

Keep every tool read only, and never return links, emails or Canvas descriptions: event titles come from other
people, and an assistant may follow instructions hidden in them. A new tool needs a test in `test/mcp.test.ts`.
