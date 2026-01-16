-- Add docspace_file_id column to patient_documents table
-- This stores the file ID from ONLYOFFICE DocSpace for each document

ALTER TABLE patient_documents
ADD COLUMN IF NOT EXISTS docspace_file_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patient_documents_docspace_file_id 
ON patient_documents(docspace_file_id);

-- Add comment
COMMENT ON COLUMN patient_documents.docspace_file_id IS 'ONLYOFFICE DocSpace file ID for editing documents with 100% DOCX fidelity';
