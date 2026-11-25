# VSL Funnel Tracker: Setup Guide

Complete deployment guide. For the short version, see the main README.

---

## Phase 1: Google Sheet (5 min)

1. Go to [sheets.new](https://sheets.new)
2. Extensions > Apps Script
3. Paste entire `vsl-tracker.gs` > Save > Run `buildVSLTracker`
4. Authorise when prompted
5. Fill in `⚙️ CONFIG` tab:
   - Client Name, Offer Name, Price Tier (`mid` / `high` / `ultra_high`)
   - Offer Price, Currency Symbol
   - Video/Form/Booking/CRM Platform selections
6. Copy the **Spreadsheet ID** from the URL bar (between `/d/` and `/edit`)

---

## Phase 2: Google Service Account (5 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Google Sheets API** (APIs & Services > Enable APIs)
4. Go to **IAM & Admin > Service Accounts > Create Service Account**
5. Name it `vsl-tracker`, grant no roles, click Done
6. Click the service account > Keys > Add Key > Create new key > JSON
7. Download the JSON key file
8. **Share the Google Sheet** with the service account email (the one ending `@...iam.gserviceaccount.com`) as **Editor**

---

## Phase 3: Vercel Deployment (5 min)

```bash
npm install
vercel          # First time: link account + create project (run from the repo root)
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY    # Paste the entire JSON key
vercel env add SPREADSHEET_ID               # From step 1.6
vercel env add API_SECRET                   # Generate: openssl rand -hex 16
vercel --prod
```

Copy the production URL. Go to `⚙️ CONFIG` > paste in **Webhook URL** row.

### Verify

Visit: `https://your-url.vercel.app/api?action=ping`

Should return `{"status":"ok","service":"VSL Funnel Tracker API",...}`

---

## Phase 4: Connect Platforms

### Typeform (opt-in / application)

1. Open your Typeform > Connect > Webhooks
2. Add: `https://your-url.vercel.app/api?source=typeform`
3. **Critical:** Add hidden fields to your form:
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid`
4. On your landing page, pass UTMs to Typeform via URL:
   ```
   https://form.typeform.com/to/XXXXX#utm_source=xxx&utm_medium=xxx...
   ```

### Calendly

1. Calendly > Settings > Integrations > API & Webhooks
2. Create Personal Access Token > copy it
3. `vercel env add CALENDLY_PAT` > paste token > `vercel --prod`
4. Create webhook:
   - URL: `https://your-url.vercel.app/api?source=calendly`
   - Events: `invitee.created`, `invitee.canceled`

### GoHighLevel

1. GHL > Settings > Webhooks > Add
2. URL: `https://your-url.vercel.app/api?source=ghl`
3. Subscribe to: Form Submission, Appointment Status, Opportunity Status
4. Create custom contact fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

### Meta Ads Sync (optional)

1. Generate Meta access token with `ads_read` scope
2. Get Ad Account ID (format: `act_123456789`)
3. ```bash
   vercel env add META_ACCESS_TOKEN
   vercel env add META_AD_ACCOUNT_ID
   vercel --prod
   ```
4. Test: `https://your-url.vercel.app/api?action=sync_meta`

---

## Phase 5: Install Tracking Snippet

### Quick Start (recommended)

1. The snippet is served by your own deployment at `https://your-url.vercel.app/vsl-tracking-snippet.js` (source: `public/vsl-tracking-snippet.js`).
2. Add this to **every funnel page** before `</body>`:
   ```html
   <script>
     var VSL_CONFIG = {
       WEBHOOK_URL: 'https://your-url.vercel.app/api?source=tracking',
       API_SECRET: 'your-secret-here',
       META_PIXEL_ID: ''  // optional
     };
   </script>
   <script src="https://your-url.vercel.app/vsl-tracking-snippet.js"></script>
   ```
3. Add `data-vsl-cta` attribute to your CTA button:
   ```html
   <a href="/apply" data-vsl-cta>Apply Now</a>
   ```

### Advanced (GTM + CAPI)

See `TRACKING-IMPLEMENTATION-GUIDE.md`

---

## Phase 6: Verify (5 min)

1. Visit `https://your-url.vercel.app/api?action=test_connections`
2. Do a test opt-in through the funnel
3. Check `👤 LEAD JOURNEYS` tab (unhide it: right-click tab bar > Show sheet)
4. Verify events appear within seconds
5. Check `🎯 FUNNEL FLOW`: counts should update
6. Check `📅 DAILY LOG`: today's row should show data
7. Re-hide LEAD JOURNEYS tab when done testing

---

## CSV Ad Import (for platforms without API sync)

POST to your API:

```bash
curl -X POST "https://your-url.vercel.app/api?action=import_ads" \
  -H "Content-Type: application/json" \
  -H "X-Access-Password: your-password" \
  -d '{
    "platform": "meta",
    "data": [
      {"Date":"2026-03-01","Campaign Name":"VSL Cold","Ad Set Name":"LAL 1%","Ad Name":"Hook v1","Impressions":12500,"Link Clicks":310,"Amount Spent":245,"Results":42}
    ]
  }'
```

(Leave out the `X-Access-Password` line if you have not set `ACCESS_PASSWORD`.) Or manually copy CSV data into the `📢 AD METRICS` tab.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `no_credentials` on ping | Check GOOGLE_SERVICE_ACCOUNT_KEY env var is set correctly |
| Events not appearing | Check webhook URL includes `?source=typeform` (or relevant source) |
| FUNNEL FLOW shows 0 | Unhide LEAD JOURNEYS tab: check if events are there. If not, check webhook. |
| Formulas show #REF! | Re-run `buildVSLTracker()` to rebuild tabs |
| Duplicate events | Check event_id generation: each event should have a unique ID |
