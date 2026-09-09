-- Academy modules
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

-- Academy lessons within modules
CREATE TABLE IF NOT EXISTS academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES academy_modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  sort_order INT DEFAULT 0,
  estimated_minutes INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, slug)
);

-- User progress tracking
CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Module completion certificates
CREATE TABLE IF NOT EXISTS academy_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES academy_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  certificate_number TEXT UNIQUE,
  UNIQUE(user_id, module_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON academy_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_lesson ON academy_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_user ON academy_certificates(user_id);

-- Seed initial modules
INSERT INTO academy_modules (slug, title, description, icon, sort_order, estimated_minutes) VALUES
('getting-started', 'Getting Started', 'Learn the basics of navigating and using Aliice', 'home', 1, 15),
('patient-management', 'Patient Management', 'Master patient records, search, and lifecycle management', 'users', 2, 30),
('appointments', 'Appointments & Agenda', 'Schedule, manage, and track appointments efficiently', 'calendar', 3, 25),
('deals-pipeline', 'Deals & Pipeline', 'Manage sales pipeline and track conversions', 'trending-up', 4, 20),
('medical-consultations', 'Medical Consultations', 'Document consultations and treatments', 'clipboard', 5, 35),
('swiss-billing', 'Swiss Medical Billing', 'TarDoc codes, SUMEX invoices, and QR bills', 'credit-card', 6, 45),
('documents', 'Documents & Templates', 'Create, edit, and manage documents', 'file-text', 7, 25),
('communication', 'Communication', 'Email, WhatsApp, and workflow automation', 'message-circle', 8, 30),
('ai-features', 'AI Features', 'Leverage AI for emails, chat, and assistance', 'sparkles', 9, 20),
('marketing', 'Marketing & Leads', 'Import leads, track campaigns, and conversions', 'megaphone', 10, 25),
('statistics', 'Statistics & Reports', 'Analyze data and generate reports', 'bar-chart', 11, 20),
('settings', 'Settings & Admin', 'Configure system settings and integrations', 'settings', 12, 30)
ON CONFLICT (slug) DO NOTHING;

-- Seed lessons for Getting Started module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('dashboard-overview', 'Dashboard Overview', 1, 5),
  ('navigation-basics', 'Navigation Basics', 2, 5),
  ('user-profile', 'Your User Profile', 3, 5)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'getting-started'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Patient Management module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('patient-list', 'Patient List & Search', 1, 8),
  ('creating-patients', 'Creating New Patients', 2, 7),
  ('patient-details', 'Patient Details & History', 3, 8),
  ('lifecycle-stages', 'Lifecycle Stages', 4, 7)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'patient-management'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Appointments module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('calendar-view', 'Calendar Views', 1, 8),
  ('booking-appointments', 'Booking Appointments', 2, 8),
  ('appointment-reminders', 'Reminders & Notifications', 3, 5),
  ('ai-calls', 'AI Phone Calls (Retell)', 4, 4)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'appointments'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Deals module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('kanban-board', 'Kanban Board', 1, 7),
  ('deal-stages', 'Deal Stages', 2, 5),
  ('conversion-tracking', 'Conversion Tracking', 3, 8)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'deals-pipeline'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Medical Consultations module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('consultation-notes', 'Consultation Notes', 1, 10),
  ('treatment-records', 'Treatment Records', 2, 10),
  ('medical-history', 'Medical History', 3, 8),
  ('photo-documentation', 'Photo Documentation', 4, 7)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'medical-consultations'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Swiss Billing module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('tardoc-codes', 'TarDoc Codes', 1, 12),
  ('sumex-invoices', 'SUMEX Invoices', 2, 12),
  ('qr-bills', 'Swiss QR Bills', 3, 8),
  ('insurance-billing', 'Insurance Billing', 4, 8),
  ('medidata', 'Medidata Integration', 5, 5)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'swiss-billing'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Documents module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('document-templates', 'Document Templates', 1, 8),
  ('docx-editing', 'DOCX Editing', 2, 8),
  ('pdf-generation', 'PDF Generation', 3, 5),
  ('file-storage', 'File Storage', 4, 4)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'documents'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Communication module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('email-system', 'Email System', 1, 10),
  ('whatsapp-integration', 'WhatsApp Integration', 2, 10),
  ('workflow-automation', 'Workflow Automation', 3, 10)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'communication'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for AI Features module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('ai-email-generation', 'AI Email Generation', 1, 7),
  ('ai-chat-assistant', 'AI Chat Assistant', 2, 7),
  ('knowledgebase', 'Knowledgebase', 3, 6)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'ai-features'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Marketing module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('lead-import', 'Lead Import', 1, 8),
  ('meta-integration', 'Meta/Facebook Integration', 2, 8),
  ('campaign-tracking', 'Campaign Tracking', 3, 9)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'marketing'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Statistics module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('financial-reports', 'Financial Reports', 1, 8),
  ('patient-analytics', 'Patient Analytics', 2, 7),
  ('export-data', 'Exporting Data', 3, 5)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'statistics'
ON CONFLICT (module_id, slug) DO NOTHING;

-- Seed lessons for Settings module
INSERT INTO academy_lessons (module_id, slug, title, sort_order, estimated_minutes)
SELECT m.id, l.slug, l.title, l.sort_order, l.estimated_minutes
FROM academy_modules m
CROSS JOIN (VALUES
  ('user-management', 'User Management', 1, 8),
  ('services-config', 'Services Configuration', 2, 8),
  ('integrations', 'Integrations', 3, 7),
  ('system-settings', 'System Settings', 4, 7)
) AS l(slug, title, sort_order, estimated_minutes)
WHERE m.slug = 'settings'
ON CONFLICT (module_id, slug) DO NOTHING;
