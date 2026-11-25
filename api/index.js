/**
 * VSL FUNNEL TRACKER — Vercel Serverless API
 * ============================================
 * Universal webhook receiver + dashboard data API + ad sync
 *
 * GET Endpoints:
 *   ?action=ping              — health check
 *   ?action=dashboard_data    — live KPI data from Google Sheet
 *   ?action=funnel_summary    — aggregated funnel stage counts
 *   ?action=lead_journey      — full event history for one lead (&email=x)
 *   ?action=test_connections  — validate platform credentials
 *   ?action=sync_meta         — pull Meta Ads API data into Sheet
 *
 * POST Endpoints (webhook receivers):
 *   ?source=tracking          — client-side tracking snippet events
 *   ?source=typeform          — Typeform form submission
 *   ?source=jotform           — Jotform form submission
 *   ?source=tally             — Tally form submission
 *   ?source=ghl               — GoHighLevel webhook (forms + CRM)
 *   ?source=calendly          — Calendly invitee events
 *   ?source=ghl_calendar      — GHL Calendar bookings
 *   ?source=close             — Close CRM webhook
 *   ?source=hubspot           — HubSpot webhook
 *   ?source=manual            — Manual data entry
 *   ?action=import_ads        — Universal CSV ad data import
 */

const { google } = require('googleapis');

// ── Configuration ──────────────────────────────────────────────────────
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const API_SECRET = process.env.API_SECRET || '';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '';

// Optional dashboard password. Leave ACCESS_PASSWORD unset (the default) and
// everything is open. Set it and the dashboard plus the read endpoints ask for it.
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || process.env.ADMIN_PASSWORD || '';
const BRAND_NAME = process.env.BRAND_NAME || 'Your Brand';
const BRAND_TAGLINE = process.env.BRAND_TAGLINE || 'VSL Funnel Tracker';

function safeEqual(a, b) {
  const crypto = require('crypto');
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAuthorised(req) {
  if (!ACCESS_PASSWORD) return true;
  const provided = (req.headers && (req.headers['x-access-password'] || '')) || '';
  return provided !== '' && safeEqual(provided, ACCESS_PASSWORD);
}

const LEAD_JOURNEYS_TAB = '👤 LEAD JOURNEYS';
const AD_METRICS_TAB = '📢 AD METRICS';
const CONFIG_TAB = '⚙️ CONFIG';
const FUNNEL_FLOW_TAB = '🎯 FUNNEL FLOW';
const DAILY_LOG_TAB = '📅 DAILY LOG';

// ── Google Sheets API Client ───────────────────────────────────────────
let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) return null;
  try {
    const credentials = JSON.parse(key);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (err) {
    console.error('[API] Failed to init Sheets client:', err.message);
    return null;
  }
}

// ── Sheet Helpers ──────────────────────────────────────────────────────
async function appendToSheet(sheetName, values) {
  const sheets = getSheetsClient();
  if (!sheets) return { written: false, reason: 'no_credentials' };
  try {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return { written: true, updatedRows: result.data.updates?.updatedRows || 0 };
  } catch (err) {
    console.error('[API] Sheet append error:', err.message);
    return { written: false, reason: err.message };
  }
}

async function readSheetRange(sheetName, range) {
  const sheets = getSheetsClient();
  if (!sheets) return null;
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
    });
    return result.data.values || [];
  } catch (err) {
    console.error('[API] Sheet read error:', err.message);
    return null;
  }
}

async function updateSheetRange(sheetName, range, values) {
  const sheets = getSheetsClient();
  if (!sheets) return { written: false, reason: 'no_credentials' };
  try {
    const result = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return { written: true, updatedCells: result.data.updatedCells || 0 };
  } catch (err) {
    console.error('[API] Sheet update error:', err.message);
    return { written: false, reason: err.message };
  }
}

