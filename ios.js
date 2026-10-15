/* =========================================
   MyDailyCare · iPhone Edition · Logic
   Shares data with the desktop version via
   the v4 guest storage key.
   ========================================= */

const STORAGE_KEY = 'mydailycare.state.v4';
const RING_LENGTH = 2 * Math.PI * 88; // r=88

const defaultState = {
  medications: [],
  careTasks: [],
  lastTriggered: { meds: {}, care: {} },
  alarmLog: [],
  accessibility: null,
  destinations: [],
  trips: [],
  rideFilter: 'all',
  emergencyContact: null,        // { name, phone, relationship }
  moodLog: {},                   // { 'YYYY-MM-DD': '😊' }
  companionChat: [],             // [{ from: 'me'|'bot', text, at }]
  communityPosts: [],            // [{ id, avatar, name, time, text, likes, liked, own }]
  timezone: 'America/New_York'   // ET default
};

const DEFAULT_COMMUNITY = [
  { id: 'c1', avatar: '🦋', name: 'Maria · Chicago',  time: '2h',  text: 'Just tried adaptive pottery today 🎨 Wheelchair-friendly studio downtown. Anyone want to swap spots next week?', likes: 12, liked: false, own: false },
  { id: 'c2', avatar: '💪', name: 'Marcus · Atlanta', time: '5h',  text: 'Friendly reminder: do your pressure relief every 15 minutes. Your skin will thank you tomorrow! 💛', likes: 24, liked: false, own: false },
  { id: 'c3', avatar: '🌸', name: 'Tasha · Phoenix',  time: '1d',  text: 'Came across MyDailyCare for medication reminders. The loud alarm actually gets me out of the chair now 🙌', likes: 8,  liked: false, own: false },
  { id: 'c4', avatar: '🛞', name: 'Devon · Boston',   time: '2d',  text: 'Travel tip: call your paratransit 24h ahead — fills up fast, especially in winter. Save the number!', likes: 15, liked: false, own: false }
];

const RIDE_PROVIDERS = [
  { id: 'uber-wav', name: 'Uber WAV', icon: '🚐', category: 'wav', wait: '5–20 min', cost: '$$',
    desc: 'Wheelchair-accessible vehicles with ramps in most major cities.',
    deeplink: 'uber://?action=setPickup&pickup=my_location', web: 'https://m.uber.com/looking', phone: '' },
  { id: 'lyft-access', name: 'Lyft Access', icon: '🛞', category: 'wav', wait: '5–25 min', cost: '$$',
    desc: 'Lyft wheelchair-accessible rides with trained drivers.',
    deeplink: 'lyft://ridetype?id=wheelchair', web: 'https://www.lyft.com/ride', phone: '' },
  { id: 'gogograndparent', name: 'GoGoGrandparent', icon: '☎️', category: 'phone', wait: '15–30 min', cost: '$$',
    desc: 'Phone-based booking — no app needed. Operators screen drivers for accessibility.',
    deeplink: '', web: 'https://gogograndparent.com', phone: '+18554646872' },
  { id: 'curb', name: 'Curb', icon: '🚕', category: 'wav', wait: '5–15 min', cost: '$',
    desc: 'Metered taxi with WAV filter in 20+ cities.',
    deeplink: 'curbapp://open', web: 'https://gocurb.com', phone: '' },
  { id: 'uber-assist', name: 'Uber Assist', icon: '🤝', category: 'driver-assist', wait: '5–15 min', cost: '$$',
    desc: 'Drivers trained to assist riders with mobility devices.',
    deeplink: 'uber://?action=setPickup', web: 'https://m.uber.com/looking', phone: '' },
  { id: 'paratransit', name: 'Local Paratransit', icon: '🚌', category: 'public', wait: 'Varies', cost: '$',
    desc: 'Public ADA paratransit. Register with your transit agency; book 24h ahead.',
    deeplink: '', web: 'https://www.transit.dot.gov/accessibility', phone: '' }
];

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => (s === null || s === undefined ? '' : String(s)).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: tz() });
const nowHM = () => fmtUSClock(new Date());

function minutesUntil(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  let diff = Math.round((t - d) / 60000);
  if (diff < -12 * 60) diff += 24 * 60;
  return diff;
}

