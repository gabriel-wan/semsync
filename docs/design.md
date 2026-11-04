# Design system

The UI follows the `landing-page-design` and `figma-designer` skills from
[elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills), applied in code rather than in Figma:

- **Strategy first:** [`landing-page-brief.md`](landing-page-brief.md) has the skill's Part A: intake answers,
  outline, hero copy, benefits, FAQ, SEO and answer engine plan, and the layout type (A) with its rationale.
- **Palette:** midnight black (`#000000`, the skill's darkest allowed background) with electric blue `#0297DE` as the
  brand (logo, tagline band, classes, links, focus rings) and orange as the one accent (deadlines, exams, today, the
  warm half of the glow). The chosen orange `#FC734D` is 97% saturated, so the site uses `#EB7352`, the same orange at
  79%, inside the skill's "one accent below 80%" rule. Light mode follows the phone's setting.
- **Buttons:** primary buttons are white on dark pages and near black on light ones, like Google's own sign in
  buttons; an orange glow fades in on hover and focus. Labels on orange are near black (6.7:1); white on the electric
  blue is 3.2:1, so only large text sits there.
- **One deliberate break from the skills:** the soft glow behind the hero calendar, the tagline band and the closing
  panel is a background gradient, which both skills forbid. It's there at the user's request, because flat colour panels
  read as artificial. Text, buttons and cards stay flat, and no text sits on the glow itself.
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
- **The hero follows a mouse:** with a mouse (never on touch screens or with reduced motion), the hero glow drifts
  after the pointer, the calendar tilts up to about 4 degrees toward it with a faint spotlight, and the reminder card
  floats a little more than the calendar. It only animates transforms and eases toward the pointer each frame.
- **Third party marks:** the hero's "Canvas + NUSMods → Google Calendar" line uses the real Canvas and NUSMods marks,
  copied from their own repositories (see `CanvasMark` and `NusmodsMark` in `src/views/icons.tsx`), on white tiles.
  Google Calendar keeps Semsync's own icon, because Google's brand rules need permission to use its product logos and
  Google reviews the homepage during verification. The footer says Semsync isn't affiliated with NUS, NUSMods or Instructure.
- **Link guides:** the landing page and the setup page walk through where to find the Canvas feed and the NUSMods
  share link (`Guide` in `src/views/pages.tsx`). They click through their steps on their own while on screen, and fall
  back to plain numbered steps without JavaScript.
- **Proof:** the landing page shows what Semsync works with until there's a real quote. Add one, with permission, as
  `TESTIMONIAL` in `src/config.ts`; never invent one.
- **Not in Figma:** the figma-designer skill builds inside Figma through Figma's MCP tools. This project applies its system
  in code; with Figma connected, these tokens can become Figma variables and `/foundations` a Foundations frame.
- **Link preview:** `public/og.png` is a screenshot of `/og`. After changing the headline or colours, regenerate it
  with the dev server running:

  ```bash
  msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 --screenshot=public/og.png http://localhost:8787/og
  ```