async function clearSheetRange(sheetName, range) {
  const sheets = getSheetsClient();
  if (!sheets) return false;
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!${range}`,
    });
    return true;
  } catch (err) {
    console.error('[API] Sheet clear error:', err.message);
    return false;
  }
}

// ── Deduplication ──────────────────────────────────────────────────────
async function isDuplicate(eventId) {
  if (!eventId) return false;
  const rows = await readSheetRange(LEAD_JOURNEYS_TAB, 'V2:V501');
  if (!rows) return false;
  return rows.some(r => r[0] === eventId);
}

// ── Normalised Event → Sheet Row ───────────────────────────────────────
function eventToRow(evt) {
  return [
    evt.timestamp || new Date().toISOString(),     // A: Timestamp
    evt.email || '',                                // B: Email
    evt.event_type || '',                           // C: Event Type
    evt.event_source || '',                         // D: Event Source
    evt.first_name || '',                           // E: First Name
    evt.last_name || '',                            // F: Last Name
    evt.phone || '',                                // G: Phone
    evt.utm_source || '',                           // H: UTM Source
    evt.utm_medium || '',                           // I: UTM Medium
    evt.utm_campaign || '',                         // J: UTM Campaign
    evt.utm_content || '',                          // K: UTM Content
    evt.utm_term || '',                             // L: UTM Term
    evt.page_url || '',                             // M: Page URL
    evt.fbclid || '',                               // N: FBCLID
    evt.gclid || '',                                // O: GCLID
    evt.video_milestone || '',                      // P: Video Milestone
    evt.deal_value || '',                           // Q: Deal Value
    evt.ad_campaign || '',                          // R: Ad Campaign
    evt.ad_set || '',                               // S: Ad Set
    evt.ad_creative || '',                          // T: Ad Creative
    evt.metadata ? JSON.stringify(evt.metadata) : '', // U: Metadata
    evt.event_id || `api_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`, // V: Event ID
    evt.date_only || (evt.timestamp || new Date().toISOString()).split('T')[0],       // W: Date Only
  ];
}

// ── Write Event to LEAD JOURNEYS ───────────────────────────────────────
async function writeEvent(normalised) {
  // Dedup check
  if (normalised.event_id && await isDuplicate(normalised.event_id)) {
    return { written: false, reason: 'duplicate_event', event_id: normalised.event_id };
  }
  const row = eventToRow(normalised);
  return await appendToSheet(LEAD_JOURNEYS_TAB, [row]);
}

// ── Write Multiple Events ──────────────────────────────────────────────
async function writeEvents(events) {
  const rows = [];
  for (const evt of events) {
    if (evt.event_id && await isDuplicate(evt.event_id)) continue;
    rows.push(eventToRow(evt));
  }
  if (rows.length === 0) return { written: false, reason: 'all_duplicates' };
  return await appendToSheet(LEAD_JOURNEYS_TAB, rows);
}

// ═══════════════════════════════════════════════════════════════════════
// WEBHOOK ADAPTERS
// Each adapter takes a raw webhook body and returns normalised event(s)
// ═══════════════════════════════════════════════════════════════════════

// ── Tracking Snippet Adapter ───────────────────────────────────────────
function adaptTracking(body) {
  // Events from the client-side tracking snippet are already normalised
  const events = Array.isArray(body.events) ? body.events : [body];
  return events.map(evt => ({
    timestamp: evt.timestamp || new Date().toISOString(),
    email: evt.email || evt.lead_id || '',
    event_type: evt.event_type || '',
    event_source: 'tracking_snippet',
    first_name: evt.first_name || '',
    last_name: evt.last_name || '',
    phone: evt.phone || '',
    utm_source: evt.utm_source || '',
    utm_medium: evt.utm_medium || '',
    utm_campaign: evt.utm_campaign || '',
    utm_content: evt.utm_content || '',
    utm_term: evt.utm_term || '',
    page_url: evt.page_url || '',
    fbclid: evt.fbclid || '',
    gclid: evt.gclid || '',
    video_milestone: evt.video_milestone || '',
    deal_value: evt.deal_value || '',
    ad_campaign: evt.ad_campaign || '',
    ad_set: evt.ad_set || '',
    ad_creative: evt.ad_creative || '',
    metadata: evt.metadata || {},
    event_id: evt.event_id || `trk_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    date_only: (evt.timestamp || new Date().toISOString()).split('T')[0],
  }));
}

