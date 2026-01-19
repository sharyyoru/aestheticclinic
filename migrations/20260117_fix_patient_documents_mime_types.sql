-- Migration: Fix patient-documents bucket MIME type restrictions
-- Date: 2026-01-17
-- Issue: Document template creation failing due to MIME type restrictions

-- Update patient-documents bucket to allow common document MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
  'application/msword', -- .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
  'application/vnd.ms-excel', -- .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
  'application/vnd.ms-powerpoint', -- .ppt
  'text/plain', -- .txt
  'text/csv', -- .csv
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif'
]
WHERE id = 'patient-documents';

-- Add comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets with allowed MIME types for document uploads';