// ---- US time zone helpers ----
const TZ_OPTIONS = [
  { value: 'America/New_York',    label: 'Eastern (New York)' },
  { value: 'America/Chicago',     label: 'Central (Chicago)' },
  { value: 'America/Denver',      label: 'Mountain (Denver)' },
  { value: 'America/Phoenix',     label: 'Mountain — Arizona (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage',   label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (Honolulu)' }
];
function tz() { return state.timezone || 'America/New_York'; }
function fmtUSDate(d) {
  return d.toLocaleDateString('en-US', { timeZone: tz(), weekday: 'long', month: 'short', day: 'numeric' });
}
function fmtUSClock(d) {
  return d.toLocaleTimeString('en-US', { timeZone: tz(), hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtUSAMPM(d) {
  return d.toLocaleTimeString('en-US', { timeZone: tz(), hour: 'numeric', minute: '2-digit' });
}
function getUSHour(d) {
  const parts = d.toLocaleString('en-US', { timeZone: tz(), hour: 'numeric', hour12: true });
  return parseInt(parts, 10);
}
function greetingForHour(h) {
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ---- State (shared with desktop guest data) ----
function cloneDefault() {
  // JSON round-trip instead of structuredClone for older-browser compatibility
  return JSON.parse(JSON.stringify(defaultState));
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign(cloneDefault(), parsed);
    }
  } catch {}
  try {
    const v3 = JSON.parse(localStorage.getItem('mydailycare.state.v3') || 'null');
    if (v3) return Object.assign(cloneDefault(), v3);
  } catch {}
  return cloneDefault();
}
let state = loadState();
let storageOK = true;
function save() {
  // Guard against iOS Safari private mode / blocked cookies where setItem throws
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { storageOK = false; }
}

// ---- Tabs ----
function switchTab(name) {
  $$('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
    b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false');
  });
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  if (name === 'today') renderToday();
  if (name === 'care') renderCare();
  if (name === 'rides') renderRides();
  if (name === 'me') renderMe();
}

// ---- Clock / greeting ----
function tickClock() {
  const d = new Date();
  $('heroDate').textContent = fmtUSDate(d);
  $('greeting').textContent = greetingForHour(getUSHour(d));
}

// ---- Today ----
function nextEvent() {
  const meds = state.medications.filter(m => m.enabled).map(m => ({
    icon: '💊', name: m.name + (m.dosage ? ' · ' + m.dosage : ''), time: m.time, min: minutesUntilUS(m.time), type: 'med'
  }));
  const cares = state.careTasks.filter(c => c.enabled).map(c => {
    const last = state.lastTriggered.care[c.id];
    const dueAt = last ? last + c.interval * 3600000 : Date.now();
    return {
      icon: '🩺', name: c.name, time: formatTsUS(dueAt), min: Math.round((dueAt - Date.now()) / 60000), type: 'care'
    };
  });
  return meds.concat(cares).sort((a, b) => a.min - b.min);
}
function formatTsUS(ts) { return fmtUSClock(new Date(ts)); }

// minutesUntilUS: minutes from "now" until next occurrence of hh:mm in US time zone
function minutesUntilUS(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  // Find next occurrence of h:m in US time
  const now = new Date();
  // Get current US time as a Date that represents the next target
  // We compute the target as the next time the US clock equals hhmm
  const usNow = new Date(now.toLocaleString('en-US', { timeZone: tz() }));
  // usNow components are in local interpretation; better: compute target UTC from US time
  // Approach: find the YYYY-MM-DD HH:MM in US tz that is >= now in US tz
  const usStr = now.toLocaleString('en-US', {
    timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  // usStr like "10/15/2026, 14:30"
  const m1 = usStr.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2})/);
  let usY = 2026, usMo = 1, usD = 1, usH = 0, usMi = 0;
  if (m1) { usMo = +m1[1]; usD = +m1[2]; usY = +m1[3]; usH = +m1[4]; usMi = +m1[5]; }
  const targetUSMin = h * 60 + m;
  const currentUSMin = usH * 60 + usMi;
  let diffMin = targetUSMin - currentUSMin;
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

function renderToday() {
  const next = nextEvent();
  if (next.length) {
    const n = next[0];
    $('heroIcon').textContent = n.icon;
    $('heroName').textContent = n.name;
    $('heroTime').textContent = n.time;
    $('heroSub').textContent = n.min <= 0 ? 'Due now' :
      n.min < 60 ? 'in ' + n.min + ' min' :
      'in ' + Math.floor(n.min / 60) + 'h ' + (n.min % 60) + 'm';
  } else {
    $('heroIcon').textContent = '✨';
    $('heroName').textContent = 'All clear';
    $('heroTime').textContent = '—';
    $('heroSub').textContent = 'Nothing scheduled';
  }

  const ul = $('todayList');
  ul.innerHTML = '';
  const rest = next.slice(0, 6);
  if (!rest.length) {
    ul.innerHTML = '<div class="empty">Nothing else today. Tap Care to add items.</div>';
    return;
  }
  rest.forEach(ev => {
    const row = document.createElement('div');
    row.className = 'cell static';
    row.innerHTML = `
      <span class="cell-icon">${ev.icon}</span>
      <div class="cell-main"><span class="cell-title">${esc(ev.name)}</span></div>
      <span class="cell-badge ${ev.min <= 0 ? 'due' : ''}">${ev.min <= 0 ? 'DUE' : (ev.min < 60 ? ev.min + 'm' : Math.floor(ev.min / 60) + 'h')}</span>
      <span class="cell-time">${ev.time}</span>
    `;
    ul.appendChild(row);
  });
}

// ---- Care ----
function renderCare() {
  const ul = $('medList');
  ul.innerHTML = '';
  if (!state.medications.length) {
    ul.innerHTML = '<div class="empty">No medications yet.<br/>Tap ＋ to add one.</div>';
  }
  state.medications.forEach(m => {
    const row = document.createElement('div');
    row.className = 'cell';
    row.innerHTML = `
      <span class="cell-icon">💊</span>
      <div class="cell-main">
        <span class="cell-title">${esc(m.name)}</span>
        <span class="cell-sub">${esc(m.dosage || '')}${m.notes ? ' · ' + esc(m.notes) : ''}</span>
      </div>
      <span class="cell-time">${m.time}</span>
      <label class="switch"><input type="checkbox" data-med="${m.id}" ${m.enabled ? 'checked' : ''} /><span></span></label>
      <button class="nav-btn" data-edit-med="${m.id}" aria-label="Edit">✎</button>
    `;
    ul.appendChild(row);
  });

  const cl = $('careList');
  cl.innerHTML = '';
  if (!state.careTasks.length) {
    cl.innerHTML = '<div class="empty">No care tasks yet.<br/>Tap "Add Care Task" below.</div>';
  }
  state.careTasks.forEach(c => {
    const last = state.lastTriggered.care[c.id];
    const overdue = c.enabled && last && (Date.now() - last >= c.interval * 3600000);
    const row = document.createElement('div');
    row.className = 'cell';
    row.innerHTML = `
      <span class="cell-icon">🩺</span>
      <div class="cell-main">
        <span class="cell-title">${esc(c.name)}</span>
        <span class="cell-sub">Every ${c.interval}h · ${overdue ? 'DUE NOW 🚨' : last ? 'last ' + new Date(last).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'never done'}</span>
      </div>
      ${c.enabled && last ? `<span class="cell-badge ${overdue ? 'due' : ''}">${overdue ? 'DUE' : 'OK'}</span>` : ''}
      <button class="btn tinted" style="padding:8px 14px;font-size:14px;" data-done-care="${c.id}">Done</button>
      <label class="switch"><input type="checkbox" data-care="${c.id}" ${c.enabled ? 'checked' : ''} /><span></span></label>
      <button class="nav-btn" data-edit-care="${c.id}" aria-label="Edit">✎</button>
    `;
    cl.appendChild(row);
  });
}

// ---- Rides ----
function renderRides() {
  const f = state.rideFilter || 'all';
  const list = RIDE_PROVIDERS.filter(p => f === 'all' || p.category === f);
  const ul = $('providerList');
  ul.innerHTML = '';
  list.forEach(p => {
    const row = document.createElement('button');
    row.className = 'cell';
    row.dataset.provider = p.id;
    row.innerHTML = `
      <span class="cell-icon" style="font-size:28px;">${p.icon}</span>
      <div class="cell-main">
        <span class="cell-title">${esc(p.name)}</span>
        <span class="cell-sub">${esc(p.desc)}</span>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          <span class="cell-badge">⏱ ${esc(p.wait)}</span>
          <span class="cell-badge">${esc(p.cost)}</span>
        </div>
      </div>
      <span class="cell-chevron">›</span>
    `;
    ul.appendChild(row);
  });

  const p = state.accessibility;
  $('profTitle').textContent = p ? 'Your ride profile ✓' : 'Accessibility Profile';
  $('profSub').textContent = p
    ? (p.chairType === 'power' ? 'Power wheelchair' : p.chairType === 'manual' ? 'Manual wheelchair' : 'Foldable') +
      (p.needWAV ? ' · WAV' : '') + (p.needRamp ? ' · Ramp' : '') + (p.needAssist ? ' · Assist' : '')
    : 'Tap to set your needs — auto-filled with every booking';

  const trips = (state.trips || []).slice(-5).reverse();
  const tl = $('tripList');
  tl.innerHTML = '';
  if (!trips.length) {
    tl.innerHTML = '<div class="empty">No recent trips.</div>';
  }
  trips.forEach(t => {
    const prov = RIDE_PROVIDERS.find(x => x.id === t.providerId);
    const row = document.createElement('div');
    row.className = 'cell static';
    row.innerHTML = `
      <span class="cell-icon">${prov ? prov.icon : '🚗'}</span>
      <div class="cell-main">
        <span class="cell-title">${prov ? esc(prov.name) : 'Trip'}</span>
        <span class="cell-sub">${esc(t.fromLabel || '')} → ${esc(t.toLabel || '')}</span>
      </div>
      <span class="cell-sub">${new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    `;
    tl.appendChild(row);
  });
}

function profileNotes() {
  const p = state.accessibility;
  if (!p) return '';
  const lines = [];
  if (p.chairType === 'power') lines.push('Power wheelchair.');
  else if (p.chairType === 'manual') lines.push('Manual wheelchair.');
  else if (p.chairType === 'foldable') lines.push('Foldable wheelchair.');
  if (p.needWAV) lines.push('WAV required.');
  if (p.needRamp) lines.push('Need a ramp.');
  if (p.needLift) lines.push('Need a lift.');
  if (p.needAssist) lines.push('Please assist with the door.');
  if (p.serviceAnimal) lines.push('Service animal on board.');
  if (p.notes) lines.push(p.notes);
  return lines.join(' ');
}

// ---- Sheets ----
function openSheet(id) {
  const sheet = $(id);
  const backdrop = sheet.previousElementSibling;
  if (!backdrop || !backdrop.classList.contains('sheet-backdrop')) return;
  backdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });
}
function closeSheet(id) {
  const sheet = $(id);
  const backdrop = sheet.previousElementSibling;
  sheet.classList.remove('show');
  backdrop.classList.remove('show');
  setTimeout(() => {
    sheet.hidden = true;
    backdrop.hidden = true;
  }, 320);
}

