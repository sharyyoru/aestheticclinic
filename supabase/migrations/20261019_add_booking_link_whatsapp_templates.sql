-- WhatsApp booking-link templates used by the Retell AI chatbot/voice agent.
-- Status is 'unsubmitted' because the Twilio Content SID must be filled in
-- after the template is created in Twilio Content Template Builder and
-- approved by Meta. Once approved, update twilio_content_sid and status.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'booking_link_en') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'booking_link_en',
      'MARKETING',
      'en',
      'Hi {{1}}, here is your personal booking link for Aesthetics Clinic: https://aestheticclinic.vercel.app/book-appointment/location. We look forward to seeing you soon!',
      '[{"key":"1","label":"Patient first name","example":"John"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE name = 'booking_link_fr') THEN
    INSERT INTO whatsapp_templates (id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'booking_link_fr',
      'MARKETING',
      'fr',
      'Bonjour {{1}}, voici votre lien de réservation personnel pour la Clinique Esthétique : https://aestheticclinic.vercel.app/book-appointment/location. Au plaisir de vous voir bientôt !',
      '[{"key":"1","label":"Prénom du patient","example":"Marie"}]'::jsonb,
      NULL,
      'unsubmitted',
      NOW(),
      NOW()
    );
  END IF;
END $$;
