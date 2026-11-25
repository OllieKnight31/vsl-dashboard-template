# VSL Funnel Dashboard Template

Track a video sales letter (VSL) funnel from the first ad click all the way to a closed sale. Every page view, video watch, form, booked call and sale lands in one Google Sheet, so you can see where people drop off and which ads bring in buyers.

Free to use under the MIT licence. There is no login by default.

## What you get

| Part | What it does | Where |
|---|---|---|
| Google Sheet tracker | Builds an 11 tab tracking spreadsheet (funnel flow, daily log, ad metrics, lead journeys, config and more) with one click | `vsl-tracker.gs` |
| API | Receives events from your pages, forms, calendar and CRM, and writes them to the Sheet. Also gives dashboard data, lead journeys, connection tests and Meta Ads sync | `api/index.js` |
| Dashboard | A web dashboard layout for the funnel, ads, daily log, VSL analytics and lead journeys. It ships with sample figures so you can see the layout; your real numbers are in the Sheet | `public/index.html` |
| Page tracking snippet | Captures UTMs, page views, video plays at 25/50/75/100 percent, button clicks and opt ins. Works with Vidalytics, Wistia, YouTube, Vimeo and HTML5 video | `public/vsl-tracking-snippet.js` |
| Google Tag Manager containers | Optional advanced setup with server side Meta Conversions API | `tracking/` |
| Ad import templates | CSV layouts for Meta, Google, YouTube and TikTok ad data | `templates/` |
| Guides | Full setup, tracking and webhook guides | `docs/` |
| Claude Code skill | Lets Claude walk you through the whole setup | `skill/SKILL.md` |

Supported sources: tracking snippet, Typeform, Jotform, Tally, GoHighLevel (forms, CRM and calendar), Calendly, Close, HubSpot, Make, n8n, Zapier and manual entry.

## Setup in 5 steps

You need a free Google account, a free Vercel account, and Node.js 20 or newer on your computer.

### 1. Make the Google Sheet

1. Open [sheets.new](https://sheets.new) to create a blank Sheet.
2. Go to **Extensions > Apps Script**.
3. Delete what is there, paste in everything from `vsl-tracker.gs`, and save.
4. Pick `buildVSLTracker` in the function menu and press **Run**. Allow the permissions it asks for.
5. Open the **CONFIG** tab and fill in your business name, offer and platforms.
6. Copy the Sheet ID from the address bar. It is the long code between `/d/` and `/edit`.

### 2. Give the app access to the Sheet

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Turn on the **Google Sheets API**.
3. Create a **service account**, then make a **JSON key** for it and download the file.
4. Share your Sheet with the service account email (it ends in `iam.gserviceaccount.com`) as **Editor**.

### 3. Fill in your settings

Copy `.env.example` to a new file called `.env` and fill it in:

| Setting | Needed? | What to put |
|---|---|---|
| `SPREADSHEET_ID` | Yes | The Sheet ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | The whole JSON key from step 2, on one line |
| `API_SECRET` | Recommended | Any random text. Make one with `openssl rand -hex 16` |
| `BRAND_NAME`, `BRAND_TAGLINE` | Optional | Shown at the top of the dashboard. Defaults to "Your Brand" |
| `ACCESS_PASSWORD` | Optional | Leave empty for no login. See "Adding a password" below |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Optional | For syncing Meta Ads spend into the Sheet |
| `CALENDLY_PAT` | Optional | Calendly personal access token |

The `.env` file stays on your computer. It is ignored by git, so it never gets uploaded.

### 4. Run it on your computer

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard and [http://localhost:3000/api?action=ping](http://localhost:3000/api?action=ping) to check the API. `npm run build` runs a quick check that everything is ready to deploy.

### 5. Put it online with Vercel

Either import the repo on [vercel.com/new](https://vercel.com/new), or use the command line:

```bash
npm i -g vercel
vercel                              # link your account and create the project
vercel env add SPREADSHEET_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
vercel env add API_SECRET
vercel --prod
```

Add any optional settings the same way. Then:

1. Paste your live address into the **Webhook URL** row of the CONFIG tab.
2. Add the tracking snippet to every funnel page, just before `</body>`:

```html
<script>
  var VSL_CONFIG = {
    WEBHOOK_URL: 'https://your-app.vercel.app/api?source=tracking',
    API_SECRET: 'the same API_SECRET you set above'
  };
</script>
<script src="https://your-app.vercel.app/vsl-tracking-snippet.js"></script>
```

3. Add `data-vsl-cta` to your main call to action button, for example `<a href="/apply" data-vsl-cta>Apply now</a>`.
4. Point your forms, calendar and CRM webhooks at `https://your-app.vercel.app/api?source=NAME` (for example `source=typeform` or `source=calendly`). Each platform is covered step by step in `docs/WEBHOOK-INTEGRATION-GUIDE.md`.
5. Visit `https://your-app.vercel.app/api?action=test_connections` to confirm it is all connected, then do a test opt in.

## Adding a password (optional)

Out of the box there is no login: anyone with the link can open the dashboard. That is the default and nothing needs setting.

To lock it, set `ACCESS_PASSWORD` to a password of your choice (in `.env` on your computer, or with `vercel env add ACCESS_PASSWORD` and then `vercel --prod`). When it is set:

1. The dashboard asks for the password before it opens.
2. The endpoints that read lead data (`dashboard_data`, `funnel_summary`, `lead_journey`, `test_connections`, `sync_meta`) and the `import_ads` upload need the password in an `X-Access-Password` header.
3. Webhooks from your pages, forms and CRM keep working without it, so tracking never breaks. The tracking snippet is protected separately by `API_SECRET`.

To remove the password, delete `ACCESS_PASSWORD` and redeploy. `ADMIN_PASSWORD` also works as the variable name. No password is built into the code.

## API at a glance

| Request | What it does |
|---|---|
| `GET /api?action=ping` | Health check |
| `GET /api?action=auth_check` | Says whether a password is needed, plus the brand name |
| `GET /api?action=dashboard_data` | Live figures from the Sheet |
| `GET /api?action=funnel_summary` | Count of leads at each funnel stage |
| `GET /api?action=lead_journey&email=...` | Every event for one lead |
| `GET /api?action=test_connections` | Checks your Google and Meta settings |
| `GET /api?action=sync_meta` | Pulls Meta Ads data into the Sheet |
| `POST /api?source=...` | Webhook receiver (see the sources list above) |
| `POST /api?action=import_ads` | Upload ad data from a CSV export |

## Using Claude Code to set it up

Run `./install.sh` to add the skill to Claude Code, then ask Claude to "set up the VSL dashboard". It will ask for your Sheet, fill in your settings, run it locally and help you deploy.

## Troubleshooting

| Problem | Fix |
|---|---|
| `no_credentials` or `disconnected` on ping | Check `GOOGLE_SERVICE_ACCOUNT_KEY` is the full JSON on one line |
| Events not showing in the Sheet | Check the webhook address ends with the right `?source=` and the Sheet is shared with the service account |
| Funnel Flow shows 0 | Unhide the LEAD JOURNEYS tab and check events are arriving |
| Formulas show `#REF!` | Run `buildVSLTracker` again |
| Dashboard keeps asking for a password | Clear `ACCESS_PASSWORD` if you do not want one, or check you typed the same value |

## Licence

MIT. See `LICENSE`.
