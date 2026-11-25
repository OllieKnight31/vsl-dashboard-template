/**
 * VSL FUNNEL TRACKING SYSTEM — Google Apps Script
 * ================================================
 * The ultimate VSL funnel tracker with per-lead journey tracking.
 * Builds a complete 11-tab tracking spreadsheet.
 *
 * HOW TO USE:
 * 1. Open a new Google Sheets file
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire script into the editor
 * 4. Save (Ctrl+S / Cmd+S)
 * 5. Click the Run button (>) with buildVSLTracker selected
 * 6. Authorise permissions when prompted
 * 7. Return to your spreadsheet — all tabs will be built automatically
 *
 * TABS CREATED:
 *   📊 DASHBOARD            — KPI cards, funnel flow, RAG status, week-on-week
 *   📢 AD METRICS           — Multi-platform ad data (unified columns)
 *   🎯 FUNNEL FLOW          — 12-stage conversion rates vs dynamic benchmarks
 *   📅 DAILY LOG            — Day-by-day counts auto-calculated from LEAD JOURNEYS
 *   🎥 VSL ANALYTICS        — Video play rate, milestone distribution, drop-off
 *   📱 NURTURE METRICS      — Email + SMS/WhatsApp performance
 *   💰 REVENUE METRICS      — Deal tracking, ROAS, RPL, LTV, attribution
 *   🔍 DISCREPANCY ANALYSER — 8 auto-detected bottlenecks with prescribed actions
 *   📈 BENCHMARKS           — Mid/High/Ultra-high tiers with dynamic lookup
 *   👤 LEAD JOURNEYS        — Per-lead event log (hidden, source of truth)
 *   ⚙️ CONFIG               — Client settings, platform config, API keys
 */

// ─────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────
var COLOURS = {
  headerBg:      "#1a73e8",
  headerText:    "#ffffff",
  goodBg:        "#e6f4ea",
  goodText:      "#137333",
  watchBg:       "#fff3e0",
  watchText:     "#b45309",
  badBg:         "#fce8e6",
  badText:       "#c5221f",
  criticalBg:    "#880000",
  criticalText:  "#ffffff",
  inputBg:       "#fff9c4",
  inputText:     "#333333",
  subheaderBg:   "#e8f0fe",
  subheaderText: "#1a73e8",
  sectionBg:     "#f8f9fa",
  sectionText:   "#202124",
  totalsBg:      "#e2eafc",
  protectBg:     "#f1f3f4",
  borderColor:   "#dadce0",
  tabBlue:       "#4285f4",
  tabGreen:      "#34a853",
  tabOrange:     "#fbbc04",
  tabRed:        "#ea4335",
  tabPurple:     "#9c27b0",
  tabTeal:       "#00897b",
  tabGrey:       "#607d8b",
  tabPink:       "#e91e63",
  tabBlack:      "#333333"
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
var MAX_LEAD_ROWS = 15000;
var DAILY_LOG_DAYS = 90;
var VSL_ANALYTICS_DAYS = 90;

// ─────────────────────────────────────────────
// MAIN ENTRY FUNCTION
// ─────────────────────────────────────────────
function buildVSLTracker() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename("VSL Funnel Tracker");

  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet) {
    if (ss.getSheets().length === 1) {
      defaultSheet.setName("_temp");
    } else {
      ss.deleteSheet(defaultSheet);
    }
  }

  // Build all tabs in order
  buildConfig(ss);
  buildLeadJourneys(ss);
  buildDashboard(ss);
  buildAdMetrics(ss);
  buildFunnelFlow(ss);
  buildDailyLog(ss);
  buildVSLAnalytics(ss);
  buildNurtureMetrics(ss);
  buildRevenueMetrics(ss);
  buildDiscrepancyAnalyser(ss);
  buildBenchmarks(ss);

  // Hide LEAD JOURNEYS tab
  var ljSheet = ss.getSheetByName("👤 LEAD JOURNEYS");
  if (ljSheet) ljSheet.hideSheet();

  // Remove temp sheet
  var tempSheet = ss.getSheetByName("_temp");
  if (tempSheet) ss.deleteSheet(tempSheet);

  // Navigate to Dashboard
  ss.setActiveSheet(ss.getSheetByName("📊 DASHBOARD"));
  SpreadsheetApp.flush();

  Browser.msgBox(
    "VSL Funnel Tracker built successfully!\n\n" +
    "All 11 tabs have been created.\n\n" +
    "START HERE:\n" +
    "1. Fill in the CONFIG tab with your client details\n" +
    "2. Deploy the Vercel API (see SETUP-GUIDE.md)\n" +
    "3. Install the tracking snippet on your funnel pages\n" +
    "4. Connect your webhooks (Typeform, Calendly, CRM)\n\n" +
    "Data will flow automatically into LEAD JOURNEYS,\n" +
    "and all other tabs will auto-calculate."
  );
}

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clear();
  sheet.clearConditionalFormatRules();
  return sheet;
}

function styleHeader(sheet, row, col, numCols, text) {
  var range = sheet.getRange(row, col, 1, numCols);
  range.merge()
       .setValue(text)
       .setBackground(COLOURS.headerBg)
       .setFontColor(COLOURS.headerText)
       .setFontWeight("bold")
       .setFontSize(14)
       .setHorizontalAlignment("center")
       .setVerticalAlignment("middle");
  sheet.setRowHeight(row, 40);
}

function styleSubHeader(sheet, row, col, numCols, text) {
  var range = sheet.getRange(row, col, 1, numCols);
  range.merge()
       .setValue(text)
       .setBackground(COLOURS.subheaderBg)
       .setFontColor(COLOURS.subheaderText)
       .setFontWeight("bold")
       .setFontSize(11)
       .setHorizontalAlignment("left");
  sheet.setRowHeight(row, 28);
}

function styleColumnHeaders(sheet, row, headers, startCol) {
  startCol = startCol || 1;
  for (var i = 0; i < headers.length; i++) {
    var cell = sheet.getRange(row, startCol + i);
    cell.setValue(headers[i])
        .setBackground(COLOURS.headerBg)
        .setFontColor(COLOURS.headerText)
        .setFontWeight("bold")
        .setFontSize(9)
        .setHorizontalAlignment("center")
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  }
  sheet.setRowHeight(row, 32);
}

function setInputRows(sheet, startRow, numRows, startCol, numCols) {
  var range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setBackground(COLOURS.inputBg);
}

function addBorders(sheet, startRow, numRows, startCol, numCols) {
  var range = sheet.getRange(startRow, startCol, numRows, numCols);
  range.setBorder(true, true, true, true, true, true, COLOURS.borderColor, SpreadsheetApp.BorderStyle.SOLID);
}

function setColWidths(sheet, widths) {
  for (var i = 0; i < widths.length; i++) {
    if (widths[i] > 0) sheet.setColumnWidth(i + 1, widths[i]);
  }
}

