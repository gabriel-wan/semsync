# Landing page brief

The landing-page-design skill's Part A (strategy and structure), written down after the fact. Intake answers come from
the conversation that produced Semsync; lines marked **Assumed** were not stated outright, so correct them if they're wrong.

## 1. Intake

| Question | Answer |
|---|---|
| What is it? | A web app that puts a student's Canvas deadlines, NUSMods classes and final exams into their Google Calendar and keeps them up to date every hour. |
| Who is it for? | NUS undergraduates who use Google Calendar and currently copy deadlines in by hand. |
| The one action | Continue with Google (sign in, then paste two links). |
| Traffic source | Friends sharing the link in Telegram group chats and DMs, mostly opened on phones. **Assumed:** some later traffic from searching "Canvas to Google Calendar NUS". |
| Main objections | "Is this safe with my Google account?", "Is this official?", "There's already a way to do this", "Will it mess up my calendar?" |
| Proof available | None yet (no users). Never invent it; the proof slot shows what it works with until a real quote exists (`TESTIMONIAL` in `src/config.ts`). |
| Risk reversal | Free, only touches the events it adds, delete anytime. |
| Tone | Plain, friendly, student to student. No hype. |
| Competition | Canvas's own calendar feed, NUSMods' calendar export, generic tools (Tasks for Canvas, Reclaim, Meta's Muse). Differentiator: the whole NUS semester from one link, in your real calendar, with reminders, and kept up to date. |

## 2. Outline

1. Hero: headline, subheadline, one call to action (Continue with Google), risk reversal line, proof slot, and a week of
   Google Calendar on a sky blue panel with a reminder floating over its edge
2. Benefits: five, in a bento grid, each with a small picture of what it means
3. How it works: three steps beside the setup page they lead to (zig zag)
4. Tagline reveal, on the sky blue band
5. FAQ: seven questions
6. Final call to action, same as the top

This follows the skill's build order (A6: hero, benefits, how it works, proof, FAQ, final CTA), with the tagline as its
own moment between the argument and the objections.

Social proof as its own section is left out until there are real quotes to show.

## 3. Hero copy

- **Headline:** Every Canvas deadline / in your calendar, / without typing a thing (no periods; broken by hand at meaningful points)
- **Subheadline:** Paste your Canvas calendar link and your NUSMods timetable once. Semsync puts your deadlines, classes and exams straight into your Google Calendar, with reminders, and keeps them up to date every hour.
- **Call to action:** Continue with Google (Google's sign-in branding fixes the wording), the page's one pink button, with
  Google's G kept on a white disc
- **Risk reversal:** Free. Only touches the events it adds. Delete anytime.
- **Proof:** Works with Canvas, NUSMods and Google Calendar (until a real testimonial replaces it)

## 4. Benefits

1. Module code up front: short titles you can scan
2. Classes on the right weeks: recess week and public holidays skipped
3. Exams included: dates and times from NUSMods
4. Reminders built in: 1 day and 3 hours before deadlines, a week before exams
5. Updates itself: changes on Canvas show up within the hour

## 5. How it works

1. Sign in with Google: just your name and email to start
2. Paste two links: Canvas calendar feed and, optionally, the NUSMods share link
3. Allow calendar access: or pick a separate shared calendar instead

## 6. FAQ

Official NUS app? · What it does in my calendar · Do I have to give calendar access? · Why Google says unverified ·
How quickly changes show up · Reminders · How to stop. Answers live in `src/views/pages.tsx` and are published as
`FAQPage` structured data.

## 7. SEO and answer engines

- **Index:** the landing page, Privacy and Terms. Everything behind sign in is `noindex`.
- **Title:** "Semsync: your NUS semester in Google Calendar". **Description:** "Canvas deadlines, NUSMods classes and exams in your Google Calendar, kept up to date."
- **Search intent to match:** "Canvas to Google Calendar", "NUS Canvas calendar sync", "NUSMods Google Calendar", "Canvas deadlines reminders". The FAQ answers these in plain language.
- **Answer engines:** `FAQPage` JSON-LD on the landing page so assistants can quote the answers directly.
- **Sharing:** Open Graph title, description and a 1200 × 630 image (`public/og.png`), since most traffic arrives as shared links.
- **Later:** a short guide page, "How to get your Canvas calendar feed link at NUS", would rank for the most common search and help setup at the same time.

## 8. Layout type

**Layout A: classic hero plus sections.** Traffic is warm (a friend's link), the product is simple and free, and the page
has to answer a few specific objections. That rules out B (long story, for skeptical cold traffic) and D (comparison
page). C (minimal conversion page) was close, but the safety and "is this official" questions need the FAQ, which C drops.