// ---- Alert (iOS style) ----
let alertActive = false;
function showAlert(icon, title, msg, snoozeable = true) {
  alertActive = true;
  $('alertIcon').textContent = icon;
  $('alertTitle').textContent = title;
  $('alertMsg').textContent = msg;
  $('alertSnooze').style.display = snoozeable ? '' : 'none';
  $('alertBackdrop').hidden = false;
  $('iosAlert').hidden = false;
  requestAnimationFrame(() => {
    $('alertBackdrop').classList.add('show');
    $('iosAlert').classList.add('show');
  });
  playLoudAlarm();
}
function hideAlert() {
  stopLoudAlarm();
  $('alertBackdrop').classList.remove('show');
  $('iosAlert').classList.remove('show');
  setTimeout(() => {
    $('alertBackdrop').hidden = true;
    $('iosAlert').hidden = true;
    alertActive = false;
  }, 240);
}

// ---- Audio ----
let audioCtx = null;
let alarmLoopId = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, freq, when, dur, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(vol, when + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// Loud, long medication alarm — ~7-8 seconds of urgent pulsing tones
// Repeats every ~9s until user taps "Got it" or "Snooze"
function playLoudAlarm() {
  stopLoudAlarm();
  try {
    const ctx = ensureAudio();
    const ON = 0.55, OFF = 0.35;          // each beep pair
    const REPEATS = 8;                     // 8 * 0.9s ≈ 7.2s
    const BASE = ctx.currentTime + 0.05;
    for (let i = 0; i < REPEATS; i++) {
      const t = BASE + i * (ON + OFF);
      playTone(ctx, 880, t, 0.45, 0.95);                       // high
      playTone(ctx, 1320, t + 0.22, 0.35, 0.95);                // higher accent
    }
    // Re-play every ~9s while alert is still showing
    alarmLoopId = setTimeout(() => {
      if (alertActive) playLoudAlarm();
    }, (ON + OFF) * REPEATS * 1000 + 1500);
  } catch {}
}

function stopLoudAlarm() {
  if (alarmLoopId !== null) {
    clearTimeout(alarmLoopId);
    alarmLoopId = null;
  }
  // Cut any sustained oscillators quickly by closing and recreating context
  try {
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
    }
  } catch {}
  audioCtx = null;
}

