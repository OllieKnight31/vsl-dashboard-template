---
name: vsl-dashboard
description: Set up the VSL Funnel Dashboard template for a user step by step. Builds the Google Sheet tracker, connects a Google service account, fills in the .env settings, runs the app locally, deploys it to Vercel, installs the page tracking snippet and wires up form, calendar and CRM webhooks. Use when the user says "set up the VSL dashboard", "deploy the VSL tracker", "VSL funnel tracking", "/vsl-dashboard", or asks how to use the vsl-dashboard-template repo.
---

# VSL Dashboard setup

You are helping someone set up the `vsl-dashboard-template` repo. Most users are not technical. Do one step at a time, explain what each step is for in one plain sentence, and wait for their answer before moving on. Never print secrets back to them in full, and never commit `.env`.

## 0. Find or get the repo

- If the current folder has `api/index.js`, `public/index.html` and `vsl-tracker.gs`, you are in the repo.
- Otherwise ask where they want it and for the GitHub link of this template, then `git clone` it and `cd` into the folder.
- Check `node -v` is 20 or newer. If not, help them install Node.js LTS from nodejs.org.

## 1. Ask the setup questions (all at once, short list)

1. What is your business or brand name? (goes in `BRAND_NAME`)
2. Do you already have a Google Sheet built with `vsl-tracker.gs`? If yes, paste its link.
3. Do you already have a Google service account JSON key? If yes, where is the file?
4. Which tools does your funnel use: form (Typeform, Jotform, Tally, GoHighLevel), calendar (Calendly, GoHighLevel), CRM (GoHighLevel, Close, HubSpot), video host (Vidalytics, Wistia, YouTube, Vimeo)?
5. Do you want the dashboard password protected? (Default is no password.)
6. Do you want Meta Ads spend synced? (needs an access token and ad account ID)

## 2. Google Sheet

If they do not have one:
1. Tell them to open https://sheets.new, then Extensions > Apps Script.
2. Tell them to paste the full contents of `vsl-tracker.gs` (offer to open or print the file path), save, choose `buildVSLTracker`, press Run and allow access.
3. Ask them to fill in the CONFIG tab and paste the Sheet link back.

Extract the Sheet ID from the link: the part between `/d/` and `/edit`.

## 3. Service account

If they do not have a key, walk them through:
1. https://console.cloud.google.com > create a project.
2. APIs and Services > enable Google Sheets API.
3. IAM and Admin > Service Accounts > create one (no roles needed) > Keys > Add key > JSON. Download it.
4. Share the Sheet with the `client_email` from the JSON file as Editor. Read the JSON file yourself to tell them the exact email.

## 4. Write `.env`

1. `cp .env.example .env`
2. Set `SPREADSHEET_ID`.
3. Set `GOOGLE_SERVICE_ACCOUNT_KEY` to the JSON key minified onto one line, for example with `node -e "process.stdout.write(JSON.stringify(require(process.argv[1])))" /path/to/key.json`. Wrap it in single quotes in `.env`.
4. Generate `API_SECRET` with `openssl rand -hex 16`.
5. Set `BRAND_NAME` (and `BRAND_TAGLINE` if they gave one).
6. Only set `ACCESS_PASSWORD` if they asked for a password. Let them type it themselves or generate a strong one and tell them where it is stored. Leaving it empty means no login.
7. Add `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (format `act_` plus digits) and `CALENDLY_PAT` only if they want those.

## 5. Run locally

```bash
npm install
npm run build
npm run dev
```

Then check `http://localhost:3000/api?action=ping` (expect `"status":"ok"` and `sheets_client: connected`) and `http://localhost:3000/api?action=test_connections` (add the `X-Access-Password` header if a password is set). If Sheets shows `disconnected`, the JSON key is malformed; if it reads nothing, the Sheet is not shared with the service account.

Optional end to end test:

```bash
curl -X POST "http://localhost:3000/api?source=manual" -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","event_type":"optin","first_name":"Test"}'
```

The row should appear in the hidden LEAD JOURNEYS tab.

## 6. Deploy to Vercel

1. `npm i -g vercel` if needed, then `vercel` and follow the login and project prompts (run from the repo root).
2. Add each non empty value from `.env` with `vercel env add NAME production` (pipe the value in, do not echo secrets into the chat).
3. `vercel --prod` and note the live URL.
4. Tell them to paste the live URL into the Webhook URL row of the CONFIG tab.

## 7. Tracking snippet and webhooks

1. Give them this to paste before `</body>` on every funnel page, filled in with their URL and `API_SECRET`:

```html
<script>
  var VSL_CONFIG = {
    WEBHOOK_URL: 'https://THEIR-APP.vercel.app/api?source=tracking',
    API_SECRET: 'THEIR_API_SECRET'
  };
</script>
<script src="https://THEIR-APP.vercel.app/vsl-tracking-snippet.js"></script>
```

2. Tell them to add `data-vsl-cta` to their main button.
3. For each tool they named in step 1, give the matching webhook URL (`/api?source=typeform`, `jotform`, `tally`, `ghl`, `ghl_calendar`, `calendly`, `close`, `hubspot`, `make`, `n8n`, `zapier`) and the steps from `docs/WEBHOOK-INTEGRATION-GUIDE.md`. Remind them to pass UTM hidden fields into forms.
4. If they want Meta sync, run `/api?action=sync_meta` once to test.

## 8. Finish

Confirm with `https://THEIR-APP.vercel.app/api?action=test_connections`, then ask them to do one test opt in and check it lands in the Sheet. Finish with a short summary: live URL, what is connected, whether a password is on, and anything still to do.

## Rules

- No password unless the user asks for one. Password protection is only on when `ACCESS_PASSWORD` is set.
- Never commit `.env`, the JSON key file or any token. Never paste secrets into the chat output.
- The dashboard page shows sample figures as a layout preview; the live numbers are in the Google Sheet. Say so if they ask.
