# Mailgun Email Reply Logging Setup Guide

## Overview
This system allows automatic logging of email replies from patients into the CRM system. When a patient replies to an email sent from the system, their reply is automatically captured and stored in the database.

## How It Works

1. **Outbound Emails**: When sending emails through the system, a unique reply-to address is generated:
   - Format: `reply+<email_id>@yourdomain.com`
   - Example: `reply+123e4567-e89b-12d3-a456-426614174000@mg.aesthetics-ge.ch`

2. **Inbound Replies**: When a patient replies:
   - Mailgun receives the reply at the reply-to address
   - Mailgun forwards the reply to your webhook endpoint
   - The system extracts the original email ID from the reply-to address
   - The reply is logged as an inbound email in the database

3. **Database Storage**: Reply emails are stored in the `emails` table with:
   - `direction: "inbound"`
   - `status: "received"`
   - Linked to the correct patient via `patient_id`

## Mailgun Configuration Steps

### Step 1: Set Up Routes in Mailgun

1. Log in to your Mailgun dashboard: https://app.mailgun.com
2. Go to **Sending** → **Routes** (or **Receiving** → **Routes**)
3. Click **Create Route**

### Step 2: Create the Route

**Match Recipient:**
```
match_recipient("reply\+.*@mg.aesthetics-ge.ch")
```

**Actions:**
- Select: **Forward to URL**
- URL: `https://aestheticclinic.vercel.app/api/emails/webhook`
- Method: **POST**

**Priority:** 1 (or higher than other routes)

**Description:** "Forward email replies to CRM webhook"

### Step 3: Test the Setup

1. Send a test email from the system to your own email address
2. Reply to that email
3. Check the `/api/emails/webhook` endpoint logs in Vercel
4. Verify the reply appears in the patient's email history in the CRM

## Webhook Endpoint

**URL:** `https://aestheticclinic.vercel.app/api/emails/webhook`

**Method:** POST

**Expected Data from Mailgun:**
- `from`: Sender email address
- `To`: Recipient (your reply address)
- `Subject`: Email subject
- `body-plain`: Plain text body
- `body-html`: HTML body
- `timestamp`: Unix timestamp
- `Message-Id`: Unique message identifier

## Troubleshooting

### Issue: Replies not being logged

**Check:**
1. Mailgun route is active and configured correctly
2. Webhook URL is accessible (test with GET request)
3. Check Vercel logs for any errors
4. Verify the original email has a valid `id` in the database

### Issue: Cannot find original email

**Possible causes:**
- Original email was deleted from database
- Email ID format doesn't match (check the reply-to address format)
- Database query failed (check Supabase permissions)

### Issue: Mailgun not forwarding emails

**Check:**
1. Domain DNS is properly configured in Mailgun
2. MX records point to Mailgun servers
3. Route priority is correct (lower number = higher priority)
4. Route match pattern is correct

## Security Notes

- The webhook endpoint is public but validates email IDs against the database
- Only emails with valid original email IDs are logged
- Service role key is used for database writes (stored in environment variables)
- Consider adding Mailgun signature verification for production use

## Testing the Webhook

You can test if the webhook is accessible:

```bash
curl https://aestheticclinic.vercel.app/api/emails/webhook
```

Expected response:
```json
{
  "status": "Email webhook endpoint active",
  "instructions": "Configure Mailgun to forward incoming emails to this endpoint"
}
```

## Additional Configuration

### Enable Mailgun Webhooks (Optional)

For additional tracking, you can also enable Mailgun webhooks for:
- Delivered emails
- Bounced emails
- Spam complaints
- Unsubscribes

These can be configured in Mailgun dashboard under **Webhooks**.

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review Mailgun logs in the dashboard
3. Verify environment variables are set correctly
4. Test the webhook endpoint directly

## Environment Variables Required

Ensure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`
- `MAILGUN_FROM_NAME`
- `MAILGUN_API_BASE_URL`
