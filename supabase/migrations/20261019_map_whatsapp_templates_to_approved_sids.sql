-- Map the application's expected WhatsApp template names to the approved Twilio
-- Content SIDs and bodies that already exist in the account.
-- This lets WhatsApp sends work immediately without creating new templates.
UPDATE public.whatsapp_templates
SET
  twilio_content_sid = 'HXdff188b222fe82c18233b2422dd04792',
  body = 'Book your appointment with Aesthetics Clinic from this link: https://aestheticclinic.vercel.app/book-appointment/location',
  variables = '[]'::jsonb,
  status = 'approved',
  updated_at = NOW()
WHERE name = 'booking_link_en';

UPDATE public.whatsapp_templates
SET
  twilio_content_sid = 'HX66b60bc27f733a8c7b79ef909a5613ea',
  body = 'Hello {{1}},

We are pleased to confirm that your consultation has been successfully booked.

Appointment Details:
Date: {{2}}
Time: {{3}}
Doctor: {{4}}

We look forward to seeing you!

Thank you for choosing us!

Aesthetics Clinic Geneva',
  variables = '[{"key":"1","label":"Patient first name","example":"John"},{"key":"2","label":"Appointment date","example":"Tuesday, 28 October 2025"},{"key":"3","label":"Appointment time","example":"10:00"},{"key":"4","label":"Doctor name","example":"Dr. Yulia Raspertova"}]'::jsonb,
  status = 'approved',
  updated_at = NOW()
WHERE name = 'cancellation_policy_en';

UPDATE public.whatsapp_templates
SET
  twilio_content_sid = 'HXe119d43b9229371780f4576ca32f9e4c',
  body = 'Bonjour {{1}},

Nous sommes ravis de confirmer que votre consultation a été réservée avec succès.

Détails du rendez-vous :
Date : {{2}}
Heure : {{3}}
Docteur : {{4}}

Nous avons hâte de vous voir !

Merci de nous avoir choisis !

Aesthetics Clinic Geneva',
  variables = '[{"key":"1","label":"Prénom du patient","example":"Marie"},{"key":"2","label":"Date du rendez-vous","example":"mardi 28 octobre 2025"},{"key":"3","label":"Heure du rendez-vous","example":"10h00"},{"key":"4","label":"Nom du médecin","example":"Dr Yulia Raspertova"}]'::jsonb,
  status = 'approved',
  updated_at = NOW()
WHERE name = 'cancellation_policy_fr';

-- booking_link_fr has no matching approved French template in Twilio, so it
-- remains unsubmitted and the code will fall back to SMS for French callers.
