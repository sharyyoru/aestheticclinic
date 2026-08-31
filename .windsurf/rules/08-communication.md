# Communication Systems

## Email (Mailgun)

### Setup

```env
MAILGUN_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=clinic@yourdomain.com
MAILGUN_FROM_NAME=Aesthetics Clinic
MAILGUN_API_BASE_URL=https://api.eu.mailgun.net  # EU region
```

### Sending Emails

```typescript
// src/lib/mailgun.ts
import FormData from "form-data";
import Mailgun from "mailgun.js";

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
  url: process.env.MAILGUN_API_BASE_URL,
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendEmailParams) {
  const message = {
    from: `${process.env.MAILGUN_FROM_NAME} <${process.env.MAILGUN_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
    attachment: attachments,
  };

  return await mg.messages.create(process.env.MAILGUN_DOMAIN!, message);
}
```

### API Route for Sending

```typescript
// src/app/api/emails/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailgun";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const { patientId, to, subject, body, attachments } = await request.json();

  try {
    // Send via Mailgun
    const result = await sendEmail({
      to,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ""),  // Strip HTML for text version
      attachments,
    });

    // Store in database
    await supabaseAdmin.from("emails").insert({
      patient_id: patientId,
      to_address: to,
      from_address: process.env.MAILGUN_FROM_EMAIL,
      subject,
      body,
      status: "sent",
      direction: "outbound",
      mailgun_message_id: result.id,
    });

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
```

### Email Database Schema

```sql
CREATE TYPE email_status AS ENUM ('draft', 'scheduled', 'sent', 'failed');
CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  to_address TEXT NOT NULL,
  from_address TEXT,
  cc TEXT[],
  subject TEXT,
  body TEXT,
  status email_status DEFAULT 'draft',
  direction email_direction DEFAULT 'outbound',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  mailgun_message_id TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,          -- source://bucket/path format
  file_type TEXT,
  file_size INTEGER
);
```

## WhatsApp (Twilio)

### Setup

```env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Twilio sandbox number
```

### Important: 24-Hour Session Rules

WhatsApp Business API has strict messaging rules:

| Scenario | Can Send? | Requirements |
|----------|-----------|--------------|
| Patient messages first | ✅ Yes | 24-hour free messaging window opens |
| Reply within 24 hours | ✅ Yes | Any free-form message |
| First message to patient | ❌ No* | Must use approved template |
| After 24 hours | ❌ No* | Must use approved template |

*Templates must be pre-approved by WhatsApp (1-2 business days).

### Sending Messages

```typescript
// src/lib/twilio.ts
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Free-form message (only within 24h session)
export async function sendWhatsAppMessage(to: string, body: string) {
  return await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    body,
  });
}

// Template message (for initiating or after 24h)
export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables: Record<string, string>
) {
  return await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    contentSid: templateSid,
    contentVariables: JSON.stringify(variables),
  });
}
```

### Webhook for Incoming Messages

```typescript
// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  
  const from = formData.get("From")?.toString().replace("whatsapp:", "");
  const body = formData.get("Body")?.toString();
  const messageSid = formData.get("MessageSid")?.toString();

  if (!from || !body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Find patient by phone number
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("phone", from)
    .single();

  // Store message
  await supabaseAdmin.from("whatsapp_messages").insert({
    patient_id: patient?.id,
    from_number: from,
    to_number: process.env.TWILIO_WHATSAPP_FROM?.replace("whatsapp:", ""),
    body,
    direction: "inbound",
    twilio_message_sid: messageSid,
    status: "received",
  });

  return NextResponse.json({ success: true });
}
```

### WhatsApp Database Schema

```sql
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT,
  media_url TEXT,
  direction TEXT NOT NULL,          -- 'inbound' or 'outbound'
  status TEXT DEFAULT 'pending',
  twilio_message_sid TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Workflow Automation

### Email Templates

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type email_template_type NOT NULL,
  subject_template TEXT,
  body_template TEXT,
  html_content TEXT,
  is_demo BOOLEAN DEFAULT false
);

-- Template with variables
INSERT INTO email_templates (name, type, subject_template, body_template) VALUES (
  'Appointment Confirmation',
  'workflow',
  'Your Appointment - {{appointment.date}}',
  'Dear {{patient.first_name}},\n\nYour appointment is confirmed for {{appointment.date}} at {{appointment.time}}.'
);
```

### Workflows

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type workflow_trigger_type NOT NULL,
  active BOOLEAN DEFAULT true,
  config JSONB,                      -- Workflow nodes and edges
  is_demo BOOLEAN DEFAULT false
);

-- Example workflow config
{
  "nodes": [
    { "id": "trigger-1", "type": "trigger", "data": { "label": "Appointment Created" } },
    { "id": "delay-1", "type": "delay", "data": { "config": { "delay_minutes": 5 } } },
    { "id": "action-1", "type": "action", "data": { 
      "action_type": "send_email", 
      "config": { "template_id": "uuid-here" } 
    }}
  ],
  "edges": [
    { "source": "trigger-1", "target": "delay-1" },
    { "source": "delay-1", "target": "action-1" }
  ]
}
```

### Trigger Types

```typescript
type WorkflowTriggerType =
  | "patient_created"
  | "appointment_created"
  | "appointment_reminder"
  | "deal_stage_changed"
  | "consultation_completed"
  | "invoice_created"
  | "manual";
```

## Notifications

### In-App Notifications

```typescript
// Real-time notifications with Supabase
useEffect(() => {
  const channel = supabase
    .channel("notifications")
    .on(
      "postgres_changes",
      { 
        event: "INSERT", 
        schema: "public", 
        table: "patient_note_mentions",
        filter: `mentioned_user_id=eq.${userId}`,
      },
      (payload) => {
        toast.info("You were mentioned in a note");
        // Update notification badge
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId]);
```

### Mention System

```sql
CREATE TABLE patient_note_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES patient_notes(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id),
  mentioned_user_id UUID REFERENCES users(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX patient_note_mentions_unread_idx 
ON patient_note_mentions(mentioned_user_id, read_at) 
WHERE read_at IS NULL;
```
