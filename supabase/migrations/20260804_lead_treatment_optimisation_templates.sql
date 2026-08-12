-- WhatsApp templates for the "Lead Treatment Optimisation" promo flow
-- Status: unsubmitted -> must be created in Twilio Content Template Builder,
-- submitted to Meta for approval, then synced into this table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'lead_treatment_optimisation_en') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'lead_treatment_optimisation_en',
      'MARKETING',
      'en',
      'Hi {{1}}, unlock your exclusive bonus at Aesthetics Clinic: 100 CHF credit + free consultation. Book within the next 10 minutes to claim it: {{2}}',
      '[{"key":"1","label":"Patient first name","example":"John"},{"key":"2","label":"Booking link","example":"https://aestheticclinic.vercel.app/book-appointment/location"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'lead_treatment_optimisation_fr') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'lead_treatment_optimisation_fr',
      'MARKETING',
      'fr',
      'Bonjour {{1}}, débloquez votre bonus exclusif à Aesthetics Clinic : 100 CHF de crédit + consultation gratuite. Réservez dans les 10 prochaines minutes pour en profiter : {{2}}',
      '[{"key":"1","label":"Prénom du patient","example":"Marie"},{"key":"2","label":"Lien de réservation","example":"https://aestheticclinic.vercel.app/book-appointment/location"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'cancellation_policy_en') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'cancellation_policy_en',
      'UTILITY',
      'en',
      'Hi {{1}}, your appointment is confirmed. Cancellation policy: a 150 CHF fee will be billed to your registered address only in case of no-show or late cancellation (less than 24 hours notice).',
      '[{"key":"1","label":"Patient first name","example":"John"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'cancellation_policy_fr') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'cancellation_policy_fr',
      'UTILITY',
      'fr',
      'Bonjour {{1}}, votre rendez-vous est confirmé. Politique d''annulation : des frais de 150 CHF seront facturés à votre adresse enregistrée uniquement en cas d''absence ou d''annulation tardive (moins de 24 heures de préavis).',
      '[{"key":"1","label":"Prénom du patient","example":"Marie"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;
END $$;