function addRAGConditionalFormatting(sheet, range) {
  var rules = sheet.getConditionalFormatRules();

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("On Track")
    .setBackground(COLOURS.goodBg).setFontColor(COLOURS.goodText)
    .setRanges([range]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Watch")
    .setBackground(COLOURS.watchBg).setFontColor(COLOURS.watchText)
    .setRanges([range]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Danger")
    .setBackground(COLOURS.badBg).setFontColor(COLOURS.badText)
    .setRanges([range]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Critical")
    .setBackground(COLOURS.criticalBg).setFontColor(COLOURS.criticalText)
    .setRanges([range]).build());

  sheet.setConditionalFormatRules(rules);
}

// ─────────────────────────────────────────────
// TAB: ⚙️ CONFIG
// ─────────────────────────────────────────────
function buildConfig(ss) {
  var sheet = getOrCreateSheet(ss, "⚙️ CONFIG");
  sheet.setTabColor(COLOURS.tabBlack);
  sheet.setFrozenRows(1);

  styleHeader(sheet, 1, 1, 4, "⚙️ VSL FUNNEL TRACKER — CONFIGURATION");

  var settings = [
    ["", "", "", ""],
    ["CLIENT DETAILS", "", "", ""],
    ["Client Name", "", "", "Enter client/business name"],
    ["Offer Name", "", "", "e.g. Elite Coaching Programme"],
    ["Price Tier", "high", "", "Options: mid, high, ultra_high"],
    ["Offer Price", "", "", "e.g. 8000"],
    ["Currency Symbol", "\u00a3", "", "\u00a3, $, \u20ac etc."],
    ["", "", "", ""],
    ["DEPLOYMENT", "", "", ""],
    ["Webhook URL", "", "", "Auto-filled after Vercel deploy"],
    ["Spreadsheet ID", "", "", "Auto-filled by script (see below)"],
    ["API Secret", "", "", "Shared secret for webhook auth"],
    ["", "", "", ""],
    ["TRACKING PIXELS", "", "", ""],
    ["Meta Pixel ID", "", "", "15-16 digit number from Events Manager"],
    ["GA4 Measurement ID", "", "", "e.g. G-XXXXXXXXXX"],
    ["", "", "", ""],
    ["PLATFORM CONFIG", "", "", ""],
    ["Video Platform", "auto", "", "auto, vidalytics, wistia, youtube, vimeo"],
    ["Form Platform", "typeform", "", "typeform, jotform, ghl, tally"],
    ["Booking Platform", "calendly", "", "calendly, ghl_calendar"],
    ["CRM Platform", "ghl", "", "ghl, close, hubspot"],
    ["", "", "", ""],
    ["API KEYS (keep private)", "", "", ""],
    ["Google Service Account Email", "", "", "From GCP console"],
    ["Meta Access Token", "", "", "For Meta Ads API sync"],
    ["Calendly PAT", "", "", "Personal Access Token"],
    ["GHL API Key", "", "", "Private Integration Token"],
    ["Close API Key", "", "", "Close.com API key"],
    ["HubSpot Access Token", "", "", "Private app token"]
  ];

  var headerRows = [2, 9, 14, 18, 24];
  var configHeaders = ["Setting", "Value", "", "Notes"];
  styleColumnHeaders(sheet, 2, configHeaders);

  for (var i = 0; i < settings.length; i++) {
    var r = i + 2;
    var row = settings[i];
    sheet.getRange(r, 1).setValue(row[0]);
    sheet.getRange(r, 2).setValue(row[1]);
    sheet.getRange(r, 4).setValue(row[3]).setFontColor("#888888").setFontStyle("italic");

    if (headerRows.indexOf(i) >= 0) {
      sheet.getRange(r, 1, 1, 4).setBackground(COLOURS.subheaderBg)
        .setFontColor(COLOURS.subheaderText).setFontWeight("bold");
    } else if (row[0] !== "" && row[0].indexOf("API") < 0) {
      sheet.getRange(r, 2).setBackground(COLOURS.inputBg);
    }
  }

  // Auto-fill Spreadsheet ID
  sheet.getRange(12, 2).setValue(ss.getId());

  // Data validation for Price Tier
  var tierRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["mid", "high", "ultra_high"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(6, 2).setDataValidation(tierRule);

  // Data validation for Video Platform
  var videoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["auto", "vidalytics", "wistia", "youtube", "vimeo"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(20, 2).setDataValidation(videoRule);

  // Data validation for Form Platform
  var formRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["typeform", "jotform", "ghl", "tally"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(21, 2).setDataValidation(formRule);

  // Data validation for Booking Platform
  var bookingRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["calendly", "ghl_calendar"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(22, 2).setDataValidation(bookingRule);

  // Data validation for CRM Platform
  var crmRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["ghl", "close", "hubspot"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(23, 2).setDataValidation(crmRule);

  setColWidths(sheet, [260, 300, 20, 350]);
}

// ─────────────────────────────────────────────
// TAB: 👤 LEAD JOURNEYS (Hidden — Source of Truth)
// ─────────────────────────────────────────────
function buildLeadJourneys(ss) {
  var sheet = getOrCreateSheet(ss, "👤 LEAD JOURNEYS");
  sheet.setTabColor(COLOURS.tabGrey);
  sheet.setFrozenRows(1);

  var headers = [
    "Timestamp",          // A
    "Email",              // B
    "Event Type",         // C
    "Event Source",       // D
    "First Name",         // E
    "Last Name",          // F
    "Phone",              // G
    "UTM Source",         // H
    "UTM Medium",         // I
    "UTM Campaign",       // J
    "UTM Content",        // K
    "UTM Term",           // L
    "Page URL",           // M
    "FBCLID",             // N
    "GCLID",              // O
    "Video Milestone",    // P
    "Deal Value",         // Q
    "Ad Campaign",        // R
    "Ad Set",             // S
    "Ad Creative",        // T
    "Metadata (JSON)",    // U
    "Event ID",           // V
    "Date Only"           // W — helper for COUNTIFS
  ];

  styleColumnHeaders(sheet, 1, headers);

  // Format columns
  sheet.getRange("A2:A" + MAX_LEAD_ROWS).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sheet.getRange("Q2:Q" + MAX_LEAD_ROWS).setNumberFormat("#,##0.00");
  sheet.getRange("W2:W" + MAX_LEAD_ROWS).setNumberFormat("yyyy-mm-dd");

  // Data validation for Event Type
  var eventTypes = [
    "page_view", "optin", "vsl_page_view", "vsl_play",
    "vsl_milestone_25", "vsl_milestone_50", "vsl_milestone_75", "vsl_milestone_100",
    "cta_click", "application_view", "application_submit",
    "booking_page_view", "booking_confirmed", "booking_cancelled", "booking_rescheduled",
    "show", "no_show", "close", "purchase"
  ];
  var eventRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(eventTypes, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange("C2:C" + MAX_LEAD_ROWS).setDataValidation(eventRule);

  setColWidths(sheet, [160, 200, 140, 100, 100, 100, 120, 100, 100, 160, 140, 120, 200, 100, 100, 80, 100, 160, 140, 140, 250, 200, 100]);
}

// ─────────────────────────────────────────────
// TAB: 📊 DASHBOARD
// ─────────────────────────────────────────────
function buildDashboard(ss) {
  var sheet = getOrCreateSheet(ss, "📊 DASHBOARD");
  sheet.setTabColor(COLOURS.tabBlue);
  sheet.setFrozenRows(1);

  var totalCols = 10;

  // Row 1: Title
  styleHeader(sheet, 1, 1, totalCols, "📊 VSL FUNNEL TRACKER — MASTER DASHBOARD");

  // Row 2: Subtitle
  sheet.getRange(2, 1, 1, totalCols).merge()
    .setValue("Client: =IFERROR('⚙️ CONFIG'!B4,\"Not configured\")  |  Last Updated: " + new Date().toLocaleDateString("en-GB"))
    .setBackground(COLOURS.sectionBg)
    .setFontSize(9)
    .setHorizontalAlignment("center");

  // ── SECTION: KEY METRICS ──
  styleSubHeader(sheet, 4, 1, totalCols, "  KEY PERFORMANCE INDICATORS");

  var metricHeaders = ["Metric", "Actual", "Benchmark", "Status", "Notes"];
  styleColumnHeaders(sheet, 5, metricHeaders);

  var metrics = [
    ["Opt-in Rate",          "='🎯 FUNNEL FLOW'!D6",  "='🎯 FUNNEL FLOW'!E6"],
    ["VSL Play Rate",        "='🎯 FUNNEL FLOW'!D8",  "='🎯 FUNNEL FLOW'!E8"],
    ["VSL Completion Rate",  "='🎯 FUNNEL FLOW'!D9",  "='🎯 FUNNEL FLOW'!E9"],
    ["Application Rate",     "='🎯 FUNNEL FLOW'!D11", "='🎯 FUNNEL FLOW'!E11"],
    ["Booking Rate",         "='🎯 FUNNEL FLOW'!D12", "='🎯 FUNNEL FLOW'!E12"],
    ["Show Rate",            "='🎯 FUNNEL FLOW'!D13", "='🎯 FUNNEL FLOW'!E13"],
    ["Close Rate",           "='🎯 FUNNEL FLOW'!D14", "='🎯 FUNNEL FLOW'!E14"],
    ["ROAS",                 "=IFERROR('💰 REVENUE METRICS'!B5/'📢 AD METRICS'!I53,\"\")", "='📈 BENCHMARKS'!C40"]
  ];

  for (var i = 0; i < metrics.length; i++) {
    var r = 6 + i;
    sheet.getRange(r, 1).setValue(metrics[i][0]).setFontWeight("bold");
    sheet.getRange(r, 2).setFormula(metrics[i][1]).setNumberFormat("0.0%").setHorizontalAlignment("center");
    sheet.getRange(r, 3).setFormula(metrics[i][2]).setNumberFormat("0.0%").setHorizontalAlignment("center");
    var statusFormula = '=IF(B' + r + '="","--",IF(B' + r + '>=C' + r + ',"' + String.fromCharCode(9989) + ' On Track",IF(B' + r + '>=C' + r + '*0.8,"' + String.fromCharCode(9888) + String.fromCharCode(65039) + ' Watch","' + String.fromCharCode(128308) + ' Danger")))';
    sheet.getRange(r, 4).setFormula(statusFormula).setHorizontalAlignment("center");
    sheet.getRange(r, 5).setBackground(COLOURS.inputBg);
    addBorders(sheet, r, 1, 1, 5);
  }

  // ROAS row — different format
  sheet.getRange(13, 2).setNumberFormat("0.0x");
  sheet.getRange(13, 3).setNumberFormat("0.0x");

  addRAGConditionalFormatting(sheet, sheet.getRange("D6:D13"));

  // ── SECTION: FUNNEL FLOW VISUAL ──
  styleSubHeader(sheet, 15, 1, totalCols, "  FUNNEL FLOW (Visual Summary)");

  var flowHeaders = ["Stage", "Count", "Conversion Rate", "Benchmark", "Status"];
  styleColumnHeaders(sheet, 16, flowHeaders);

  var flowStages = [
    ["Ad Impressions",  "='🎯 FUNNEL FLOW'!B3"],
    ["Ad Clicks",       "='🎯 FUNNEL FLOW'!B4"],
    ["Landing Page",    "='🎯 FUNNEL FLOW'!B5"],
    ["Opt-ins",         "='🎯 FUNNEL FLOW'!B6"],
    ["VSL Page Views",  "='🎯 FUNNEL FLOW'!B7"],
    ["VSL Plays",       "='🎯 FUNNEL FLOW'!B8"],
    ["VSL Completions", "='🎯 FUNNEL FLOW'!B9"],
    ["CTA Clicks",      "='🎯 FUNNEL FLOW'!B10"],
    ["Applications",    "='🎯 FUNNEL FLOW'!B11"],
    ["Bookings",        "='🎯 FUNNEL FLOW'!B12"],
    ["Shows",           "='🎯 FUNNEL FLOW'!B13"],
    ["CLOSED",          "='🎯 FUNNEL FLOW'!B14"]
  ];

  for (var j = 0; j < flowStages.length; j++) {
    var fr = 17 + j;
    var arrow = j === 0 ? "" : "  -> ";
    sheet.getRange(fr, 1).setValue(arrow + flowStages[j][0]).setFontWeight("bold");
    sheet.getRange(fr, 2).setFormula(flowStages[j][1]).setNumberFormat("#,##0");
    var ffRow = 3 + j;
    sheet.getRange(fr, 3).setFormula("='🎯 FUNNEL FLOW'!D" + ffRow).setNumberFormat("0.0%");
    sheet.getRange(fr, 4).setFormula("='🎯 FUNNEL FLOW'!E" + ffRow).setNumberFormat("0.0%");
    sheet.getRange(fr, 5).setFormula("='🎯 FUNNEL FLOW'!F" + ffRow).setHorizontalAlignment("center");
  }

  addRAGConditionalFormatting(sheet, sheet.getRange("E17:E28"));

  // ── SECTION: THIS WEEK AT A GLANCE ──
  styleSubHeader(sheet, 30, 1, totalCols, "  THIS WEEK AT A GLANCE");

  var weekHeaders = ["Metric", "This Week", "Last Week", "Change"];
  styleColumnHeaders(sheet, 31, weekHeaders);

  var weekMetrics = ["New Leads", "VSL Plays", "Applications", "Calls Booked", "Calls Showed", "Sales", "Revenue", "Ad Spend", "CPL", "ROAS"];
  for (var k = 0; k < weekMetrics.length; k++) {
    var wr = 32 + k;
    sheet.getRange(wr, 1).setValue(weekMetrics[k]);
    sheet.getRange(wr, 2).setBackground(COLOURS.inputBg);
    sheet.getRange(wr, 3).setBackground(COLOURS.inputBg);
    sheet.getRange(wr, 4).setFormula('=IF(OR(B' + wr + '="",C' + wr + '=""),"--",IF(C' + wr + '=0,"--",TEXT((B' + wr + '-C' + wr + ')/C' + wr + ',"0.0%")))');
  }

  // ── SECTION: REVENUE ATTRIBUTION ──
  styleSubHeader(sheet, 43, 1, totalCols, "  TOP CAMPAIGNS BY REVENUE (from LEAD JOURNEYS attribution)");

  styleColumnHeaders(sheet, 44, ["Rank", "Campaign", "Leads", "Closes", "Revenue", "Close Rate"]);

  for (var ra = 0; ra < 5; ra++) {
    var raRow = 45 + ra;
    sheet.getRange(raRow, 1).setValue(ra + 1);
    sheet.getRange(raRow, 2, 1, 5).setBackground(COLOURS.inputBg);
  }
  sheet.getRange(45, 2).setValue("(Populate from LEAD JOURNEYS once data flows)").setFontStyle("italic").setFontColor("#999999");

  setColWidths(sheet, [180, 120, 120, 140, 160, 120, 120, 120, 120, 120]);
}

// ─────────────────────────────────────────────
// TAB: 📢 AD METRICS
// ─────────────────────────────────────────────
function buildAdMetrics(ss) {
  var sheet = getOrCreateSheet(ss, "📢 AD METRICS");
  sheet.setTabColor(COLOURS.tabOrange);
  sheet.setFrozenRows(2);

  styleHeader(sheet, 1, 1, 15, "📢 AD METRICS — Multi-Platform Paid Traffic Performance");

  var headers = [
    "Date",             // A
    "Platform",         // B
    "Campaign Name",    // C
    "Ad Set / Ad Group",// D
    "Ad Name",          // E
    "Impressions",      // F
    "Clicks",           // G
    "CTR (%)",          // H
    "Ad Spend",         // I
    "Leads Generated",  // J
    "CPL",              // K
    "CPA",              // L
    "ROAS",             // M
    "Data Source",       // N
    "Notes"             // O
  ];
  styleColumnHeaders(sheet, 2, headers);

  var numInputRows = 50;
  setInputRows(sheet, 3, numInputRows, 1, 15);

  // Platform data validation
  var platformRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["meta", "youtube", "google", "tiktok"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange("B3:B" + (2 + numInputRows)).setDataValidation(platformRule);

  // Data Source validation
  var sourceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["api_sync", "csv_import", "manual"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange("N3:N" + (2 + numInputRows)).setDataValidation(sourceRule);

  // Formulas for calculated columns
  for (var i = 3; i < 3 + numInputRows; i++) {
    // CTR = Clicks / Impressions
    sheet.getRange(i, 8).setFormula('=IF(OR(G' + i + '="",F' + i + '="",F' + i + '=0),"",G' + i + '/F' + i + ')').setNumberFormat("0.00%");
    // CPL = Spend / Leads
    sheet.getRange(i, 11).setFormula('=IF(OR(I' + i + '="",J' + i + '="",J' + i + '=0),"",I' + i + '/J' + i + ')').setNumberFormat("#,##0.00");
    // CPA and ROAS left blank (populated when close data available)
    sheet.getRange(i, 1).setNumberFormat("yyyy-mm-dd");
    sheet.getRange(i, 9).setNumberFormat("#,##0.00");
    sheet.getRange(i, 6).setNumberFormat("#,##0");
    sheet.getRange(i, 7).setNumberFormat("#,##0");
    sheet.getRange(i, 10).setNumberFormat("#,##0");
  }

  // Totals row
  var totalsRow = 3 + numInputRows;
  sheet.getRange(totalsRow, 1).setValue("TOTALS").setFontWeight("bold");
  sheet.getRange(totalsRow, 1, 1, 15).setBackground(COLOURS.totalsBg).setFontWeight("bold");

  var sumCols = [6, 7, 9, 10];
  for (var sc = 0; sc < sumCols.length; sc++) {
    var col = sumCols[sc];
    var letter = String.fromCharCode(64 + col);
    sheet.getRange(totalsRow, col).setFormula('=SUM(' + letter + '3:' + letter + (totalsRow - 1) + ')');
  }
  sheet.getRange(totalsRow, 8).setFormula('=IF(F' + totalsRow + '=0,"",G' + totalsRow + '/F' + totalsRow + ')').setNumberFormat("0.00%");
  sheet.getRange(totalsRow, 11).setFormula('=IF(J' + totalsRow + '=0,"",I' + totalsRow + '/J' + totalsRow + ')').setNumberFormat("#,##0.00");

  setColWidths(sheet, [100, 80, 200, 160, 160, 110, 80, 80, 110, 110, 90, 90, 80, 90, 200]);
}

// ─────────────────────────────────────────────
// TAB: 🎯 FUNNEL FLOW
// ─────────────────────────────────────────────
function buildFunnelFlow(ss) {
  var sheet = getOrCreateSheet(ss, "🎯 FUNNEL FLOW");
  sheet.setTabColor(COLOURS.tabGreen);
  sheet.setFrozenRows(2);

  styleHeader(sheet, 1, 1, 7, "🎯 FUNNEL FLOW — Auto-Calculated from Lead Journeys");

  var headers = ["Funnel Stage", "Count", "Previous Stage", "Conversion Rate", "Benchmark", "Status", "Notes"];
  styleColumnHeaders(sheet, 2, headers);

  // Row data: stage name, count formula, benchmark lookup key
  var stages = [
    {
      name: "1. Ad Impressions",
      count: "=IFERROR(SUM('📢 AD METRICS'!F3:F999),0)",
      prev: "",
      benchKey: "Ad CTR"
    },
    {
      name: "2. Ad Clicks",
      count: "=IFERROR(SUM('📢 AD METRICS'!G3:G999),0)",
      prev: "B3",
      benchKey: "Ad CTR"
    },
    {
      name: "3. Landing Page Views",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"page_view\")",
      prev: "B4",
      benchKey: "Click to LP Rate"
    },
    {
      name: "4. Opt-ins",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"optin\")",
      prev: "B5",
      benchKey: "Opt-in Rate"
    },
    {
      name: "5. VSL Page Views",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"vsl_page_view\")",
      prev: "B6",
      benchKey: "Opt-in to VSL Rate"
    },
    {
      name: "6. VSL Plays",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"vsl_play\")",
      prev: "B7",
      benchKey: "VSL Play Rate"
    },
    {
      name: "7. VSL Completions",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"vsl_milestone_100\")",
      prev: "B8",
      benchKey: "VSL Completion Rate"
    },
    {
      name: "8. CTA Clicks",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"cta_click\")",
      prev: "B9",
      benchKey: "CTA Click Rate"
    },
    {
      name: "9. Applications",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"application_submit\")",
      prev: "B10",
      benchKey: "Application Rate"
    },
    {
      name: "10. Bookings",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"booking_confirmed\")",
      prev: "B11",
      benchKey: "Booking Rate"
    },
    {
      name: "11. Shows",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"show\")",
      prev: "B12",
      benchKey: "Show Rate"
    },
    {
      name: "12. Closes",
      count: "=COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"close\")",
      prev: "B13",
      benchKey: "Close Rate"
    }
  ];

  for (var i = 0; i < stages.length; i++) {
    var r = 3 + i;
    var s = stages[i];
    sheet.getRange(r, 1).setValue(s.name).setFontWeight("bold");
    sheet.getRange(r, 2).setFormula(s.count).setNumberFormat("#,##0");

    // Previous stage count (for conversion rate calc)
    if (s.prev) {
      sheet.getRange(r, 3).setFormula("=" + s.prev).setNumberFormat("#,##0").setFontColor("#999999");
    } else {
      sheet.getRange(r, 3).setValue("--").setHorizontalAlignment("center");
    }

    // Conversion rate
    if (s.prev) {
      sheet.getRange(r, 4).setFormula('=IF(OR(C' + r + '="",C' + r + '=0,B' + r + '=""),"",B' + r + '/C' + r + ')').setNumberFormat("0.0%");
    } else {
      sheet.getRange(r, 4).setValue("--").setHorizontalAlignment("center");
    }

    // Dynamic benchmark from BENCHMARKS tab
    // Using VLOOKUP with concatenated key: benchmark_name & price_tier
    sheet.getRange(r, 5).setFormula(
      '=IFERROR(VLOOKUP("' + s.benchKey + '"&\'⚙️ CONFIG\'!B6,\'📈 BENCHMARKS\'!E:F,2,FALSE),"")'
    ).setNumberFormat("0.0%");

    // RAG Status
    sheet.getRange(r, 6).setFormula(
      '=IF(D' + r + '="","--",IF(E' + r + '="","--",IF(D' + r + '>=E' + r + ',"' +
      String.fromCharCode(9989) + ' On Track",IF(D' + r + '>=E' + r + '*0.8,"' +
      String.fromCharCode(9888) + String.fromCharCode(65039) + ' Watch",IF(D' + r + '>=E' + r + '*0.6,"' +
      String.fromCharCode(128308) + ' Danger","' +
      String.fromCharCode(10060) + ' Critical")))))'
    ).setHorizontalAlignment("center");

    sheet.getRange(r, 7).setBackground(COLOURS.inputBg);
    addBorders(sheet, r, 1, 1, 7);
  }

  addRAGConditionalFormatting(sheet, sheet.getRange("F3:F14"));

  setColWidths(sheet, [200, 100, 120, 130, 110, 140, 200]);
}

// ─────────────────────────────────────────────
// TAB: 📅 DAILY LOG
// ─────────────────────────────────────────────
function buildDailyLog(ss) {
  var sheet = getOrCreateSheet(ss, "📅 DAILY LOG");
  sheet.setTabColor(COLOURS.tabTeal);
  sheet.setFrozenRows(2);

  styleHeader(sheet, 1, 1, 12, "📅 DAILY LOG — Auto-Calculated from Lead Journeys by Date");

  var headers = [
    "Date",                // A
    "New Leads\n(Opt-ins)",// B
    "VSL Plays",           // C
    "VSL\nCompletions",    // D
    "Applications",        // E
    "Bookings",            // F
    "Shows",               // G
    "Closes",              // H
    "Revenue",             // I
    "Ad Spend",            // J
    "CPL",                 // K
    "Notes"                // L
  ];
  styleColumnHeaders(sheet, 2, headers);

  var ljTab = "'👤 LEAD JOURNEYS'";
  var maxR = MAX_LEAD_ROWS;

  // Pre-populate 90 days of date rows with COUNTIFS formulas
  var today = new Date();
  var rowIdx = 3;

  for (var d = 0; d < DAILY_LOG_DAYS; d++) {
    // Weekly subtotal every 7 days
    if (d > 0 && d % 7 === 0) {
      var weekNum = Math.floor(d / 7);
      var weekStart = rowIdx - 7;
      var weekEnd = rowIdx - 1;
      sheet.getRange(rowIdx, 1).setValue("Week " + weekNum + " Total").setFontWeight("bold");
      sheet.getRange(rowIdx, 1, 1, 12).setBackground(COLOURS.totalsBg).setFontWeight("bold");

      for (var wc = 2; wc <= 10; wc++) {
        var wl = String.fromCharCode(64 + wc);
        sheet.getRange(rowIdx, wc).setFormula('=SUM(' + wl + weekStart + ':' + wl + weekEnd + ')');
      }
      // CPL for week
      sheet.getRange(rowIdx, 11).setFormula('=IF(B' + rowIdx + '=0,"",J' + rowIdx + '/B' + rowIdx + ')').setNumberFormat("#,##0.00");
      rowIdx++;
    }

    var date = new Date(today);
    date.setDate(date.getDate() - (DAILY_LOG_DAYS - 1 - d));
    var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");

    sheet.getRange(rowIdx, 1).setValue(date).setNumberFormat("yyyy-mm-dd");

    // COUNTIFS formulas for each event type by date
    var eventMap = {
      2: "optin",
      3: "vsl_play",
      4: "vsl_milestone_100",
      5: "application_submit",
      6: "booking_confirmed",
      7: "show",
      8: "close"
    };

    for (var col in eventMap) {
      var c = parseInt(col);
      var evt = eventMap[col];
      sheet.getRange(rowIdx, c).setFormula(
        '=COUNTIFS(' + ljTab + '!C2:C' + maxR + ',"' + evt + '",' + ljTab + '!W2:W' + maxR + ',"' + dateStr + '")'
      ).setNumberFormat("#,##0");
    }

    // Revenue = SUMIFS for close events on this date
    sheet.getRange(rowIdx, 9).setFormula(
      '=SUMIFS(' + ljTab + '!Q2:Q' + maxR + ',' + ljTab + '!C2:C' + maxR + ',"close",' + ljTab + '!W2:W' + maxR + ',"' + dateStr + '")'
    ).setNumberFormat("#,##0.00");

    // Ad Spend from AD METRICS
    sheet.getRange(rowIdx, 10).setFormula(
      "=SUMIFS('📢 AD METRICS'!I3:I999,'📢 AD METRICS'!A3:A999,A" + rowIdx + ")"
    ).setNumberFormat("#,##0.00");

    // CPL
    sheet.getRange(rowIdx, 11).setFormula('=IF(B' + rowIdx + '=0,"",J' + rowIdx + '/B' + rowIdx + ')').setNumberFormat("#,##0.00");

    sheet.getRange(rowIdx, 12).setBackground(COLOURS.inputBg);
    rowIdx++;
  }

  // Grand total row
  sheet.getRange(rowIdx, 1).setValue("GRAND TOTAL").setFontWeight("bold");
  sheet.getRange(rowIdx, 1, 1, 12).setBackground(COLOURS.headerBg).setFontColor(COLOURS.headerText).setFontWeight("bold");
  for (var gc = 2; gc <= 10; gc++) {
    var gl = String.fromCharCode(64 + gc);
    sheet.getRange(rowIdx, gc).setFormula('=SUM(' + gl + '3:' + gl + (rowIdx - 1) + ')');
  }
  sheet.getRange(rowIdx, 11).setFormula('=IF(B' + rowIdx + '=0,"",J' + rowIdx + '/B' + rowIdx + ')').setNumberFormat("#,##0.00");

  setColWidths(sheet, [100, 90, 90, 100, 110, 90, 80, 80, 110, 110, 90, 200]);
}

// ─────────────────────────────────────────────
// TAB: 🎥 VSL ANALYTICS
// ─────────────────────────────────────────────
function buildVSLAnalytics(ss) {
  var sheet = getOrCreateSheet(ss, "🎥 VSL ANALYTICS");
  sheet.setTabColor(COLOURS.tabPurple);
  sheet.setFrozenRows(2);

  var totalCols = 11;
  styleHeader(sheet, 1, 1, totalCols, "🎥 VSL ANALYTICS — Video Performance & Watch Time");

  // ── AGGREGATE SUMMARY (top) ──
  styleSubHeader(sheet, 2, 1, totalCols, "  OVERALL VIDEO METRICS");

  var summaryLabels = [
    "Total VSL Page Views", "Total Plays", "Play Rate",
    "25% Milestone", "50% Milestone", "75% Milestone", "100% (Complete)",
    "Completion Rate", "CTA Clicks", "CTA Rate"
  ];
  styleColumnHeaders(sheet, 3, summaryLabels);

  var ljTab = "'👤 LEAD JOURNEYS'";
  var maxR = MAX_LEAD_ROWS;

  // Summary formulas row
  sheet.getRange(4, 1).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_page_view\")").setNumberFormat("#,##0");
  sheet.getRange(4, 2).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_play\")").setNumberFormat("#,##0");
  sheet.getRange(4, 3).setFormula('=IF(A4=0,"",B4/A4)').setNumberFormat("0.0%");
  sheet.getRange(4, 4).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_milestone_25\")").setNumberFormat("#,##0");
  sheet.getRange(4, 5).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_milestone_50\")").setNumberFormat("#,##0");
  sheet.getRange(4, 6).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_milestone_75\")").setNumberFormat("#,##0");
  sheet.getRange(4, 7).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"vsl_milestone_100\")").setNumberFormat("#,##0");
  sheet.getRange(4, 8).setFormula('=IF(B4=0,"",G4/B4)').setNumberFormat("0.0%");
  sheet.getRange(4, 9).setFormula("=COUNTIFS(" + ljTab + "!C2:C" + maxR + ",\"cta_click\")").setNumberFormat("#,##0");
  sheet.getRange(4, 10).setFormula('=IF(A4=0,"",I4/A4)').setNumberFormat("0.0%");

  sheet.getRange(4, 1, 1, 10).setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center");
  sheet.setRowHeight(4, 36);

  // ── DROP-OFF ANALYSIS ──
  styleSubHeader(sheet, 6, 1, totalCols, "  VIDEO DROP-OFF FUNNEL (% of plays that reached each milestone)");

  var dropHeaders = ["Milestone", "Count", "% of Plays", "Drop-off from Previous"];
  styleColumnHeaders(sheet, 7, dropHeaders);

  var milestones = [
    ["Plays (Start)", "=B4", "=IF(B4=0,\"\",1)", ""],
    ["25% Watched", "=D4", "=IF(B4=0,\"\",D4/B4)", "=IF(B4=0,\"\",1-C9)"],
    ["50% Watched", "=E4", "=IF(B4=0,\"\",E4/B4)", "=IF(B4=0,\"\",C9-C10)"],
    ["75% Watched", "=F4", "=IF(B4=0,\"\",F4/B4)", "=IF(B4=0,\"\",C10-C11)"],
    ["100% Complete", "=G4", "=IF(B4=0,\"\",G4/B4)", "=IF(B4=0,\"\",C11-C12)"],
    ["CTA Click", "=I4", "=IF(B4=0,\"\",I4/B4)", "=IF(B4=0,\"\",C12-C13)"]
  ];

  for (var m = 0; m < milestones.length; m++) {
    var mr = 8 + m;
    sheet.getRange(mr, 1).setValue(milestones[m][0]).setFontWeight("bold");
    sheet.getRange(mr, 2).setFormula(milestones[m][1]).setNumberFormat("#,##0");
    sheet.getRange(mr, 3).setFormula(milestones[m][2]).setNumberFormat("0.0%");
    if (milestones[m][3]) {
      sheet.getRange(mr, 4).setFormula(milestones[m][3]).setNumberFormat("0.0%");
    }
    addBorders(sheet, mr, 1, 1, 4);
  }

  // ── DAILY VSL DATA ──
  styleSubHeader(sheet, 16, 1, totalCols, "  DAILY VSL METRICS (auto-calculated from Lead Journeys)");

  var dailyHeaders = [
    "Date", "Page Views", "Plays", "Play Rate",
    "25%", "50%", "75%", "100%",
    "Completion Rate", "CTA Clicks", "CTA Rate"
  ];
  styleColumnHeaders(sheet, 17, dailyHeaders);

  var today = new Date();
  for (var dd = 0; dd < 30; dd++) {
    var dr = 18 + dd;
    var dDate = new Date(today);
    dDate.setDate(dDate.getDate() - (29 - dd));
    var dStr = Utilities.formatDate(dDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

    sheet.getRange(dr, 1).setValue(dDate).setNumberFormat("yyyy-mm-dd");

    var vslEvents = ["vsl_page_view", "vsl_play", "", "vsl_milestone_25", "vsl_milestone_50", "vsl_milestone_75", "vsl_milestone_100", "", "cta_click"];
    var colMap = [2, 3, 0, 5, 6, 7, 8, 0, 10];

    for (var ve = 0; ve < vslEvents.length; ve++) {
      if (vslEvents[ve] === "") continue;
      var vc = colMap[ve];
      sheet.getRange(dr, vc).setFormula(
        '=COUNTIFS(' + ljTab + '!C2:C' + maxR + ',"' + vslEvents[ve] + '",' + ljTab + '!W2:W' + maxR + ',"' + dStr + '")'
      ).setNumberFormat("#,##0");
    }

    // Play Rate
    sheet.getRange(dr, 4).setFormula('=IF(B' + dr + '=0,"",C' + dr + '/B' + dr + ')').setNumberFormat("0.0%");
    // Completion Rate
    sheet.getRange(dr, 9).setFormula('=IF(C' + dr + '=0,"",H' + dr + '/C' + dr + ')').setNumberFormat("0.0%");
    // CTA Rate
    sheet.getRange(dr, 11).setFormula('=IF(B' + dr + '=0,"",J' + dr + '/B' + dr + ')').setNumberFormat("0.0%");
  }

  setColWidths(sheet, [100, 100, 80, 90, 70, 70, 70, 70, 110, 90, 90]);
}

// ─────────────────────────────────────────────
// TAB: 📱 NURTURE METRICS
// ─────────────────────────────────────────────
function buildNurtureMetrics(ss) {
  var sheet = getOrCreateSheet(ss, "📱 NURTURE METRICS");
  sheet.setTabColor(COLOURS.tabPink);
  sheet.setFrozenRows(1);

  styleHeader(sheet, 1, 1, 10, "📱 NURTURE METRICS — Email & SMS/WhatsApp Performance");

  // ── EMAIL SECTION ──
  styleSubHeader(sheet, 2, 1, 10, "  EMAIL METRICS");

  var emailHeaders = ["Date", "Email Name / Subject", "Sent", "Delivered", "Opens", "Open Rate (%)", "Clicks", "CTR (%)", "Unsubs", "Notes"];
  styleColumnHeaders(sheet, 3, emailHeaders);

  for (var i = 4; i <= 33; i++) {
    sheet.getRange(i, 1, 1, 10).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 6).setFormula('=IF(OR(C' + i + '="",C' + i + '=0,E' + i + '=""),"",E' + i + '/C' + i + ')').setNumberFormat("0.0%");
    sheet.getRange(i, 8).setFormula('=IF(OR(E' + i + '="",E' + i + '=0,G' + i + '=""),"",G' + i + '/E' + i + ')').setNumberFormat("0.0%");
  }

  // Email totals
  sheet.getRange(34, 1).setValue("EMAIL TOTALS").setFontWeight("bold");
  sheet.getRange(34, 1, 1, 10).setBackground(COLOURS.totalsBg).setFontWeight("bold");
  var emailSumCols = [3, 4, 5, 7, 9];
  for (var ec = 0; ec < emailSumCols.length; ec++) {
    var ecc = emailSumCols[ec];
    var el = String.fromCharCode(64 + ecc);
    sheet.getRange(34, ecc).setFormula('=SUM(' + el + '4:' + el + '33)');
  }
  sheet.getRange(34, 6).setFormula('=IF(C34=0,"",E34/C34)').setNumberFormat("0.0%");
  sheet.getRange(34, 8).setFormula('=IF(E34=0,"",G34/E34)').setNumberFormat("0.0%");

  // ── SMS / WHATSAPP SECTION ──
  styleSubHeader(sheet, 36, 1, 10, "  SMS / WHATSAPP METRICS");

  var smsHeaders = ["Date", "Message Name / Type", "Sent", "Delivered", "Replies", "Reply Rate (%)", "Clicks", "CTR (%)", "Opt-outs", "Notes"];
  styleColumnHeaders(sheet, 37, smsHeaders);

  for (var j = 38; j <= 57; j++) {
    sheet.getRange(j, 1, 1, 10).setBackground(COLOURS.inputBg);
    sheet.getRange(j, 6).setFormula('=IF(OR(C' + j + '="",C' + j + '=0,E' + j + '=""),"",E' + j + '/C' + j + ')').setNumberFormat("0.0%");
    sheet.getRange(j, 8).setFormula('=IF(OR(C' + j + '="",C' + j + '=0,G' + j + '=""),"",G' + j + '/C' + j + ')').setNumberFormat("0.0%");
  }

  // SMS totals
  sheet.getRange(58, 1).setValue("SMS TOTALS").setFontWeight("bold");
  sheet.getRange(58, 1, 1, 10).setBackground(COLOURS.totalsBg).setFontWeight("bold");
  var smsSumCols = [3, 4, 5, 7, 9];
  for (var sc2 = 0; sc2 < smsSumCols.length; sc2++) {
    var scc = smsSumCols[sc2];
    var sl = String.fromCharCode(64 + scc);
    sheet.getRange(58, scc).setFormula('=SUM(' + sl + '38:' + sl + '57)');
  }
  sheet.getRange(58, 6).setFormula('=IF(C58=0,"",E58/C58)').setNumberFormat("0.0%");
  sheet.getRange(58, 8).setFormula('=IF(C58=0,"",G58/C58)').setNumberFormat("0.0%");

  setColWidths(sheet, [100, 200, 80, 90, 80, 110, 80, 90, 90, 200]);
}

// ─────────────────────────────────────────────
// TAB: 💰 REVENUE METRICS
// ─────────────────────────────────────────────
function buildRevenueMetrics(ss) {
  var sheet = getOrCreateSheet(ss, "💰 REVENUE METRICS");
  sheet.setTabColor(COLOURS.tabGreen);
  sheet.setFrozenRows(6);

  styleHeader(sheet, 1, 1, 15, "💰 REVENUE METRICS — Deal Tracking with Attribution");

  // Summary section
  styleSubHeader(sheet, 2, 1, 15, "  REVENUE SUMMARY");

  var summaryLabels = ["Total Revenue", "Total Clients", "Avg Deal Size", "ROAS", "Revenue Per Lead", "Est. LTV"];
  styleColumnHeaders(sheet, 3, summaryLabels);

  // Summary formulas
  sheet.getRange(4, 1).setFormula('=IFERROR(SUM(J7:J506),"")').setNumberFormat("#,##0.00").setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 2).setFormula('=IFERROR(COUNTA(B7:B506),"")').setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 3).setFormula('=IFERROR(IF(B4=0,"",A4/B4),"")').setNumberFormat("#,##0.00").setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 4).setFormula("=IFERROR(IF(SUM('📢 AD METRICS'!I3:I999)=0,\"\",A4/SUM('📢 AD METRICS'!I3:I999)),\"\")").setNumberFormat("0.0x").setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 5).setFormula("=IFERROR(IF(COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"optin\")=0,\"\",A4/COUNTIFS('👤 LEAD JOURNEYS'!C2:C" + MAX_LEAD_ROWS + ",\"optin\")),\"\")").setNumberFormat("#,##0.00").setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);
  sheet.getRange(4, 6).setFormula('=IFERROR(C4*1.5,"")').setNumberFormat("#,##0.00").setBackground(COLOURS.goodBg).setFontWeight("bold").setFontSize(12);

  // Labelled summary row
  sheet.getRange(5, 1).setValue("Total Revenue").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");
  sheet.getRange(5, 2).setValue("Total Clients").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");
  sheet.getRange(5, 3).setValue("Avg Deal Size").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");
  sheet.getRange(5, 4).setValue("ROAS").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");
  sheet.getRange(5, 5).setValue("Rev / Lead").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");
  sheet.getRange(5, 6).setValue("Est. LTV").setFontSize(8).setFontColor("#666666").setHorizontalAlignment("center");

  // Deal tracking headers
  var dealHeaders = [
    "Date",               // A
    "Client Name",        // B
    "Email",              // C
    "UTM Source\n(auto)", // D — auto-attributed
    "UTM Campaign\n(auto)", // E — auto-attributed
    "Ad Creative\n(auto)",  // F — auto-attributed
    "Offer / Programme",  // G
    "Price Point",        // H
    "Payment Plan",       // I
    "Total Value",        // J
    "Initial Payment",    // K
    "CPA",                // L
    "Lead Source",        // M
    "Referral / Notes",   // N
    "Attribution Notes"   // O
  ];
  styleColumnHeaders(sheet, 6, dealHeaders);

  // Input rows with attribution formulas
  for (var i = 7; i <= 106; i++) {
    sheet.getRange(i, 1).setNumberFormat("yyyy-mm-dd").setBackground(COLOURS.inputBg);
    sheet.getRange(i, 2).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 3).setBackground(COLOURS.inputBg);

    // Auto-attribution: look up UTM Source from LEAD JOURNEYS by email
    sheet.getRange(i, 4).setFormula(
      "=IFERROR(INDEX('👤 LEAD JOURNEYS'!H:H,MATCH(C" + i + ",'👤 LEAD JOURNEYS'!B:B,0)),\"\")"
    ).setFontColor("#1a73e8");

    // Auto-attribution: UTM Campaign
    sheet.getRange(i, 5).setFormula(
      "=IFERROR(INDEX('👤 LEAD JOURNEYS'!J:J,MATCH(C" + i + ",'👤 LEAD JOURNEYS'!B:B,0)),\"\")"
    ).setFontColor("#1a73e8");

    // Auto-attribution: Ad Creative (UTM Content)
    sheet.getRange(i, 6).setFormula(
      "=IFERROR(INDEX('👤 LEAD JOURNEYS'!K:K,MATCH(C" + i + ",'👤 LEAD JOURNEYS'!B:B,0)),\"\")"
    ).setFontColor("#1a73e8");

    sheet.getRange(i, 7).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 8).setNumberFormat("#,##0.00").setBackground(COLOURS.inputBg);
    sheet.getRange(i, 9).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 10).setNumberFormat("#,##0.00").setBackground(COLOURS.inputBg);
    sheet.getRange(i, 11).setNumberFormat("#,##0.00").setBackground(COLOURS.inputBg);
    sheet.getRange(i, 12).setNumberFormat("#,##0.00").setBackground(COLOURS.inputBg);
    sheet.getRange(i, 13).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 14).setBackground(COLOURS.inputBg);
    sheet.getRange(i, 15).setBackground(COLOURS.inputBg);
  }

  // Totals row
  var tRow = 107;
  sheet.getRange(tRow, 1).setValue("TOTALS").setFontWeight("bold");
  sheet.getRange(tRow, 1, 1, 15).setBackground(COLOURS.totalsBg).setFontWeight("bold");
  sheet.getRange(tRow, 8).setFormula('=SUM(H7:H106)').setNumberFormat("#,##0.00");
  sheet.getRange(tRow, 10).setFormula('=SUM(J7:J106)').setNumberFormat("#,##0.00");
  sheet.getRange(tRow, 11).setFormula('=SUM(K7:K106)').setNumberFormat("#,##0.00");
  sheet.getRange(tRow, 12).setFormula('=IFERROR(AVERAGE(L7:L106),"")').setNumberFormat("#,##0.00");

  setColWidths(sheet, [100, 160, 180, 100, 160, 140, 160, 100, 120, 110, 120, 90, 100, 180, 160]);
}