// ---- Ring timer ----
let timerInt = null, timerSec = 0;
function setRing(frac) {
  $('ringFill').style.strokeDashoffset = String(RING_LENGTH * (1 - frac));
}
function updateRing() {
  const total = timerTotalSec || 1;
  setRing(Math.max(0, timerSec) / total);
  const m = Math.max(0, Math.floor(timerSec / 60));
  const s = Math.max(0, timerSec % 60);
  $('ringTime').textContent = pad(m) + ':' + pad(s);
  $('ringTime').classList.toggle('running', timerSec > 0);
}
let timerTotalSec = 0;
let timerName = 'Timer';

function startTimer(sec, label) {
  if (timerInt) clearInterval(timerInt);
  timerTotalSec = sec; timerSec = sec; timerName = label || 'Timer';
  $('timerLabel').textContent = timerName;
  updateRing();
  $('timerStartBtn').textContent = '▶ Restart';
  timerInt = setInterval(() => {
    timerSec--;
    if (timerSec <= 0) {
      clearInterval(timerInt); timerInt = null;
      timerSec = 0;
      updateRing();
      $('timerStartBtn').textContent = '▶ Start';
      showAlert('⏰', 'Time\'s up!', timerName + ' finished');
      state.alarmLog.push({ at: Date.now(), message: '⏰ ' + timerName });
      save();
      return;
    }
    updateRing();
  }, 1000);
}

// ---- Scheduler ----
function checkSchedule() {
  const now = new Date();
  const hhmm = fmtUSClock(now);  // "08:00" in US timezone
  const usDay = now.toLocaleDateString('en-CA', { timeZone: tz() }); // YYYY-MM-DD
  const tk = usDay + '|' + hhmm;

  state.medications.forEach(m => {
    if (!m.enabled) return;
    if (m.time === hhmm && !state.lastTriggered.meds[tk] && !alertActive) {
      showAlert('💊', 'Time for medication', `${m.name}${m.dosage ? ' · ' + m.dosage : ''} (${m.time})`);
      state.lastTriggered.meds[tk] = Date.now();
      state.alarmLog.push({ at: Date.now(), message: '💊 ' + m.name });
      save();
    }
  });

  state.careTasks.forEach(c => {
    if (!c.enabled || alertActive) return;
    const last = state.lastTriggered.care[c.id] || 0;
    if (Date.now() - last >= c.interval * 3600000) {
      const dueKey = c.id + '|' + usDay;
      if (!state.lastTriggered.care[dueKey]) {
        showAlert('🩺', 'Care task due', `${c.name} (every ${c.interval} hours)`);
        state.lastTriggered.care[dueKey] = Date.now();
        state.alarmLog.push({ at: Date.now(), message: '🩺 ' + c.name });
        save();
      }
    }
  });

  renderToday();
}

// ---- Booking ----
let bookingProv = null;
function openBooking(providerId) {
  const p = RIDE_PROVIDERS.find(x => x.id === providerId);
  if (!p) return;
  bookingProv = p;
  $('bookIcon').textContent = p.icon;
  $('bookTitle').textContent = p.name;
  $('bookSub').textContent = p.desc;
  const defDest = (state.destinations || []).find(d => d.isDefault);
  $('bookPickup').value = defDest ? defDest.label : '';
  $('bookNotes').value = profileNotes();
  $('bookCallBtn').hidden = !p.phone;
  $('bookWebBtn').hidden = !p.web;
  $('bookLaunchBtn').textContent = p.deeplink ? '▶ Launch ' + p.name : (p.phone ? '📞 Call now' : '🌐 Open website');
  openSheet('bookSheet');
}

