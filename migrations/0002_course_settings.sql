-- What goes in each user's calendar: teaching week labels on or off, the courses the last sync found, and the ones
-- they switched off. Both lists are JSON arrays.
ALTER TABLE users ADD COLUMN week_labels INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN courses TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN hidden_courses TEXT NOT NULL DEFAULT '[]';
