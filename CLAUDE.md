# CLAUDE.md

Everything about this repo (what it is, its layout, commands, conventions and how it deploys) is in AGENTS.md, so
every coding agent reads the same rules:

@AGENTS.md

## For Claude Code

- Check UI changes in a real browser before calling them done: run the dev server, sign in with the dev login, and
  look at the page at 390px and desktop widths in both light and dark mode.
- When a change touches the sync, run `npm test` (it includes a real Postgres) rather than only the file you changed.
- Ask before pushing. Push to `main`: that's what goes live.