// ── Typeform Adapter ───────────────────────────────────────────────────
function adaptTypeform(body) {
  const fr = body.form_response || {};
  const answers = fr.answers || [];
  const hidden = fr.hidden || {};
  const definition = fr.definition || {};

  // Find email answer
  const emailAnswer = answers.find(a => a.type === 'email');
  const email = emailAnswer?.email || hidden.email || '';

  // Find name (look for short_text fields or specific refs)
  const nameAnswer = answers.find(a =>
    a.field?.ref?.toLowerCase().includes('name') ||
    (a.type === 'short_text' && !a.field?.ref?.toLowerCase().includes('phone'))
  );
  const fullName = nameAnswer?.text || '';
  const nameParts = fullName.split(' ');

  // Find phone
  const phoneAnswer = answers.find(a =>
    a.type === 'phone_number' || a.field?.ref?.toLowerCase().includes('phone')
  );

  // Determine event type based on form title or hidden field
  let eventType = hidden.event_type || 'optin';
  const formTitle = (definition.title || '').toLowerCase();
  if (formTitle.includes('application') || formTitle.includes('apply')) {
    eventType = 'application_submit';
  }

  return [{
    timestamp: fr.submitted_at || new Date().toISOString(),
    email,
    event_type: eventType,
    event_source: 'typeform',
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    phone: phoneAnswer?.phone_number || '',
    utm_source: hidden.utm_source || '',
    utm_medium: hidden.utm_medium || '',
    utm_campaign: hidden.utm_campaign || '',
    utm_content: hidden.utm_content || '',
    utm_term: hidden.utm_term || '',
    page_url: '',
    fbclid: hidden.fbclid || '',
    gclid: hidden.gclid || '',
    video_milestone: '',
    deal_value: '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: {
      form_id: fr.form_id || '',
      response_id: fr.token || '',
      form_title: definition.title || '',
      answers_count: answers.length,
    },
    event_id: `tf_${fr.token || Date.now()}`,
    date_only: (fr.submitted_at || new Date().toISOString()).split('T')[0],
  }];
}

// ── Jotform Adapter ────────────────────────────────────────────────────
function adaptJotform(body) {
  // Jotform sends form data as flat key-value pairs
  const raw = body.rawRequest ? JSON.parse(body.rawRequest) : body;

  // Common Jotform field patterns
  const email = raw.email || raw.q4_email || body.q4_email || '';
  const name = raw.name || raw.q3_name || body.q3_name || '';
  const phone = raw.phone || raw.q5_phone || body.q5_phone || '';
  const nameParts = (typeof name === 'string' ? name : `${name?.first || ''} ${name?.last || ''}`).split(' ');

  return [{
    timestamp: new Date().toISOString(),
    email,
    event_type: raw.event_type || 'optin',
    event_source: 'jotform',
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    phone: typeof phone === 'object' ? phone?.full || '' : phone || '',
    utm_source: raw.utm_source || '',
    utm_medium: raw.utm_medium || '',
    utm_campaign: raw.utm_campaign || '',
    utm_content: raw.utm_content || '',
    utm_term: raw.utm_term || '',
    page_url: '',
    fbclid: raw.fbclid || '',
    gclid: raw.gclid || '',
    video_milestone: '',
    deal_value: '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: { form_id: raw.formID || body.formID || '', submission_id: raw.submissionID || body.submissionID || '' },
    event_id: `jf_${raw.submissionID || body.submissionID || Date.now()}`,
    date_only: new Date().toISOString().split('T')[0],
  }];
}

// ── Tally Adapter ──────────────────────────────────────────────────────
function adaptTally(body) {
  const fields = body.data?.fields || [];
  const hiddenFields = {};
  (body.data?.hidden || []).forEach(h => { hiddenFields[h.key] = h.value; });

  // Find email, name, phone from fields
  const emailField = fields.find(f => f.type === 'INPUT_EMAIL');
  const nameField = fields.find(f => f.type === 'INPUT_TEXT' && f.label?.toLowerCase().includes('name'));
  const phoneField = fields.find(f => f.type === 'INPUT_PHONE_NUMBER');

  const nameParts = (nameField?.value || '').split(' ');

  return [{
    timestamp: body.data?.createdAt || new Date().toISOString(),
    email: emailField?.value || '',
    event_type: hiddenFields.event_type || 'optin',
    event_source: 'tally',
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    phone: phoneField?.value || '',
    utm_source: hiddenFields.utm_source || '',
    utm_medium: hiddenFields.utm_medium || '',
    utm_campaign: hiddenFields.utm_campaign || '',
    utm_content: hiddenFields.utm_content || '',
    utm_term: hiddenFields.utm_term || '',
    page_url: '',
    fbclid: hiddenFields.fbclid || '',
    gclid: hiddenFields.gclid || '',
    video_milestone: '',
    deal_value: '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: { form_id: body.data?.formId || '', response_id: body.data?.responseId || '' },
    event_id: `tl_${body.data?.responseId || Date.now()}`,
    date_only: (body.data?.createdAt || new Date().toISOString()).split('T')[0],
  }];
}

