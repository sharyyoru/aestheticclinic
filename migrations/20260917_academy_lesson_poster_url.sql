-- Poster frame for generated Academy lesson videos.
--
-- VideoContainer previously referenced /video-poster.jpg, which does not exist in
-- public/ — so every lesson video rendered with a broken poster. The capture
-- pipeline extracts a real frame per video instead.

ALTER TABLE academy_lessons
  ADD COLUMN IF NOT EXISTS poster_url TEXT;
