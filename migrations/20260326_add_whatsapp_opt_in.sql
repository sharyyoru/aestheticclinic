-- Add whatsapp_opt_in column to patients table
-- This column determines if a patient should receive WhatsApp notifications
-- based on whether their country code is in the eligible list

ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean DEFAULT true;

-- Update existing patients: set whatsapp_opt_in based on their country_code
-- WhatsApp-eligible country codes: +41, +33, +49, +39, +44, +1, +7, +34, +971, +966, +43
UPDATE patients 
SET whatsapp_opt_in = CASE 
  WHEN country_code IN ('+41', '+33', '+49', '+39', '+44', '+1', '+7', '+34', '+971', '+966', '+43') THEN true
  ELSE false
END
WHERE whatsapp_opt_in IS NULL OR country_code IS NOT NULL;