// ── GoHighLevel Adapter ────────────────────────────────────────────────
function adaptGHL(body) {
  // GHL sends different payloads for different webhook types
  const contact = body.contact || body;
  const email = contact.email || body.email || '';
  const firstName = contact.firstName || contact.first_name || body.firstName || '';
  const lastName = contact.lastName || contact.last_name || body.lastName || '';
  const phone = contact.phone || body.phone || '';

  // Determine event type from GHL webhook type
  let eventType = 'optin';
  const webhookType = (body.type || body.event || '').toLowerCase();

  if (webhookType.includes('form') || webhookType.includes('submission')) {
    eventType = body.formName?.toLowerCase().includes('application') ? 'application_submit' : 'optin';
  } else if (webhookType.includes('appointment') || webhookType.includes('booking')) {
    const status = (body.status || body.appointmentStatus || '').toLowerCase();
    if (status.includes('cancel')) eventType = 'booking_cancelled';
    else if (status.includes('show') || status.includes('completed')) eventType = 'show';
    else if (status.includes('no_show') || status.includes('noshow')) eventType = 'no_show';
    else eventType = 'booking_confirmed';
  } else if (webhookType.includes('opportunity')) {
    const stage = (body.stage || body.pipelineStage || '').toLowerCase();
    if (stage.includes('won') || stage.includes('closed')) eventType = 'close';
    else if (stage.includes('show')) eventType = 'show';
    else if (stage.includes('no_show') || stage.includes('noshow')) eventType = 'no_show';
  }

  // Extract UTMs from custom fields
  const customFields = contact.customFields || contact.custom_fields || {};
  const getField = (name) => {
    if (typeof customFields === 'object' && !Array.isArray(customFields)) {
      return customFields[name] || '';
    }
    if (Array.isArray(customFields)) {
      const field = customFields.find(f => f.key === name || f.name === name);
      return field?.value || '';
    }
    return '';
  };

  return [{
    timestamp: body.dateAdded || body.createdAt || new Date().toISOString(),
    email,
    event_type: eventType,
    event_source: 'ghl',
    first_name: firstName,
    last_name: lastName,
    phone,
    utm_source: getField('utm_source') || body.source || '',
    utm_medium: getField('utm_medium') || '',
    utm_campaign: getField('utm_campaign') || '',
    utm_content: getField('utm_content') || '',
    utm_term: getField('utm_term') || '',
    page_url: '',
    fbclid: getField('fbclid') || '',
    gclid: getField('gclid') || '',
    video_milestone: '',
    deal_value: body.monetaryValue || body.value || '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: {
      contact_id: contact.id || body.contactId || '',
      webhook_type: webhookType,
      pipeline_stage: body.stage || body.pipelineStage || '',
      form_name: body.formName || '',
    },
    event_id: `ghl_${contact.id || body.contactId || ''}_${eventType}_${Date.now()}`,
    date_only: (body.dateAdded || new Date().toISOString()).split('T')[0],
  }];
}

// ── Calendly Adapter ───────────────────────────────────────────────────
function adaptCalendly(body) {
  const event = body.event || '';
  const payload = body.payload || {};
  const invitee = payload.invitee || payload;
  const tracking = invitee.tracking || {};
  const questions = invitee.questions_and_answers || [];

  let eventType = 'booking_confirmed';
  if (event === 'invitee.canceled') eventType = 'booking_cancelled';
  else if (event.includes('reschedule')) eventType = 'booking_rescheduled';

  const phoneAnswer = questions.find(q =>
    q.question?.toLowerCase().includes('phone') || q.question?.toLowerCase().includes('number')
  );

  const nameParts = (invitee.name || '').split(' ');

  return [{
    timestamp: invitee.created_at || new Date().toISOString(),
    email: invitee.email || '',
    event_type: eventType,
    event_source: 'calendly',
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    phone: phoneAnswer?.answer || '',
    utm_source: tracking.utm_source || '',
    utm_medium: tracking.utm_medium || '',
    utm_campaign: tracking.utm_campaign || '',
    utm_content: tracking.utm_content || '',
    utm_term: tracking.utm_term || '',
    page_url: '',
    fbclid: '',
    gclid: '',
    video_milestone: '',
    deal_value: '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: {
      event_uri: payload.uri || '',
      event_type_name: payload.event_type?.name || '',
      scheduled_time: payload.event?.start_time || '',
    },
    event_id: `cal_${(payload.uri || '').split('/').pop() || Date.now()}`,
    date_only: (invitee.created_at || new Date().toISOString()).split('T')[0],
  }];
}