function launchBooking() {
  if (!bookingProv) return;
  state.trips = state.trips || [];
  state.trips.push({
    at: Date.now(),
    providerId: bookingProv.id,
    fromLabel: $('bookPickup').value.trim() || 'Current location',
    toLabel: $('bookDropoff').value.trim() || '—'
  });
  state.trips = state.trips.slice(-30);
  save();
  renderRides();

  if (bookingProv.deeplink) {
    const t = Date.now();
    window.location.href = bookingProv.deeplink;
    setTimeout(() => {
      if (Date.now() - t < 2500 && bookingProv.web) {
        try { window.open(bookingProv.web, '_blank'); } catch {}
      }
    }, 1500);
  } else if (bookingProv.phone) {
    window.location.href = 'tel:' + bookingProv.phone;
  } else if (bookingProv.web) {
    window.open(bookingProv.web, '_blank');
  }
  closeSheet('bookSheet');
}

// ---- Seed ----
function seed() {
  if (state.medications.length || state.careTasks.length) return;
  state.medications.push(
    { id: newId(), name: 'Heart Medication', dosage: '1 tablet', time: '08:00', enabled: true, notes: 'After breakfast' },
    { id: newId(), name: 'Vitamin D', dosage: '1 tablet', time: '20:00', enabled: true, notes: '' }
  );
  state.careTasks.push(
    { id: newId(), name: 'Catheterization', interval: 4, enabled: true, notes: 'Track fluids' }
  );
  if (!state.destinations.length) {
    state.destinations = [
      { id: newId(), label: 'Home', address: '123 Main St', isDefault: true },
      { id: newId(), label: 'Doctor', address: 'City Medical Plaza', isDefault: false }
    ];
  }
  if (!state.communityPosts || !state.communityPosts.length) {
    state.communityPosts = JSON.parse(JSON.stringify(DEFAULT_COMMUNITY));
  }
  save();
}

