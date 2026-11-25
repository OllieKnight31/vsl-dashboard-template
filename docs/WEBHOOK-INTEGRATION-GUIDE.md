# Webhook Integration Guide

How to connect each platform to the VSL Funnel Tracker API.

---

## API Base URL

```
https://your-project.vercel.app/api
```

All webhooks POST to this URL with a `?source=` parameter to identify the platform.

---

## Typeform

**Webhook URL:** `https://your-url.vercel.app/api?source=typeform`

### Setup
1. Open form > Connect > Webhooks > Add webhook
2. Paste the URL above
3. Test with "Send test request"

### Hidden Fields (required for attribution)
Add these hidden fields to your Typeform:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `fbclid`, `gclid`, `email` (if pre-filling from landing page)

Pass them via URL hash:
```
https://form.typeform.com/to/XXXXX#utm_source=facebook&utm_medium=paid_social
```

### Event Type Detection
- Form title contains "application" or "apply" → `application_submit`
- All other forms → `optin`
- Override with hidden field: `event_type=application_submit`

---

## Jotform

**Webhook URL:** `https://your-url.vercel.app/api?source=jotform`

### Setup
1. Open form > Settings > Integrations > Webhooks
2. Add the URL above

### Field Mapping
The adapter looks for standard Jotform field IDs:
- `q3_name` or field named "name" → first/last name
- `q4_email` or field named "email" → email
- `q5_phone` or field named "phone" → phone

Add hidden fields for UTMs using Jotform's prepopulate feature.

---

## Tally

**Webhook URL:** `https://your-url.vercel.app/api?source=tally`

### Setup
1. Open form > Integrations > Webhooks > Add endpoint
2. Paste the URL above

### Hidden Fields
Tally supports hidden fields natively. Add:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

Pass via URL: `https://tally.so/r/XXXXX?utm_source=facebook`

---

## GoHighLevel (GHL)

**Webhook URL:** `https://your-url.vercel.app/api?source=ghl`

### Setup
1. GHL > Settings > Webhooks > Add
2. URL: paste above
3. Subscribe to events:
   - **Contact Created** (triggers `optin`)
   - **Form Submitted** (triggers `optin` or `application_submit` based on form name)
   - **Appointment Status Changed** (triggers `booking_confirmed`, `show`, `no_show`)
   - **Opportunity Status Changed** (triggers `close` when stage = won)

### Custom Fields for UTMs
Create these custom contact fields in GHL:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid`

Capture them via your landing page form's hidden fields.

---

## Calendly

**Webhook URL:** `https://your-url.vercel.app/api?source=calendly`

### Setup
1. Get Personal Access Token: Calendly > Settings > Integrations > API & Webhooks
2. Add to Vercel: `vercel env add CALENDLY_PAT`
3. Create webhook subscription:

```bash
# Put your token in an environment variable first: export CALENDLY_PAT=...
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer $CALENDLY_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-url.vercel.app/api?source=calendly",
    "events": ["invitee.created", "invitee.canceled"],
    "organization": "https://api.calendly.com/organizations/YOUR_ORG_ID",
    "scope": "organization"
  }'
```

### UTM Tracking
Calendly auto-captures UTM params from the page URL. Ensure the booking page URL has UTMs.

### Phone Number
Add a custom question in Calendly asking for phone number. The adapter auto-detects it.

---

## GHL Calendar

**Webhook URL:** `https://your-url.vercel.app/api?source=ghl_calendar`

Same setup as GHL above but specifically for calendar events. Use this if you're using GHL's native calendar instead of Calendly.

---

## Close CRM

**Webhook URL:** `https://your-url.vercel.app/api?source=close`

### Setup
1. Close > Settings > Webhooks > Add
2. URL: paste above
3. Subscribe to: Lead Created, Opportunity Status Changed, Activity Created

---

## HubSpot

**Webhook URL:** `https://your-url.vercel.app/api?source=hubspot`

### Setup
1. Create a Private App in HubSpot > Settings > Integrations > Private Apps
2. Grant scopes: `crm.objects.contacts.read`, `crm.objects.deals.read`
3. Set up webhook subscriptions in the app settings
4. Subscribe to: `contact.creation`, `deal.propertyChange` (dealstage)

---

## Manual Entry

**Webhook URL:** `https://your-url.vercel.app/api?source=manual`

For manual data entry (e.g. recording a show/no-show or close):

```bash
curl -X POST "https://your-url.vercel.app/api?source=manual" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead@example.com",
    "event_type": "show",
    "first_name": "John",
    "last_name": "Smith"
  }'
```

Valid event types: `page_view`, `optin`, `vsl_play`, `vsl_milestone_25/50/75/100`, `cta_click`, `application_submit`, `booking_confirmed`, `show`, `no_show`, `close`, `purchase`

For close events, include `deal_value`:
```json
{
  "email": "lead@example.com",
  "event_type": "close",
  "deal_value": 8000
}
```

---

## Testing Any Webhook

Use the test connections endpoint to verify everything is wired up:

```
GET https://your-url.vercel.app/api?action=test_connections
```

Then check the `👤 LEAD JOURNEYS` tab for new rows after sending a test webhook.