// ── GHL Calendar Adapter ───────────────────────────────────────────────
function adaptGHLCalendar(body) {
  const contact = body.contact || {};
  const status = (body.status || body.appointmentStatus || '').toLowerCase();

  let eventType = 'booking_confirmed';
  if (status.includes('cancel')) eventType = 'booking_cancelled';
  else if (status.includes('show') || status.includes('completed')) eventType = 'show';
  else if (status.includes('no_show') || status.includes('noshow')) eventType = 'no_show';

  return [{
    timestamp: body.startTime || body.dateAdded || new Date().toISOString(),
    email: contact.email || body.email || '',
    event_type: eventType,
    event_source: 'ghl_calendar',
    first_name: contact.firstName || '',
    last_name: contact.lastName || '',
    phone: contact.phone || '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    page_url: '',
    fbclid: '',
    gclid: '',
    video_milestone: '',
    deal_value: '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: {
      appointment_id: body.id || body.appointmentId || '',
      calendar_name: body.calendarName || '',
      status: status,
    },
    event_id: `ghlcal_${body.id || body.appointmentId || Date.now()}`,
    date_only: (body.startTime || new Date().toISOString()).split('T')[0],
  }];
}

// ── Close CRM Adapter ──────────────────────────────────────────────────
function adaptClose(body) {
  const event = body.event || {};
  const data = event.data || body.data || body;

  let eventType = 'optin';
  const objectType = (event.object_type || body.object_type || '').toLowerCase();
  const action = (event.action || body.action || '').toLowerCase();

  if (objectType === 'lead' && action === 'created') eventType = 'optin';
  else if (objectType === 'opportunity') {
    const status = (data.status_label || data.status || '').toLowerCase();
    if (status.includes('won')) eventType = 'close';
    else if (status.includes('show')) eventType = 'show';
  } else if (objectType === 'activity' && (data.type || '').includes('call')) {
    eventType = 'show';
  }

  const contacts = data.contacts || [];
  const primaryContact = contacts[0] || {};
  const emails = primaryContact.emails || [];
  const phones = primaryContact.phones || [];

  return [{
    timestamp: data.date_created || new Date().toISOString(),
    email: emails[0]?.email || data.email || '',
    event_type: eventType,
    event_source: 'close',
    first_name: (data.contact_name || primaryContact.name || '').split(' ')[0] || '',
    last_name: (data.contact_name || primaryContact.name || '').split(' ').slice(1).join(' ') || '',
    phone: phones[0]?.phone || '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    page_url: '',
    fbclid: '',
    gclid: '',
    video_milestone: '',
    deal_value: data.value || data.monetary_value || '',
    ad_campaign: '',
    ad_set: '',
    ad_creative: '',
    metadata: {
      lead_id: data.lead_id || data.id || '',
      opportunity_id: data.opportunity_id || '',
      status: data.status_label || data.status || '',
    },
    event_id: `close_${data.id || Date.now()}`,
    date_only: (data.date_created || new Date().toISOString()).split('T')[0],
  }];
}

// ── HubSpot Adapter ────────────────────────────────────────────────────
function adaptHubSpot(body) {
  const events = body.subscriptionType ? [body] : (body || []);
  const results = [];

  for (const evt of (Array.isArray(events) ? events : [events])) {
    const props = evt.properties || evt.objectProperties || {};
    let eventType = 'optin';
    const subType = (evt.subscriptionType || '').toLowerCase();

    if (subType.includes('deal')) {
      const stage = (props.dealstage || '').toLowerCase();
      if (stage.includes('closed') || stage.includes('won')) eventType = 'close';
      else eventType = 'show';
    } else if (subType.includes('contact')) {
      eventType = 'optin';
    }

    results.push({
      timestamp: new Date(evt.occurredAt || Date.now()).toISOString(),
      email: props.email || '',
      event_type: eventType,
      event_source: 'hubspot',
      first_name: props.firstname || '',
      last_name: props.lastname || '',
      phone: props.phone || '',
      utm_source: props.utm_source || '',
      utm_medium: props.utm_medium || '',
      utm_campaign: props.utm_campaign || '',
      utm_content: props.utm_content || '',
      utm_term: props.utm_term || '',
      page_url: '',
      fbclid: '',
      gclid: '',
      video_milestone: '',
      deal_value: props.amount || '',
      ad_campaign: '',
      ad_set: '',
      ad_creative: '',
      metadata: {
        object_id: evt.objectId || '',
        subscription_type: evt.subscriptionType || '',
      },
      event_id: `hs_${evt.objectId || Date.now()}_${eventType}`,
      date_only: new Date(evt.occurredAt || Date.now()).toISOString().split('T')[0],
    });
  }

  return results;
}

// ── Make.com / n8n / Zapier Adapters ──────────────────────────────────
// These accept the same normalised payload format so automation tools
// can POST directly without any transformation module.
// Expected body: { email, event_type, first_name, last_name, phone,
//   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
//   page_url, fbclid, gclid, video_milestone, deal_value,
//   ad_campaign, ad_set, ad_creative, metadata }