// ---- Events ----
function bind() {
  // Tab bar
  $$('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('[data-goto]').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.goto)));

  // Quick actions
  $('quickCath').addEventListener('click', () => {
    timerSec = 0; timerTotalSec = 0;
    $('timerLabel').textContent = 'Catheter care';
    openSheet('timerSheet');
    startTimer(4 * 3600, 'Catheter care');
  });
  $('quickTimer').addEventListener('click', () => {
    $('timerLabel').textContent = 'Timer';
    openSheet('timerSheet');
  });

  // Timer sheet
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    startTimer(Number(p.dataset.min) * 60, p.textContent + ' timer');
  }));
  $('timerStartBtn').addEventListener('click', () => {
    if (timerInt) { startTimer(timerTotalSec, timerName); return; }
    startTimer(20 * 60, 'Timer');
  });
  $('timerStopBtn').addEventListener('click', () => {
    if (timerInt) clearInterval(timerInt);
    timerInt = null; timerSec = 0; timerTotalSec = 0;
    updateRing();
    $('timerStartBtn').textContent = '▶ Start';
  });

  // Care segmented
  $$('.seg').forEach(s => s.addEventListener('click', () => {
    $$('.seg').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    $('segPaneMeds').hidden = s.dataset.seg !== 'meds';
    $('segPaneTasks').hidden = s.dataset.seg !== 'tasks';
  }));

  // Med form
  $('addMedBtn').addEventListener('click', () => {
    $('medSheetTitle').textContent = 'Add Medication';
    $('medForm').reset();
    $('medId').value = '';
    $('medTime').value = '08:00';
    $('medEnabled').checked = true;
    openSheet('medSheet');
  });
  $('medForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('medId').value || newId();
    const entry = {
      id, name: $('medName').value.trim(), dosage: $('medDosage').value.trim(),
      time: $('medTime').value, enabled: $('medEnabled').checked, notes: $('medNotes').value.trim()
    };
    if (!entry.name || !entry.time) return;
    const i = state.medications.findIndex(m => m.id === id);
    if (i >= 0) state.medications[i] = entry; else state.medications.push(entry);
    save(); closeSheet('medSheet'); renderCare(); renderToday();
  });

  // Care form
  $('addCareBtn').addEventListener('click', () => {
    $('careSheetTitle').textContent = 'Add Care Task';
    $('careForm').reset();
    $('careId').value = '';
    $('careInterval').value = 4;
    $('careEnabled').checked = true;
    openSheet('careSheet');
  });
  $('careForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('careId').value || newId();
    const entry = {
      id, name: $('careName').value.trim(), interval: Number($('careInterval').value),
      enabled: $('careEnabled').checked, notes: $('careNotes').value.trim()
    };
    if (!entry.name || !entry.interval) return;
    const i = state.careTasks.findIndex(c => c.id === id);
    if (i >= 0) state.careTasks[i] = entry; else state.careTasks.push(entry);
    save(); closeSheet('careSheet'); renderCare(); renderToday();
  });

  // Care list interactions (delegated)
  $('medList').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-med]');
    const sw = e.target.closest('input[data-med]');
    if (editBtn) {
      const m = state.medications.find(x => x.id === editBtn.dataset.editMed);
      $('medSheetTitle').textContent = 'Edit Medication';
      $('medId').value = m.id; $('medName').value = m.name; $('medDosage').value = m.dosage || '';
      $('medTime').value = m.time; $('medEnabled').checked = m.enabled; $('medNotes').value = m.notes || '';
      openSheet('medSheet');
    }
  });
  $('medList').addEventListener('change', (e) => {
    const sw = e.target.closest('input[data-med]');
    if (!sw) return;
    const m = state.medications.find(x => x.id === sw.dataset.med);
    if (m) { m.enabled = sw.checked; save(); renderToday(); }
  });

  $('careList').addEventListener('click', (e) => {
    const doneBtn = e.target.closest('[data-done-care]');
    const editBtn = e.target.closest('[data-edit-care]');
    if (doneBtn) {
      state.lastTriggered.care[doneBtn.dataset.doneCare] = Date.now();
      delete state.lastTriggered.care[doneBtn.dataset.doneCare + '|' + todayKey()];
      save(); renderCare(); renderToday();
    } else if (editBtn) {
      const c = state.careTasks.find(x => x.id === editBtn.dataset.editCare);
      $('careSheetTitle').textContent = 'Edit Care Task';
      $('careId').value = c.id; $('careName').value = c.name; $('careInterval').value = c.interval;
      $('careEnabled').checked = c.enabled; $('careNotes').value = c.notes || '';
      openSheet('careSheet');
    }
  });
  $('careList').addEventListener('change', (e) => {
    const sw = e.target.closest('input[data-care]');
    if (!sw) return;
    const c = state.careTasks.find(x => x.id === sw.dataset.care);
    if (c) { c.enabled = sw.checked; save(); renderToday(); }
  });

  // Ride filters
  $$('.chip').forEach(c => c.addEventListener('click', () => {
    $$('.chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.rideFilter = c.dataset.filter;
    save();
    renderRides();
  }));

  // Provider tap → booking sheet
  $('providerList').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-provider]');
    if (cell) openBooking(cell.dataset.provider);
  });

  // Booking
  $('bookLaunchBtn').addEventListener('click', launchBooking);
  $('bookWebBtn').addEventListener('click', () => {
    if (bookingProv && bookingProv.web) window.open(bookingProv.web, '_blank');
  });
  $('bookCallBtn').addEventListener('click', () => {
    if (bookingProv && bookingProv.phone) window.location.href = 'tel:' + bookingProv.phone;
  });

  // Profile sheet
  const openProf = () => {
    const p = state.accessibility || {};
    $('profChair').value = p.chairType || 'power';
    $('profWAV').checked = p.needWAV !== false;
    $('profRamp').checked = !!p.needRamp;
    $('profLift').checked = !!p.needLift;
    $('profAssist').checked = !!p.needAssist;
    $('profAnimal').checked = !!p.serviceAnimal;
    $('profNotes').value = p.notes || '';
    openSheet('profSheet');
  };
  $('profileCard').addEventListener('click', openProf);
  $('meProfile').addEventListener('click', openProf);
  $('profForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.accessibility = {
      chairType: $('profChair').value,
      needWAV: $('profWAV').checked,
      needRamp: $('profRamp').checked,
      needLift: $('profLift').checked,
      needAssist: $('profAssist').checked,
      serviceAnimal: $('profAnimal').checked,
      notes: $('profNotes').value.trim()
    };
    save(); closeSheet('profSheet'); renderRides();
  });

  // Sheet close buttons + backdrops
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.dataset.close)));
  $$('.sheet-backdrop').forEach(bd => bd.addEventListener('click', () => {
    bd.classList.remove('show');
    const sheet = bd.nextElementSibling;
    sheet.classList.remove('show');
    setTimeout(() => { bd.hidden = true; sheet.hidden = true; }, 320);
  }));

  // Alert buttons
  $('alertOk').addEventListener('click', hideAlert);
  $('alertSnooze').addEventListener('click', () => {
    hideAlert();
    closeSheet('timerSheet');
    setTimeout(() => {
      openSheet('timerSheet');
      startTimer(5 * 60, 'Snooze');
    }, 400);
  });

  // SOS
  $('sosFab').addEventListener('click', openSOS);
  $('sosCall911').addEventListener('click', call911);
  $('sosCallContact').addEventListener('click', callContact);

  // Emergency contact form
  $('meContact').addEventListener('click', openContact);
  $('contactForm').addEventListener('submit', saveContact);
  $('contactClearBtn').addEventListener('click', clearContact);

  // Mood
  $$('.mood-btn').forEach(b => b.addEventListener('click', () => setMood(b.dataset.mood)));

  // Companion chat
  $('chatSendBtn').addEventListener('click', sendChat);
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });

  // Community
  $('commList').addEventListener('click', (e) => {
    const like = e.target.closest('[data-like]');
    if (like) toggleLike(like.dataset.like);
  });
  $('postPublishBtn').addEventListener('click', publishPost);

  // Today page entry cards
  $('openCompanionBtn').addEventListener('click', openCompanion);
  $('openCommunityBtn').addEventListener('click', openCommunity);

  // Timezone picker
  $('tzSelect').addEventListener('change', (e) => {
    state.timezone = e.target.value;
    save();
    tickClock();
    renderToday();
    renderMe();
  });
}

