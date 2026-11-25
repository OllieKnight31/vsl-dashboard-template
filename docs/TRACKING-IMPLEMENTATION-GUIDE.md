# Tracking Implementation Guide

How to install tracking on your VSL funnel pages.

---

## Option A: Quick Start (Lightweight Snippet)

**Best for:** Most funnels. No GTM needed. Single script tag.

### Install

Add before `</body>` on every funnel page:

```html
<script>
// VSL Tracker Config
var VSL_CONFIG = {
  WEBHOOK_URL: 'https://your-url.vercel.app/api?source=tracking',
  API_SECRET: 'your-secret',
  META_PIXEL_ID: '',       // Optional
  GA4_MEASUREMENT_ID: '',  // Optional
  VIDEO_PLATFORM: 'auto',
  DEBUG: false,
};
</script>
<script src="https://your-url.vercel.app/vsl-tracking-snippet.js"></script>
```

### What it auto-tracks

| Page URL contains | Event fired |
|---|---|
| `/vsl`, `/watch`, `/video` | `vsl_page_view` |
| `/apply`, `/application` | `application_view` |
| `/book`, `/calendar` | `booking_page_view` |
| Any other page | `page_view` |

### Video tracking (automatic)

The snippet auto-detects your video player and fires:
- `vsl_play`: when video starts
- `vsl_milestone_25`: 25% watched
- `vsl_milestone_50`: 50% watched
- `vsl_milestone_75`: 75% watched
- `vsl_milestone_100`: 100% watched

### CTA tracking

Add `data-vsl-cta` to your CTA buttons:

```html
<button data-vsl-cta>Apply Now</button>
<a href="/apply" data-vsl-cta>Book Your Call</a>
```

### Form tracking

If `INTERCEPT_FORMS: true`, the snippet captures email from any form submission on the page and fires an `optin` event.

### Manual events

```javascript
// Identify a lead (call after capturing email)
VSLTracker.identifyLead('user@example.com');

// Fire custom events
VSLTracker.sendEvent('application_submit', { first_name: 'John' });
VSLTracker.sendEvent('close', { deal_value: 8000 });
```

---

## Option B: Advanced (GTM + CAPI)

**Best for:** Clients with existing GTM setup, or when server-side tracking is required for iOS attribution recovery.

### Step 1: Import Web Container

1. Go to [tagmanager.google.com](https://tagmanager.google.com)
2. Open your Web container > Admin > Import Container
3. Upload `tracking/gtm-container-template.json`
4. Choose "Merge" > Rename conflicting tags

### Step 2: Configure Variables

In GTM > Variables:
- **Meta Pixel ID**: replace `YOUR_PIXEL_ID_HERE` with actual ID
- **GA4 Measurement ID**: replace `G-XXXXXXXXXX` with actual ID

### Step 3: Install GTM on funnel pages

```html
<!-- In <head> -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>

<!-- In <body> -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

### Step 4: Fire DataLayer events from your pages

```javascript
// Opt-in form submitted
dataLayer.push({
  event: 'optin_form_submitted',
  eventId: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2,9),
  email: 'user@example.com'
});

// VSL play
dataLayer.push({ event: 'vsl_play', eventId: 'ev_...' });

// VSL milestone (fire at 25/50/75/100)
dataLayer.push({ event: 'vsl_milestone_50', eventId: 'ev_...' });

// Application submitted
dataLayer.push({ event: 'application_submit', eventId: 'ev_...' });

// Booking confirmed
dataLayer.push({ event: 'booking_complete', eventId: 'ev_...' });
```

### Step 5: Server-Side CAPI (optional but recommended)

1. Create a Server container in GTM
2. Deploy to [stape.io](https://stape.io) ($10-30/mo)
3. Import `tracking/gtm-server-container.json`
4. Configure Meta CAPI Access Token and Pixel ID
5. Map custom domain (e.g. `gtm.yourdomain.com`)

This recovers 30-40% of conversions lost to iOS privacy restrictions and ad blockers.

---

## UTM Setup for Ads

Every ad link must include UTM parameters:

```
https://yourfunnel.com/optin?utm_source=facebook&utm_medium=paid_social&utm_campaign=vsl_coaches_mar26&utm_content=hook_pain_v1&utm_term=lal_customers_1pct
```

The tracking snippet captures these automatically and passes them through the entire funnel journey.

### For Typeform hidden fields

Pass UTMs to Typeform:
```
https://form.typeform.com/to/XXXXX#utm_source={{utm_source}}&utm_medium={{utm_medium}}&utm_campaign={{utm_campaign}}&fbclid={{fbclid}}
```

### For Calendly

Calendly auto-captures UTM params if they're in the page URL. Ensure your booking page URL preserves UTMs.