// ─────────────────────────────────────────────
// TAB: 🔍 DISCREPANCY ANALYSER
// ─────────────────────────────────────────────
function buildDiscrepancyAnalyser(ss) {
  var sheet = getOrCreateSheet(ss, "🔍 DISCREPANCY ANALYSER");
  sheet.setTabColor(COLOURS.tabRed);
  sheet.setFrozenRows(2);

  styleHeader(sheet, 1, 1, 5, "🔍 DISCREPANCY ANALYSER — Automated Bottleneck Detection");

  var headers = ["Discrepancy", "Current Status", "Signal / Diagnosis", "Prescribed Action", "Priority"];
  styleColumnHeaders(sheet, 2, headers);

  var discrepancies = [
    {
      name: "High LP views, low opt-in rate",
      signal: "Traffic is arriving but not opting in. Likely: weak headline, poor mobile rendering, slow page load, or wrong audience match.",
      action: "1. A/B test headline (problem vs outcome). 2. Check mobile responsiveness. 3. Run GTmetrix speed test. 4. Review audience targeting in ads.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D5="",\'🎯 FUNNEL FLOW\'!D6=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!B5>=50,\'🎯 FUNNEL FLOW\'!D6<\'🎯 FUNNEL FLOW\'!E6*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "HIGH"
    },
    {
      name: "High opt-in, low VSL play rate",
      signal: "Leads opt in but don\'t play the video. Likely: page load issue, broken embed, above-fold experience post opt-in, no autoplay.",
      action: "1. Test page load speed. 2. Check video embed on mobile. 3. Add urgency above the fold. 4. A/B test autoplay vs click-to-play.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D6="",\'🎯 FUNNEL FLOW\'!D8=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D6>=\'🎯 FUNNEL FLOW\'!E6,\'🎯 FUNNEL FLOW\'!D8<\'🎯 FUNNEL FLOW\'!E8*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "HIGH"
    },
    {
      name: "High play rate, low completion rate",
      signal: "Video is playing but viewers drop off before CTA. Likely: weak hook (first 60s), poor pacing, VSL too long.",
      action: "1. Review video heatmap data. 2. Strengthen first 60 seconds. 3. Test shorter cut. 4. Add retention hooks at drop-off points.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D8="",\'🎯 FUNNEL FLOW\'!D9=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D8>=\'🎯 FUNNEL FLOW\'!E8,\'🎯 FUNNEL FLOW\'!D9<\'🎯 FUNNEL FLOW\'!E9*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "HIGH"
    },
    {
      name: "High completion, low application rate",
      signal: "Prospects watch but don\'t apply. Likely: weak offer stack, CTA placed too late, application form too long, missing price anchor.",
      action: "1. Rewrite offer stack with specificity. 2. Move CTA to 70% mark. 3. Shorten application to 5 questions. 4. Add social proof before CTA.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D9="",\'🎯 FUNNEL FLOW\'!D11=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D9>=\'🎯 FUNNEL FLOW\'!E9,\'🎯 FUNNEL FLOW\'!D11<\'🎯 FUNNEL FLOW\'!E11*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "MEDIUM"
    },
    {
      name: "High application, low booking rate",
      signal: "Leads apply but don\'t book calls. Likely: too many steps to booking, no immediate redirect to calendar, confusing booking page.",
      action: "1. Auto-redirect to Calendly after application submit. 2. Add booking link in confirmation email. 3. SMS reminder to book.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D11="",\'🎯 FUNNEL FLOW\'!D12=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D11>=\'🎯 FUNNEL FLOW\'!E11,\'🎯 FUNNEL FLOW\'!D12<\'🎯 FUNNEL FLOW\'!E12*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "HIGH"
    },
    {
      name: "High booking, low show rate",
      signal: "Calls booked but not showing up. Likely: booking window too long, weak confirmation sequence, no SMS reminders, low-intent applicants.",
      action: "1. Tighten booking window to 3-4 days max. 2. Add 3-step SMS reminder. 3. Add video on confirmation page. 4. Require phone number.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D12="",\'🎯 FUNNEL FLOW\'!D13=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D12>=\'🎯 FUNNEL FLOW\'!E12,\'🎯 FUNNEL FLOW\'!D13<\'🎯 FUNNEL FLOW\'!E13*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "HIGH"
    },
    {
      name: "High show rate, low close rate",
      signal: "Calls happening but not converting. Likely: poor qualification, weak closer, wrong offer/price framing, prospects not pre-sold.",
      action: "1. Review last 10 call recordings. 2. Tighten qualification questions. 3. Implement pre-call video. 4. Revisit objection handling.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D13="",\'🎯 FUNNEL FLOW\'!D14=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D13>=\'🎯 FUNNEL FLOW\'!E13,\'🎯 FUNNEL FLOW\'!D14<\'🎯 FUNNEL FLOW\'!E14*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "CRITICAL"
    },
    {
      name: "High close rate, low ROAS",
      signal: "Sales closing but ads not profitable. Likely: CPL too high, traffic quality poor, or LTV not captured in calculation.",
      action: "1. Audit CPL against deal size. 2. Pause lowest-performing ad sets. 3. Test new creatives and audiences. 4. Include payment plan revenue.",
      status: '=IF(OR(\'🎯 FUNNEL FLOW\'!D14="",\'📊 DASHBOARD\'!B13=""),"' + String.fromCharCode(9898) + ' No Data",IF(AND(\'🎯 FUNNEL FLOW\'!D14>=\'🎯 FUNNEL FLOW\'!E14,\'📊 DASHBOARD\'!B13<\'📊 DASHBOARD\'!C13*0.8),"' + String.fromCharCode(128680) + ' FLAGGED","' + String.fromCharCode(9989) + ' Clear"))',
      priority: "CRITICAL"
    }
  ];

  for (var i = 0; i < discrepancies.length; i++) {
    var r = 3 + i;
    var d = discrepancies[i];
    sheet.getRange(r, 1).setValue(d.name).setFontWeight("bold").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange(r, 2).setFormula(d.status).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(r, 3).setValue(d.signal).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange(r, 4).setValue(d.action).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange(r, 5).setValue(d.priority).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.setRowHeight(r, 90);
  }

  // Conditional formatting
  var statusRange = sheet.getRange("B3:B10");
  var rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextContains("FLAGGED")
      .setBackground(COLOURS.badBg).setFontColor(COLOURS.badText).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains("Clear")
      .setBackground(COLOURS.goodBg).setFontColor(COLOURS.goodText).setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextContains("No Data")
      .setBackground(COLOURS.protectBg).setFontColor("#888888").setRanges([statusRange]).build()
  ];
  sheet.setConditionalFormatRules(rules);

  var priorityRange = sheet.getRange("E3:E10");
  var pRules = sheet.getConditionalFormatRules();
  pRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("CRITICAL")
    .setBackground(COLOURS.badBg).setFontColor(COLOURS.badText).setRanges([priorityRange]).build());
  pRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("HIGH")
    .setBackground(COLOURS.watchBg).setFontColor(COLOURS.watchText).setRanges([priorityRange]).build());
  pRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("MEDIUM")
    .setBackground(COLOURS.subheaderBg).setFontColor(COLOURS.subheaderText).setRanges([priorityRange]).build());
  sheet.setConditionalFormatRules(pRules);

  setColWidths(sheet, [220, 120, 300, 340, 90]);
}