// ---- Init ----
function init() {
  bind();
  seed();
  tickClock();
  setInterval(tickClock, 30000);
  renderToday();
  renderCare();
  renderRides();
  renderMe();
  checkSchedule();
  setInterval(checkSchedule, 30000);
}

function renderMe() {
  $('meTripSub').textContent = (state.trips || []).length + ' recent';
  const p = state.accessibility;
  $('meProfSub').textContent = p ? 'Profile set ✓' : 'Not set up yet';

  // Emergency contact summary
  const c = state.emergencyContact;
  $('meContactSub').textContent = c
    ? `${c.name}${c.relationship ? ' · ' + c.relationship : ''} · ${c.phone}`
    : 'Tap to add a person we can call for you';

  // SOS contact button
  if (c) {
    $('sosCallContact').hidden = false;
    $('sosContactName').textContent = c.name;
    $('sosContactPhone').textContent = c.phone;
  } else {
    $('sosCallContact').hidden = true;
  }

  // Mood history (last 7 days)
  const today = todayKey();
  $$('.mood-btn').forEach(b => {
    b.classList.toggle('active', state.moodLog[today] === b.dataset.mood);
  });
  const hist = $('moodHistory');
  hist.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toLocaleDateString('en-CA', { timeZone: tz() });
    days.push({ k, m: state.moodLog[k] });
  }
  days.forEach(({ k, m }) => {
    const cell = document.createElement('div');
    cell.className = 'mood-day';
    cell.title = k;
    cell.innerHTML = `<span class="mood-day-emoji">${m || '·'}</span><span class="mood-day-label">${k.slice(5)}</span>`;
    hist.appendChild(cell);
  });

  // Timezone select
  const sel = $('tzSelect');
  if (sel) {
    if (!sel.options.length) {
      TZ_OPTIONS.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
      });
    }
    sel.value = tz();
  }
  const tzLabel = $('tzLabel');
  if (tzLabel) tzLabel.textContent = 'Currently: ' + (TZ_OPTIONS.find(o => o.value === tz())?.label || tz());
}

// ---- SOS ----
function openSOS() {
  // Pre-render the contact row visibility
  const c = state.emergencyContact;
  $('sosCallContact').hidden = !c;
  if (c) {
    $('sosContactName').textContent = c.name;
    $('sosContactPhone').textContent = c.phone;
  }
  openSheet('sosSheet');
}

function call911() {
  // iOS Safari will prompt and dial
  window.location.href = 'tel:911';
}

function callContact() {
  const c = state.emergencyContact;
  if (!c || !c.phone) return;
  // Strip non-dial characters; keep + and digits
  const phone = c.phone.replace(/[^\d+]/g, '');
  window.location.href = 'tel:' + phone;
}

// ---- Emergency contact form ----
function openContact() {
  const c = state.emergencyContact || {};
  $('contactName').value = c.name || '';
  $('contactPhone').value = c.phone || '';
  $('contactRel').value = c.relationship || 'family';
  $('contactClearBtn').style.display = c.name ? '' : 'none';
  openSheet('contactSheet');
}
function saveContact(e) {
  e.preventDefault();
  const name = $('contactName').value.trim();
  const phone = $('contactPhone').value.trim();
  if (!name || !phone) return;
  state.emergencyContact = { name, phone, relationship: $('contactRel').value };
  save();
  closeSheet('contactSheet');
  renderMe();
}
function clearContact() {
  state.emergencyContact = null;
  save();
  closeSheet('contactSheet');
  renderMe();
}

// ---- Mood ----
const MOOD_EMOJI = ['😄', '🙂', '😐', '😔', '😣'];
function setMood(emoji) {
  state.moodLog = state.moodLog || {};
  const today = todayKey();
  state.moodLog[today] = state.moodLog[today] === emoji ? '' : emoji;
  if (!state.moodLog[today]) delete state.moodLog[today];
  save();
  renderMe();
}

