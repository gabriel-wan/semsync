-- When deadline and exam reminders go off, as JSON lists of minutes before, chosen in Settings. Empty means Semsync's
-- usual times (a day and three hours before a deadline, a week and a day before an exam), so nobody's calendar changes
-- until they pick something.
ALTER TABLE users ADD COLUMN deadline_reminders TEXT;
ALTER TABLE users ADD COLUMN exam_reminders TEXT;

-- Deadlines someone ticked off as done: their reminders stop and they're greyed out in the calendar. Kept apart from
-- synced_events, which is cleared whenever a calendar starts over, so a ticked deadline stays ticked. The event id
-- comes from the Canvas item, so it's the same in every calendar.
CREATE TABLE done_deadlines (
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  done_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
ALTER TABLE done_deadlines ENABLE ROW LEVEL SECURITY;
