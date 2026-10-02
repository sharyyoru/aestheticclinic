CREATE TABLE IF NOT EXISTS academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  video_url TEXT,
  estimated_minutes INT DEFAULT 10,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES academy_modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  poster_url TEXT,
  sort_order INT DEFAULT 0,
  estimated_minutes INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, slug)
);

CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS academy_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES academy_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  certificate_number TEXT UNIQUE,
  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON academy_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_lesson ON academy_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_user ON academy_certificates(user_id);

ALTER TABLE academy_lessons
  ADD COLUMN IF NOT EXISTS captions_url TEXT,
  ADD COLUMN IF NOT EXISTS video_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS tour_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS minimum_tour_width INT NOT NULL DEFAULT 768,
  ADD COLUMN IF NOT EXISTS experience_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE academy_lessons
  DROP CONSTRAINT IF EXISTS academy_lessons_experience_status_check;

ALTER TABLE academy_lessons
  ADD CONSTRAINT academy_lessons_experience_status_check
  CHECK (experience_status IN ('draft', 'pilot', 'published'));

CREATE TABLE IF NOT EXISTS academy_lesson_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  video_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (video_percent >= 0 AND video_percent <= 100),
  video_seconds INT NOT NULL DEFAULT 0 CHECK (video_seconds >= 0),
  tour_step INT NOT NULL DEFAULT 0 CHECK (tour_step >= 0),
  tour_version INT NOT NULL DEFAULT 1 CHECK (tour_version > 0),
  tour_status TEXT NOT NULL DEFAULT 'not_started' CHECK (tour_status IN ('not_started', 'in_progress', 'completed')),
  completion_source TEXT CHECK (completion_source IN ('video', 'tour', 'manual_accessibility')),
  tour_completed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_engagement_user ON academy_lesson_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_engagement_lesson ON academy_lesson_engagement(lesson_id);

ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lesson_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read academy modules" ON academy_modules;
CREATE POLICY "Authenticated users can read academy modules"
  ON academy_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read academy lessons" ON academy_lessons;
CREATE POLICY "Authenticated users can read academy lessons"
  ON academy_lessons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can read own academy progress" ON academy_progress;
CREATE POLICY "Users can read own academy progress"
  ON academy_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own academy progress" ON academy_progress;
CREATE POLICY "Users can insert own academy progress"
  ON academy_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own academy progress" ON academy_progress;
CREATE POLICY "Users can delete own academy progress"
  ON academy_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own academy certificates" ON academy_certificates;
CREATE POLICY "Users can read own academy certificates"
  ON academy_certificates FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own academy engagement" ON academy_lesson_engagement;
CREATE POLICY "Users can read own academy engagement"
  ON academy_lesson_engagement FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own academy engagement" ON academy_lesson_engagement;
CREATE POLICY "Users can insert own academy engagement"
  ON academy_lesson_engagement FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own academy engagement" ON academy_lesson_engagement;
CREATE POLICY "Users can update own academy engagement"
  ON academy_lesson_engagement FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