function adaptMake(body) {
  return [buildAutomationEvent(body, 'make')];
}

function adaptN8N(body) {
  return [buildAutomationEvent(body, 'n8n')];
}

function adaptZapier(body) {
  return [buildAutomationEvent(body, 'zapier')];
}

function buildAutomationEvent(body, source) {
  const now = new Date().toISOString();
  return {
    timestamp: body.timestamp || now,
    email: body.email || '',
    event_type: body.event_type || '',
    event_source: source,
    first_name: body.first_name || '',
    last_name: body.last_name || '',
    phone: body.phone || '',
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    utm_content: body.utm_content || '',
    utm_term: body.utm_term || '',
    page_url: body.page_url || '',
    fbclid: body.fbclid || '',
    gclid: body.gclid || '',
    video_milestone: body.video_milestone || '',
    deal_value: body.deal_value || '',
    ad_campaign: body.ad_campaign || '',
    ad_set: body.ad_set || '',
    ad_creative: body.ad_creative || '',
    metadata: body.metadata || {},
    event_id: body.event_id || `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    date_only: (body.timestamp || now).split('T')[0],
  };
}

// ── Manual Entry Adapter ───────────────────────────────────────────────
function adaptManual(body) {
  return [{
    timestamp: body.timestamp || new Date().toISOString(),
    email: body.email || '',
    event_type: body.event_type || '',
    event_source: 'manual',
    first_name: body.first_name || '',
    last_name: body.last_name || '',
    phone: body.phone || '',
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    utm_content: body.utm_content || '',
    utm_term: body.utm_term || '',
    page_url: body.page_url || '',
    fbclid: body.fbclid || '',
    gclid: body.gclid || '',
    video_milestone: body.video_milestone || '',
    deal_value: body.deal_value || '',
    ad_campaign: body.ad_campaign || '',
    ad_set: body.ad_set || '',
    ad_creative: body.ad_creative || '',
    metadata: body.metadata || {},
    event_id: body.event_id || `man_${Date.now()}`,
    date_only: (body.timestamp || new Date().toISOString()).split('T')[0],
  }];
}

// ═══════════════════════════════════════════════════════════════════════
// GET ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════

async function handlePing() {
  return {
    status: 'ok',
    service: 'VSL Funnel Tracker API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sheet_id: SPREADSHEET_ID ? 'configured' : 'missing',
    sheets_client: getSheetsClient() ? 'connected' : 'disconnected',
    endpoints: {
      get: ['ping', 'dashboard_data', 'funnel_summary', 'lead_journey', 'test_connections', 'sync_meta'],
      post: ['tracking', 'typeform', 'jotform', 'tally', 'ghl', 'calendly', 'ghl_calendar', 'close', 'hubspot', 'manual', 'make', 'n8n', 'zapier', 'import_ads'],
    },
  };
}

async function handleDashboardData() {
  const funnelFlow = await readSheetRange(FUNNEL_FLOW_TAB, 'A3:F14');
  const config = await readSheetRange(CONFIG_TAB, 'A1:B30');

  return {
    status: 'ok',
    funnel_flow: funnelFlow || [],
    config: config || [],
    fetched_at: new Date().toISOString(),
  };
}

async function handleFunnelSummary() {
  const data = await readSheetRange(FUNNEL_FLOW_TAB, 'A3:F14');
  if (!data) return { status: 'error', message: 'Could not read funnel flow' };

  const stages = {};
  for (const row of data) {
    stages[row[0] || ''] = {
      count: row[1] || 0,
      previous: row[2] || 0,
      conversion_rate: row[3] || '',
      benchmark: row[4] || '',
      status: row[5] || '',
    };
  }
  return { status: 'ok', stages, fetched_at: new Date().toISOString() };
}

async function handleLeadJourney(email) {
  if (!email) return { status: 'error', message: 'Email parameter required' };

  const allRows = await readSheetRange(LEAD_JOURNEYS_TAB, 'A2:W15000');
  if (!allRows) return { status: 'error', message: 'Could not read lead journeys' };

  const events = allRows
    .filter(row => row[1] === email)
    .map(row => ({
      timestamp: row[0],
      email: row[1],
      event_type: row[2],
      event_source: row[3],
      first_name: row[4],
      last_name: row[5],
      utm_source: row[7],
      utm_campaign: row[9],
      page_url: row[12],
      video_milestone: row[15],
      deal_value: row[16],
    }));

  return {
    status: 'ok',
    email,
    total_events: events.length,
    events,
    fetched_at: new Date().toISOString(),
  };
}

async function handleTestConnections() {
  const results = {
    google_sheets: getSheetsClient() ? 'connected' : 'no_credentials',
    meta_ads: META_ACCESS_TOKEN ? 'token_set' : 'not_configured',
    spreadsheet_id: SPREADSHEET_ID ? 'set' : 'missing',
    api_secret: API_SECRET ? 'set' : 'missing',
  };

  // Test sheet write
  if (results.google_sheets === 'connected') {
    const testRead = await readSheetRange(CONFIG_TAB, 'A1:B1');
    results.sheet_readable = testRead ? 'yes' : 'no';
  }

  return { status: 'ok', connections: results, checked_at: new Date().toISOString() };
}

// ── Meta Ads API Sync ──────────────────────────────────────────────────
async function handleSyncMeta() {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { status: 'error', message: 'META_ACCESS_TOKEN and META_AD_ACCOUNT_ID required' };
  }

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const since = thirtyDaysAgo.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];

  try {
    const url = `https://graph.facebook.com/v19.0/${META_AD_ACCOUNT_ID}/insights?` +
      `fields=campaign_name,adset_name,ad_name,impressions,clicks,spend,actions&` +
      `time_range={"since":"${since}","until":"${until}"}&` +
      `time_increment=1&level=ad&limit=500&` +
      `access_token=${META_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      return { status: 'error', message: json.error.message };
    }

    const rows = (json.data || []).map(item => {
      const leads = (item.actions || []).find(a => a.action_type === 'lead')?.value || 0;
      return [
        item.date_start,        // Date
        'meta',                 // Platform
        item.campaign_name,     // Campaign
        item.adset_name,        // Ad Set
        item.ad_name,           // Ad Name
        item.impressions,       // Impressions
        item.clicks,            // Clicks
        '',                     // CTR (formula in sheet)
        item.spend,             // Spend
        leads,                  // Leads
        '',                     // CPL (formula)
        '',                     // CPA
        '',                     // ROAS
        'api_sync',             // Source
        '',                     // Notes
      ];
    });

    // Clear existing API sync rows and write fresh
    await clearSheetRange(AD_METRICS_TAB, 'A3:O200');
    if (rows.length > 0) {
      await updateSheetRange(AD_METRICS_TAB, 'A3', rows);
    }

    return { status: 'ok', rows_synced: rows.length, date_range: { since, until } };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

// ── CSV Ad Import Handler ──────────────────────────────────────────────
async function handleAdImport(body) {
  const platform = body.platform || 'meta';
  const csvData = body.data || [];

  if (!Array.isArray(csvData) || csvData.length === 0) {
    return { status: 'error', message: 'data array required with CSV rows' };
  }

  // Map platform-specific columns to unified format
  const rows = csvData.map(row => {
    const mapped = mapAdRow(row, platform);
    return [
      mapped.date,
      platform,
      mapped.campaign,
      mapped.ad_set,
      mapped.ad_name,
      mapped.impressions,
      mapped.clicks,
      '',  // CTR (formula)
      mapped.spend,
      mapped.leads,
      '',  // CPL (formula)
      '',  // CPA
      '',  // ROAS
      'csv_import',
      '',
    ];
  });

  const result = await appendToSheet(AD_METRICS_TAB, rows);
  return { status: 'ok', rows_imported: rows.length, write_result: result };
}

function mapAdRow(row, platform) {
  // Platform-specific column mapping
  switch (platform) {
    case 'meta':
      return {
        date: row['Date'] || row['date'] || row['Day'] || '',
        campaign: row['Campaign Name'] || row['campaign_name'] || '',
        ad_set: row['Ad Set Name'] || row['adset_name'] || '',
        ad_name: row['Ad Name'] || row['ad_name'] || '',
        impressions: row['Impressions'] || row['impressions'] || 0,
        clicks: row['Link Clicks'] || row['Clicks'] || row['clicks'] || 0,
        spend: row['Amount Spent'] || row['Spend'] || row['spend'] || 0,
        leads: row['Results'] || row['Leads'] || row['leads'] || 0,
      };
    case 'youtube':
      return {
        date: row['Date'] || row['Day'] || '',
        campaign: row['Campaign'] || row['campaign'] || '',
        ad_set: row['Ad Group'] || row['ad_group'] || '',
        ad_name: row['Ad Name'] || row['ad_name'] || '',
        impressions: row['Impressions'] || row['Impr.'] || 0,
        clicks: row['Clicks'] || row['clicks'] || 0,
        spend: row['Cost'] || row['cost'] || 0,
        leads: row['Conversions'] || row['conversions'] || 0,
      };
    case 'google':
      return {
        date: row['Day'] || row['Date'] || '',
        campaign: row['Campaign'] || '',
        ad_set: row['Ad group'] || row['Ad Group'] || '',
        ad_name: row['Headlines'] || row['Ad'] || '',
        impressions: row['Impr.'] || row['Impressions'] || 0,
        clicks: row['Clicks'] || 0,
        spend: row['Cost'] || row['Spend'] || 0,
        leads: row['Conversions'] || row['Conv.'] || 0,
      };
    case 'tiktok':
      return {
        date: row['Date'] || '',
        campaign: row['Campaign name'] || row['Campaign'] || '',
        ad_set: row['Ad Group name'] || row['Ad Group'] || '',
        ad_name: row['Ad name'] || row['Ad'] || '',
        impressions: row['Impression'] || row['Impressions'] || 0,
        clicks: row['Click'] || row['Clicks'] || 0,
        spend: row['Total cost'] || row['Spend'] || 0,
        leads: row['Conversions'] || row['Result'] || 0,
      };
    default:
      return {
        date: row['Date'] || '',
        campaign: row['Campaign'] || '',
        ad_set: row['Ad Set'] || '',
        ad_name: row['Ad Name'] || '',
        impressions: row['Impressions'] || 0,
        clicks: row['Clicks'] || 0,
        spend: row['Spend'] || 0,
        leads: row['Leads'] || 0,
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Access-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, source, email } = req.query || {};

  try {
    // ── GET Requests ──
    if (req.method === 'GET') {
      switch (action) {
        case 'ping':
          return res.json(await handlePing());
        case 'auth_check':
          return res.json({
            password_required: !!ACCESS_PASSWORD,
            authorised: isAuthorised(req),
            brand_name: BRAND_NAME,
            brand_tagline: BRAND_TAGLINE,
          });
      }
      // Everything below reads lead data, so it respects the optional password.
      if (!isAuthorised(req)) {
        return res.status(401).json({ error: 'Password required. Send it in the X-Access-Password header.' });
      }
      switch (action) {
        case 'dashboard_data':
          return res.json(await handleDashboardData());
        case 'funnel_summary':
          return res.json(await handleFunnelSummary());
        case 'lead_journey':
          return res.json(await handleLeadJourney(email));
        case 'test_connections':
          return res.json(await handleTestConnections());
        case 'sync_meta':
          return res.json(await handleSyncMeta());
        default:
          return res.status(400).json({ error: 'Unknown action. Use: ping, auth_check, dashboard_data, funnel_summary, lead_journey, test_connections, sync_meta' });
      }
    }

    // ── POST Requests ──
    if (req.method === 'POST') {
      const body = req.body || {};

      // Auth check for tracking snippet (other webhooks use platform-specific verification)
      if (source === 'tracking' && API_SECRET) {
        const providedSecret = req.headers['x-api-key'] || body.api_secret || '';
        if (providedSecret !== API_SECRET) {
          return res.status(401).json({ error: 'Invalid API secret' });
        }
      }

      // CSV import handler (respects the optional password)
      if (action === 'import_ads') {
        if (!isAuthorised(req)) {
          return res.status(401).json({ error: 'Password required. Send it in the X-Access-Password header.' });
        }
        return res.json(await handleAdImport(body));
      }

      // Webhook adapter routing
      let events = [];
      switch (source) {
        case 'tracking':
          events = adaptTracking(body);
          break;
        case 'typeform':
          events = adaptTypeform(body);
          break;
        case 'jotform':
          events = adaptJotform(body);
          break;
        case 'tally':
          events = adaptTally(body);
          break;
        case 'ghl':
          events = adaptGHL(body);
          break;
        case 'calendly':
          events = adaptCalendly(body);
          break;
        case 'ghl_calendar':
          events = adaptGHLCalendar(body);
          break;
        case 'close':
          events = adaptClose(body);
          break;
        case 'hubspot':
          events = adaptHubSpot(body);
          break;
        case 'manual':
          events = adaptManual(body);
          break;
        case 'make':
          events = adaptMake(body);
          break;
        case 'n8n':
          events = adaptN8N(body);
          break;
        case 'zapier':
          events = adaptZapier(body);
          break;
        default:
          return res.status(400).json({ error: 'Unknown source. Use: tracking, typeform, jotform, tally, ghl, calendly, ghl_calendar, close, hubspot, manual, make, n8n, zapier' });
      }

      // Write events to LEAD JOURNEYS
      const result = await writeEvents(events);

      return res.json({
        status: 'ok',
        source,
        events_received: events.length,
        write_result: result,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[API] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