// ---- Companion Chat (Sunny) ----
const BOT_RULES = [
  { keys: ['sad', 'lonely', 'down', 'depress', 'cry', 'tear'], replies: [
    "I'm right here with you 💛 Take one slow breath — in for 4, out for 4.",
    "It's okay to feel that way. Want me to call your emergency contact? You can also tap SOS anytime.",
    "Sending you a big virtual hug 🫂. A glass of water and a 5-minute timer can sometimes shift the mood."
  ]},
  { keys: ['pain', 'hurt', 'fell', 'sick', 'bleed'], replies: [
    "I want to make sure you're safe. Tap the red SOS button at the bottom right if you need help now.",
    "Tell me where it hurts — I'll log it so you can share with your doctor later.",
    "If it's urgent, please call 911 or your contact right away. I'm here either way."
  ]},
  { keys: ['happy', 'great', 'good', 'amazing', 'excited', 'love'], replies: [
    "Love that! 🎉 You earned it.",
    "Saving this as today's mood. Anything fun planned?",
    "Wanna share it with the community? Tap the Community card."
  ]},
  { keys: ['tired', 'exhaust', 'sleep', 'rest'], replies: [
    "Rest is real medicine. Want me to start a 20-min power-nap timer?",
    "How's your sleep been lately? We can log this so your doctor sees the pattern."
  ]},
  { keys: ['water', 'thirst', 'drink', 'hydrate'], replies: [
    "Great call! Starting a 1-hour water reminder 💧",
    "Hydration matters a lot for wheelchair users. I'll nudge you every hour."
  ]},
  { keys: ['med', 'pill', 'vitamin', 'heart med'], replies: [
    "I'll send a loud reminder at the scheduled time. You can also see today's list on the Today page.",
    "Your schedule: 8:00 AM heart med, 8:00 PM vitamin D. Anything to add or change?"
  ]},
  { keys: ['cath', 'catheter'], replies: [
    "Catheter care is set for every 4 hours. I'll alert you with a long loud alarm.",
    "Stay hydrated — that makes catheter care easier. Want a water reminder too?"
  ]},
  { keys: ['ride', 'uber', 'lyft', 'transport', 'doctor visit'], replies: [
    "Open the Rides tab — I can show WAV options, GoGoGrandparent (call-only), and paratransit.",
    "For doctor visits, paratransit is cheapest if you book 24h ahead. WAV is faster on demand."
  ]},
  { keys: ['help', 'sos', 'emergency', 'scared'], replies: [
    "Tap the red SOS button at the bottom right. It can dial 911 instantly.",
    "I'm here. Take a breath. Do you want me to open the SOS sheet?"
  ]},
  { keys: ['thank', 'thanks'], replies: [
    "Anytime, friend 💛",
    "That's what I'm here for. Talk soon.",
    "😊 Stay well."
  ]}
];
const BOT_FALLBACK = [
  "Tell me more — I'm listening 💛",
  "How does that make you feel?",
  "I'm right here whenever you need me.",
  "Got it. Anything else on your mind?"
];
function botReply(text) {
  const t = (text || '').toLowerCase();
  for (const g of BOT_RULES) {
    if (g.keys.some(k => t.indexOf(k) >= 0)) {
      return g.replies[Math.floor(Math.random() * g.replies.length)];
    }
  }
  return BOT_FALLBACK[Math.floor(Math.random() * BOT_FALLBACK.length)];
}

function openCompanion() {
  if (!state.companionChat || !state.companionChat.length) {
    state.companionChat = [
      { from: 'bot', text: "Hi! I'm Sunny, your care companion ☀️ How are you feeling today?", at: Date.now() }
    ];
    save();
  }
  renderCompanion();
  openSheet('companionSheet');
  setTimeout(() => {
    const c = $('chatInput');
    if (c) c.focus();
    const m = $('chatScroll');
    if (m) m.scrollTop = m.scrollHeight;
  }, 360);
}
function renderCompanion() {
  const box = $('chatLog');
  box.innerHTML = '';
  (state.companionChat || []).forEach(m => {
    const div = document.createElement('div');
    div.className = 'bubble ' + (m.from === 'me' ? 'me' : 'bot');
    div.innerHTML = `<div class="bubble-text">${esc(m.text)}</div><div class="bubble-time">${fmtUSAMPM(new Date(m.at))}</div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}
function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  state.companionChat = state.companionChat || [];
  state.companionChat.push({ from: 'me', text, at: Date.now() });
  input.value = '';
  renderCompanion();
  save();
  // Simulate bot reply
  setTimeout(() => {
    state.companionChat.push({ from: 'bot', text: botReply(text), at: Date.now() });
    renderCompanion();
    save();
  }, 700);
}

// ---- Community ----
function openCommunity() {
  renderCommunity();
  openSheet('communitySheet');
}
function renderCommunity() {
  const list = $('commList');
  list.innerHTML = '';
  const posts = (state.communityPosts || []).slice().reverse();
  if (!posts.length) {
    list.innerHTML = '<div class="empty">No posts yet. Be the first to share!</div>';
    return;
  }
  posts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'comm-card';
    card.innerHTML = `
      <div class="comm-head">
        <span class="comm-avatar">${esc(p.avatar || '🌟')}</span>
        <div class="comm-meta">
          <div class="comm-name">${esc(p.name)}</div>
          <div class="comm-time">${esc(p.time)}</div>
        </div>
      </div>
      <div class="comm-text">${esc(p.text)}</div>
      <div class="comm-actions">
        <button class="comm-like ${p.liked ? 'liked' : ''}" data-like="${p.id}">
          <span>${p.liked ? '❤️' : '🤍'}</span>
          <span>${p.likes}</span>
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}
function toggleLike(id) {
  state.communityPosts = state.communityPosts || [];
  const p = state.communityPosts.find(x => x.id === id);
  if (!p) return;
  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;
  save();
  renderCommunity();
}
function publishPost() {
  const text = $('postInput').value.trim();
  if (!text) return;
  state.communityPosts = state.communityPosts || [];
  state.communityPosts.push({
    id: newId(),
    avatar: '🌟',
    name: 'You · ' + (TZ_OPTIONS.find(t => t.value === tz())?.label.split(' ')[0] || 'US'),
    time: 'Just now',
    text,
    likes: 0,
    liked: false,
    own: true
  });
  $('postInput').value = '';
  save();
  renderCommunity();
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    init();
  } catch (e) {
    var d = document.createElement('div');
    d.textContent = 'Startup Error: ' + (e && e.message ? e.message : String(e));
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#FF3B30;color:#fff;padding:12px;font-size:13px;font-family:sans-serif;';
    document.body.appendChild(d);
  }
});