// ─────────────────────────────────────────────
// TAB: 📈 BENCHMARKS
// ─────────────────────────────────────────────
function buildBenchmarks(ss) {
  var sheet = getOrCreateSheet(ss, "📈 BENCHMARKS");
  sheet.setTabColor(COLOURS.tabGrey);
  sheet.setFrozenRows(1);

  styleHeader(sheet, 1, 1, 6, "📈 BENCHMARKS — Industry Standards by Price Tier");

  // Column headers
  var headers = ["Metric", "Range", "Midpoint", "Notes", "Lookup Key", "Lookup Value"];
  styleColumnHeaders(sheet, 2, headers);

  // Hide lookup columns (E and F) — used by FUNNEL FLOW VLOOKUP
  // Column E = metric_name & tier, Column F = midpoint value

  var tiers = [
    {
      name: "MID-TICKET ($1,000 - $5,000)",
      key: "mid",
      color: COLOURS.subheaderBg,
      metrics: [
        ["Ad CTR",              "1.5-3.0%",  0.02,   "Click-through rate on ads"],
        ["Click to LP Rate",    "80-90%",    0.85,   "Ad click to landing page load"],
        ["Opt-in Rate",         "25-40%",    0.325,  "Cold traffic opt-in rate"],
        ["Opt-in to VSL Rate",  "75-85%",    0.80,   "Opt-in to VSL page view"],
        ["VSL Play Rate",       "60-75%",    0.675,  "Page view to play"],
        ["VSL Completion Rate", "35-50%",    0.425,  "Play to 100% watched"],
        ["CTA Click Rate",      "8-15%",     0.115,  "Page view to CTA click"],
        ["Application Rate",    "10-20%",    0.15,   "Of completions"],
        ["Booking Rate",        "65-80%",    0.725,  "Application to booking"],
        ["Show Rate",           "60-70%",    0.65,   "Booking to show"],
        ["Close Rate",          "15-25%",    0.20,   "Show to close"],
        ["Target CPL",          "15-40",     27.5,   "Cost per lead"],
        ["Target ROAS",         "2.5-4x",    3.25,   "Revenue / ad spend"]
      ]
    },
    {
      name: "HIGH-TICKET ($5,000 - $15,000)",
      key: "high",
      color: "#e8f5e9",
      metrics: [
        ["Ad CTR",              "1.0-2.5%",  0.0175, "Click-through rate on ads"],
        ["Click to LP Rate",    "80-90%",    0.85,   "Ad click to landing page load"],
        ["Opt-in Rate",         "20-35%",    0.275,  "Slightly lower, more targeted"],
        ["Opt-in to VSL Rate",  "75-85%",    0.80,   "Opt-in to VSL page view"],
        ["VSL Play Rate",       "65-80%",    0.725,  "Higher intent leads play more"],
        ["VSL Completion Rate", "30-45%",    0.375,  "30-45 min VSL typical"],
        ["CTA Click Rate",      "6-12%",     0.09,   "Page view to CTA click"],
        ["Application Rate",    "12-18%",    0.15,   "Application acts as qualifier"],
        ["Booking Rate",        "70-85%",    0.775,  "High-intent leads book fast"],
        ["Show Rate",           "65-75%",    0.70,   "SMS reminders critical"],
        ["Close Rate",          "20-35%",    0.275,  "Strong closer + pre-call nurture"],
        ["Target CPL",          "30-80",     55,     "Higher CPL acceptable"],
        ["Target ROAS",         "3-6x",      4.5,    "Higher margin allows better ROAS"]
      ]
    },
    {
      name: "ULTRA HIGH-TICKET ($15,000 - $50,000+)",
      key: "ultra_high",
      color: "#fce4ec",
      metrics: [
        ["Ad CTR",              "0.8-2.0%",  0.014,  "Smaller but targeted audience"],
        ["Click to LP Rate",    "80-90%",    0.85,   "Ad click to landing page load"],
        ["Opt-in Rate",         "15-28%",    0.215,  "Highly targeted audience"],
        ["Opt-in to VSL Rate",  "80-90%",    0.85,   "Serious leads, high intent"],
        ["VSL Play Rate",       "70-85%",    0.775,  "These leads are serious"],
        ["VSL Completion Rate", "40-60%",    0.50,   "Longer VSLs (45-90 min) work here"],
        ["CTA Click Rate",      "5-10%",     0.075,  "Page view to CTA click"],
        ["Application Rate",    "8-15%",     0.115,  "Self-selection filter intentional"],
        ["Booking Rate",        "75-90%",    0.825,  "Setter may precede closer"],
        ["Show Rate",           "70-80%",    0.75,   "Strong confirmation sequence"],
        ["Close Rate",          "25-40%",    0.325,  "2-call close common"],
        ["Target CPL",          "60-200",    130,    "Justified by deal size"],
        ["Target ROAS",         "5-10x",     7.5,    "Larger margins compound faster"]
      ]
    }
  ];

  var currentRow = 3;
  for (var t = 0; t < tiers.length; t++) {
    var tier = tiers[t];

    // Tier header
    sheet.getRange(currentRow, 1, 1, 6).merge()
      .setValue(tier.name)
      .setBackground(tier.color)
      .setFontColor(COLOURS.headerBg)
      .setFontWeight("bold")
      .setFontSize(12)
      .setHorizontalAlignment("center");
    sheet.setRowHeight(currentRow, 32);
    currentRow++;

    for (var m = 0; m < tier.metrics.length; m++) {
      var metric = tier.metrics[m];
      sheet.getRange(currentRow, 1).setValue(metric[0]);
      sheet.getRange(currentRow, 2).setValue(metric[1]).setHorizontalAlignment("center").setFontWeight("bold");
      sheet.getRange(currentRow, 3).setValue(metric[2]).setNumberFormat("0.0%").setHorizontalAlignment("center");
      sheet.getRange(currentRow, 4).setValue(metric[3]).setFontColor("#555555");

      // Lookup key: metric_name + tier_key (for VLOOKUP from FUNNEL FLOW)
      sheet.getRange(currentRow, 5).setValue(metric[0] + tier.key);
      sheet.getRange(currentRow, 6).setValue(metric[2]).setNumberFormat("0.000");

      sheet.getRange(currentRow, 1, 1, 6).setBackground(COLOURS.protectBg);
      currentRow++;
    }
    currentRow++; // spacer row
  }

  // CPL and ROAS rows need different formatting (not percentage)
  // Go back and fix format for CPL and ROAS rows
  for (var fixRow = 3; fixRow <= currentRow; fixRow++) {
    var cellVal = sheet.getRange(fixRow, 1).getValue();
    if (cellVal === "Target CPL") {
      sheet.getRange(fixRow, 3).setNumberFormat("#,##0.00");
      sheet.getRange(fixRow, 6).setNumberFormat("#,##0.00");
    }
    if (cellVal === "Target ROAS") {
      sheet.getRange(fixRow, 3).setNumberFormat("0.0x");
      sheet.getRange(fixRow, 6).setNumberFormat("0.0");
    }
  }

  // Protect this sheet
  var protection = sheet.protect().setDescription("Benchmark reference - do not edit");
  protection.setWarningOnly(true);

  // Hide lookup columns
  sheet.hideColumns(5, 2);

  setColWidths(sheet, [220, 120, 100, 260, 200, 100]);
}

// ─────────────────────────────────────────────
// WEBHOOK ENDPOINT (doPost)
// ─────────────────────────────────────────────
// Basic webhook endpoint for receiving manual events
// For production use, deploy the Vercel API instead
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("👤 LEAD JOURNEYS");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({error: "LEAD JOURNEYS tab not found"}));

    var row = [
      data.timestamp || new Date().toISOString(),
      data.email || "",
      data.event_type || "",
      data.event_source || "gas_webhook",
      data.first_name || "",
      data.last_name || "",
      data.phone || "",
      data.utm_source || "",
      data.utm_medium || "",
      data.utm_campaign || "",
      data.utm_content || "",
      data.utm_term || "",
      data.page_url || "",
      data.fbclid || "",
      data.gclid || "",
      data.video_milestone || "",
      data.deal_value || "",
      data.ad_campaign || "",
      data.ad_set || "",
      data.ad_creative || "",
      data.metadata ? JSON.stringify(data.metadata) : "",
      data.event_id || "gas_" + new Date().getTime(),
      (data.timestamp || new Date().toISOString()).split("T")[0]
    ];

    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({status: "ok", event_type: data.event_type}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
