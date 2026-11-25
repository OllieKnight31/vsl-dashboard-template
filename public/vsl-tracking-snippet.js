/**
 * VSL Funnel Tracking Snippet v1.0
 * Paste this script on every funnel page before </body>
 * Auto-detects video player, captures UTMs, fires events to Vercel API
 */
(function() {
  'use strict';

  // ── CONFIG (fill in before deploying) ──
  var VSL_CONFIG = {
    WEBHOOK_URL: '',          // e.g. https://your-app.vercel.app/api?source=tracking
    API_SECRET: '',           // Shared secret from CONFIG tab
    META_PIXEL_ID: '',        // Optional: fires pixel events
    GA4_MEASUREMENT_ID: '',   // Optional: fires GA4 events
    VIDEO_PLATFORM: 'auto',  // auto, vidalytics, wistia, youtube, vimeo
    INTERCEPT_FORMS: true,    // Capture email from inline forms
    DEBUG: false,
  };

  // Settings set on the page (window.VSL_CONFIG) override the defaults above,
  // so you can load this file from your Vercel app without editing it.
  if (window.VSL_CONFIG && typeof window.VSL_CONFIG === 'object') {
    Object.keys(window.VSL_CONFIG).forEach(function(k) { VSL_CONFIG[k] = window.VSL_CONFIG[k]; });
  }

  // ── State ──
  var milestones = {};
  var leadId = '';
  var utmData = {};
  var identified = false;

  function log() {
    if (VSL_CONFIG.DEBUG) console.log.apply(console, ['[VSL]'].concat(Array.prototype.slice.call(arguments)));
  }

  // ── UTM Capture ──
  function captureUTMs() {
    var params = new URLSearchParams(window.location.search);
    var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'];
    var fresh = {};
    var hasFresh = false;

    keys.forEach(function(k) {
      var v = params.get(k);
      if (v) { fresh[k] = v; hasFresh = true; }
    });

    // Session storage (current session)
    if (hasFresh) {
      keys.forEach(function(k) { if (fresh[k]) sessionStorage.setItem('vsl_' + k, fresh[k]); });
    }

    // localStorage (first-touch: only write if no existing data OR new UTMs present)
    var existing = localStorage.getItem('vsl_utm_source');
    if (!existing && hasFresh) {
      keys.forEach(function(k) { if (fresh[k]) localStorage.setItem('vsl_' + k, fresh[k]); });
    }

    // Build utmData from session (priority) then localStorage
    keys.forEach(function(k) {
      utmData[k] = sessionStorage.getItem('vsl_' + k) || localStorage.getItem('vsl_' + k) || '';
    });

    log('UTMs captured:', utmData);
  }

  // ── Lead Identity ──
  function getLeadId() {
    if (leadId) return leadId;
    leadId = localStorage.getItem('vsl_lead_email') || localStorage.getItem('vsl_lead_id');
    if (!leadId) {
      leadId = 'anon_' + crypto.randomUUID();
      localStorage.setItem('vsl_lead_id', leadId);
    }
    return leadId;
  }

  function identifyLead(email) {
    if (!email || identified) return;
    leadId = email;
    identified = true;
    localStorage.setItem('vsl_lead_email', email);
    log('Lead identified:', email);
  }

  // ── Event Dispatcher ──
  function generateEventId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  }

  function sendEvent(eventType, extra) {
    extra = extra || {};
    var eventId = extra.event_id || generateEventId();

    var payload = {
      timestamp: new Date().toISOString(),
      email: leadId || getLeadId(),
      event_type: eventType,
      event_source: 'tracking_snippet',
      page_url: window.location.pathname,
      utm_source: utmData.utm_source || '',
      utm_medium: utmData.utm_medium || '',
      utm_campaign: utmData.utm_campaign || '',
      utm_content: utmData.utm_content || '',
      utm_term: utmData.utm_term || '',
      fbclid: utmData.fbclid || '',
      gclid: utmData.gclid || '',
      event_id: eventId,
      api_secret: VSL_CONFIG.API_SECRET,
    };

    for (var k in extra) { if (extra.hasOwnProperty(k)) payload[k] = extra[k]; }

    log('Event:', eventType, payload);

    // Send to Vercel API
    if (VSL_CONFIG.WEBHOOK_URL) {
      var data = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(VSL_CONFIG.WEBHOOK_URL, new Blob([data], {type: 'application/json'}));
      } else {
        fetch(VSL_CONFIG.WEBHOOK_URL, {method:'POST', body:data, headers:{'Content-Type':'application/json'}, keepalive:true}).catch(function(){});
      }
    }

    // Meta Pixel
    if (VSL_CONFIG.META_PIXEL_ID && typeof fbq === 'function') {
      var pixelMap = {
        'optin': function() { fbq('track','Lead',{content_name:'VSL Opt-in'},{eventID:eventId}); },
        'vsl_play': function() { fbq('trackCustom','VideoStart',{video_title:'Main VSL'},{eventID:eventId}); },
        'vsl_milestone_25': function() { fbq('trackCustom','Video25Percent',{},{eventID:eventId}); },
        'vsl_milestone_50': function() { fbq('trackCustom','Video50Percent',{},{eventID:eventId}); },
        'vsl_milestone_75': function() { fbq('trackCustom','Video75Percent',{},{eventID:eventId}); },
        'vsl_milestone_100': function() { fbq('trackCustom','VideoComplete',{},{eventID:eventId}); },
        'application_submit': function() { fbq('track','SubmitApplication',{},{eventID:eventId}); },
        'booking_confirmed': function() { fbq('track','Schedule',{content_name:'Call Booked'},{eventID:eventId}); },
        'close': function() { fbq('track','Purchase',{value:extra.deal_value||0,currency:'GBP'},{eventID:eventId}); },
      };
      if (pixelMap[eventType]) pixelMap[eventType]();
    }

    // GA4
    if (VSL_CONFIG.GA4_MEASUREMENT_ID && typeof gtag === 'function') {
      gtag('event', eventType, { event_id: eventId, page_url: window.location.pathname });
    }
  }

  // ── Page Type Detection ──
  function detectPageType() {
    var path = window.location.pathname.toLowerCase();
    var hash = window.location.hash.toLowerCase();
    var all = path + hash;

    if (all.match(/\/(vsl|watch|video)/)) return 'vsl_page_view';
    if (all.match(/\/(apply|application|quiz)/)) return 'application_view';
    if (all.match(/\/(book|calendar|schedule|call)/)) return 'booking_page_view';
    if (all.match(/\/(thank|confirm|success)/)) return 'page_view';
    return 'page_view';
  }

  // ── Video Player Detection & Hooks ──
  function detectAndHookVideo() {
    var platform = VSL_CONFIG.VIDEO_PLATFORM;
    if (platform === 'auto') {
      if (window.vidalytics || document.querySelector('[data-vidalytics-id]')) platform = 'vidalytics';
      else if (window._wq || document.querySelector('.wistia_embed')) platform = 'wistia';
      else if (document.querySelector('iframe[src*="youtube.com/embed"]')) platform = 'youtube';
      else if (document.querySelector('iframe[src*="player.vimeo.com"]')) platform = 'vimeo';
      else { log('No video player detected'); return; }
    }
    log('Video platform:', platform);

    switch (platform) {
      case 'vidalytics': hookVidalytics(); break;
      case 'wistia': hookWistia(); break;
      case 'youtube': hookYouTube(); break;
      case 'vimeo': hookVimeo(); break;
    }
  }

  function fireMilestone(pct) {
    var key = Math.floor(pct);
    var thresholds = [25,50,75,100];
    thresholds.forEach(function(t) {
      if (key >= t && !milestones[t]) {
        milestones[t] = true;
        sendEvent('vsl_milestone_' + t, {video_milestone: t + '%'});
      }
    });
  }

  function hookVidalytics() {
    window.addEventListener('vidalytics_play', function() { sendEvent('vsl_play'); });
    window.addEventListener('vidalytics_progress', function(e) {
      fireMilestone(e.detail && e.detail.percent ? e.detail.percent * 100 : 0);
    });
    // Fallback: poll if events don't fire
    if (window.vidalytics && window.vidalytics.getPlayer) {
      setInterval(function() {
        try {
          var p = window.vidalytics.getPlayer();
          if (p && p.currentTime && p.duration) fireMilestone((p.currentTime / p.duration) * 100);
        } catch(e) {}
      }, 3000);
    }
  }

  function hookWistia() {
    window._wq = window._wq || [];
    window._wq.push({id:'_all', onEmbedded: function(video) {
      video.bind('play', function() { sendEvent('vsl_play'); });
      video.bind('percentwatchedchanged', function(pct) { fireMilestone(pct * 100); });
      video.bind('end', function() { fireMilestone(100); });
    }});
  }

  function hookYouTube() {
    var iframe = document.querySelector('iframe[src*="youtube.com/embed"]');
    if (!iframe) return;
    // Ensure enablejsapi
    var src = iframe.src;
    if (src.indexOf('enablejsapi') === -1) {
      iframe.src = src + (src.indexOf('?') > -1 ? '&' : '?') + 'enablejsapi=1';
    }

    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = function() {
      var player = new YT.Player(iframe, {
        events: {
          onStateChange: function(e) {
            if (e.data === YT.PlayerState.PLAYING) {
              sendEvent('vsl_play');
              var poll = setInterval(function() {
                if (player.getDuration && player.getCurrentTime) {
                  var pct = (player.getCurrentTime() / player.getDuration()) * 100;
                  fireMilestone(pct);
                  if (milestones[100]) clearInterval(poll);
                }
              }, 3000);
            }
            if (e.data === YT.PlayerState.ENDED) fireMilestone(100);
          }
        }
      });
    };
  }

  function hookVimeo() {
    var iframe = document.querySelector('iframe[src*="player.vimeo.com"]');
    if (!iframe) return;

    var tag = document.createElement('script');
    tag.src = 'https://player.vimeo.com/api/player.js';
    tag.onload = function() {
      var player = new Vimeo.Player(iframe);
      player.on('play', function() { sendEvent('vsl_play'); });
      player.on('timeupdate', function(data) { fireMilestone(data.percent * 100); });
      player.on('ended', function() { fireMilestone(100); });
    };
    document.head.appendChild(tag);
  }

  // ── CTA Click Tracking ──
  function hookCTAs() {
    document.addEventListener('click', function(e) {
      var el = e.target.closest('[data-vsl-cta]');
      if (el) sendEvent('cta_click');
    });
  }

  // ── Form Intercept ──
  function hookForms() {
    if (!VSL_CONFIG.INTERCEPT_FORMS) return;
    document.addEventListener('submit', function(e) {
      var form = e.target;
      var emailInput = form.querySelector('input[type="email"], input[name="email"], input[name*="email"]');
      if (emailInput && emailInput.value) {
        identifyLead(emailInput.value);
        sendEvent('optin', {email: emailInput.value, first_name: getFormValue(form, 'name', 'first_name')});
      }
    });
  }

  function getFormValue(form, name1, name2) {
    var el = form.querySelector('[name="' + name1 + '"]') || form.querySelector('[name="' + name2 + '"]');
    return el ? el.value : '';
  }

  // ── Init ──
  function init() {
    captureUTMs();
    getLeadId();

    var pageType = detectPageType();
    sendEvent(pageType);

    detectAndHookVideo();
    hookCTAs();
    hookForms();
    log('Initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.VSLTracker = {
    sendEvent: sendEvent,
    identifyLead: identifyLead,
    getLeadId: getLeadId,
  };
})();
