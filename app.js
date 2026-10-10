/* =============================
   MyDailyCare · Logic v3
   - Medications (daily fixed times)
   - Care tasks (interval-based)
   - 7-day calendar
   - Quick timer / catheter 4h quick launch
   - Accessible Rides aggregator (US)
     · Curated provider list with category filters
     · Accessibility profile + saved destinations
     · Booking flow with deeplink → web → phone fallback
     · Trip history
   - Browser notifications + audio cues
   - localStorage persistence (key v3, migrates v1 & v2)
   ============================= */

const STORAGE_KEY = 'mydailycare.state.v4';

const defaultState = {
  medications: [],
  careTasks: [],
  lastTriggered: { meds: {}, care: {} },
  alarmLog: [],
  // ---- v3 fields ----
  accessibility: null,         // { chairType, needWAV, needRamp, needLift, needAssist, serviceAnimal, notes }
  destinations: [],            // [{ id, label, address, isDefault }]
  trips: [],                   // [{ at, providerId, fromLabel, toLabel, notes }]
  currentLocation: null,       // { lat, lon, label }
  rideFilter: 'all',
  // ---- v4 fields ----
  community: {
    interests: [],
    bio: '',
    saved: [],
    notes: [],
    filter: 'all',
    localSocial: {
      city: '',
      cardDraft: ''
    }
  }
};

// ---- Curated US disability communities (real, public, free) ----
const COMMUNITY_RESOURCES = [
  {
    id: 'the-mighty',
    name: 'The Mighty',
    icon: '💪',
    category: 'general',
    members: '2M+',
    focus: ['general'],
    description: 'One of the largest online communities for people facing disability, disease and mental illness. Stories, groups and Q&A with peers.',
    url: 'https://themighty.com'
  },
  {
    id: 'reddit-disability',
    name: 'r/disability (Reddit)',
    icon: '💬',
    category: 'general',
    members: '60K+',
    focus: ['general'],
    description: 'Broad disability discussion on Reddit — news, rights, humor, advice, and everyday life. Very active.',
    url: 'https://www.reddit.com/r/disability/'
  },
  {
    id: 'reddit-wheelchairs',
    name: 'r/wheelchairs (Reddit)',
    icon: '🛞',
    category: 'wheelchair',
    members: '15K+',
    focus: ['wheelchair'],
    description: 'Everything wheelchair-related: gear, transfers, travel, accessibility reviews. Ask questions and swap tips with other chair users.',
    url: 'https://www.reddit.com/r/wheelchairs/'
  },
  {
    id: 'united-spinal',
    name: 'United Spinal Association',
    icon: '🌀',
    category: 'wheelchair',
    members: '50K+',
    focus: ['wheelchair'],
    description: 'National nonprofit for people with spinal cord injuries and disorders. Local chapters, peer mentoring, and advocacy.',
    url: 'https://unitedspinal.org'
  },
  {
    id: 'aha-support',
    name: 'American Heart Association — Support Network',
    icon: '❤️',
    category: 'heart',
    members: '100K+',
    focus: ['heart'],
    description: 'Peer support for heart patients and caregivers. Condition-specific groups for heart disease recovery and management.',
    url: 'https://supportnetwork.heart.org'
  },
  {
    id: 'chadd',
    name: 'CHADD — Adults with ADHD',
    icon: '🧠',
    category: 'adhd',
    members: '20K+',
    focus: ['adhd'],
    description: 'National ADHD resource. Local support groups, online communities, and evidence-based toolkits for adults with ADHD.',
    url: 'https://chadd.org/adults/'
  },
  {
    id: 'reddit-adhd',
    name: 'r/ADHD (Reddit)',
    icon: '⚡',
    category: 'adhd',
    members: '1M+',
    focus: ['adhd'],
    description: 'Massive peer community for people with ADHD. Daily strategies, medication questions, and support.',
    url: 'https://www.reddit.com/r/ADHD/'
  },
  {
    id: 'pva',
    name: 'Paralyzed Veterans of America',
    icon: '🎖️',
    category: 'veterans',
    members: '20K+',
    focus: ['veterans', 'wheelchair'],
    description: 'Veterans with spinal cord injury or disease. Advocacy, sports, and a national peer-mentor network.',
    url: 'https://pva.org'
  },
  {
    id: 'mda',
    name: 'Muscular Dystrophy Association (MDA)',
    icon: '🧬',
    category: 'condition',
    members: '—',
    focus: ['neuromuscular'],
    description: 'Community and support for people living with muscular dystrophy, ALS, and related neuromuscular diseases.',
    url: 'https://www.mda.org'
  },
  {
    id: 'spinabifida-assoc',
    name: 'Spina Bifida Association',
    icon: '🦴',
    category: 'condition',
    members: '—',
    focus: ['spina-bifida'],
    description: 'National community for people with spina bifida. Local chapters, webinars, and peer groups.',
    url: 'https://www.spinabifidaassociation.org'
  },
  {
    id: 'patientslikeme',
    name: 'PatientsLikeMe',
    icon: '🩺',
    category: 'condition',
    members: '800K+',
    focus: ['general', 'heart'],
    description: 'Share outcomes and learn from others with the same condition. Structured, data-driven peer community.',
    url: 'https://www.patientslikeme.com'
  },
  {
    id: 'everyday-heart',
    name: 'Everyday Health — Heart Disease Community',
    icon: '🫀',
    category: 'heart',
    members: '—',
    focus: ['heart'],
    description: 'Q&A and discussion boards for people managing heart disease, arrhythmias, and heart failure.',
    url: 'https://www.everydayhealth.com/heart-health/'
  }
];

const INTEREST_OPTIONS = [
  { id: 'wheelchair',   label: 'Wheelchair user', icon: '🛞' },
  { id: 'heart',       label: 'Heart condition', icon: '❤️' },
  { id: 'adhd',        label: 'ADHD',            icon: '🧠' },
  { id: 'veterans',    label: 'Veterans',        icon: '🎖️' },
  { id: 'neuromuscular', label: 'Neuromuscular', icon: '🧬' },
  { id: 'spina-bifida', label: 'Spina bifida',   icon: '🦴' },
  { id: 'general',     label: 'General disability community', icon: '💪' }
];

// ---- National orgs with local chapters / in-person programs ----
const CHAPTER_FINDER = [
  {
    id: 'cil',
    name: 'Center for Independent Living (CIL)',
    icon: '🏛️',
    desc: 'Every U.S. region has a CIL — peer-run centers with local events, advocacy and independent-living skills.',
    url: 'https://ilru.org/projects/cil-net/cil-directories'
  },
  {
    id: 'united-spinal-chapters',
    name: 'United Spinal Chapters',
    icon: '🌀',
    desc: 'Local spinal cord injury peer groups and social events across the country.',
    url: 'https://unitedspinal.org/chapters'
  },
  {
    id: 'move-united',
    name: 'Move United (Adaptive Sports)',
    icon: '🏅',
    desc: '200+ adaptive sports chapters — wheelchair basketball, skiing, cycling and more, near you.',
    url: 'https://moveunitedsport.org/chapters/'
  },
  {
    id: 'chadd-groups',
    name: 'CHADD Support Groups',
    icon: '🧠',
    desc: 'In-person ADHD support groups by state — meet other adults managing ADHD.',
    url: 'https://chadd.org/support-groups/'
  },
  {
    id: 'mda-care',
    name: 'MDA Care & Community',
    icon: '🧬',
    desc: 'Local MDA chapters, care centers and family community events.',
    url: 'https://www.mda.org/care/care-center-locations'
  },
  {
    id: 'special-olympics',
    name: 'Special Olympics Programs',
    icon: '🏆',
    desc: 'Local inclusive sports programs and volunteer communities in your state.',
    url: 'https://www.specialolympics.org/programs'
  }
];

// ---- Curated US accessible ride providers ----
const RIDE_PROVIDERS = [
  {
    id: 'uber-wav',
    name: 'Uber WAV',
    icon: '🚐',
    color: '#000000',
    category: 'wav',
    coverage: 'Nationwide',
    costLabel: '$$',
    waitLabel: '5–20 min',
    accessibleTypes: ['WAV', 'foldable'],
    summary: 'Uber\'s wheelchair-accessible vehicles. Ramp-equipped vans in most major cities; driver assistance available.',
    note: 'Pick "WAV" in the Uber vehicle picker.',
    deeplink: 'uber://?action=setPickup&pickup=my_location',
    webUrl: 'https://m.uber.com/looking',
    phone: ''
  },
  {
    id: 'lyft-access',
    name: 'Lyft Access',
    icon: '🛞',
    color: '#EA0B8C',
    category: 'wav',
    coverage: 'Major US metros',
    costLabel: '$$',
    waitLabel: '5–25 min',
    accessibleTypes: ['WAV', 'driver-assist'],
    summary: 'Lyft\'s wheelchair-accessible rides. Trained drivers and accessible vehicles in select cities.',
    note: 'Choose "Wheelchair" ride type.',
    deeplink: 'lyft://ridetype?id=wheelchair',
    webUrl: 'https://www.lyft.com/ride',
    phone: ''
  },
  {
    id: 'gogograndparent',
    name: 'GoGoGrandparent',
    icon: '☎️',
    color: '#0E5BA8',
    category: 'phone',
    coverage: 'Nationwide · 24/7',
    costLabel: '$$',
    waitLabel: '15–30 min',
    accessibleTypes: ['WAV', 'foldable', 'driver-assist'],
    summary: 'Phone-based ride service for older adults and riders with disabilities. Trained operators screen drivers for accessibility. Adds a small per-mile fee on top of Uber/Lyft.',
    note: 'No app needed — they handle the booking for you.',
    deeplink: '',
    webUrl: 'https://gogograndparent.com',
    phone: '+18554646872'  // 1-855-464-6872
  },
  {
    id: 'curb',
    name: 'Curb',
    icon: '🚕',
    color: '#F4B400',
    category: 'taxi',
    coverage: '20+ US cities',
    costLabel: '$',
    waitLabel: '5–15 min',
    accessibleTypes: ['WAV', 'foldable'],
    summary: 'Hail a metered taxi from your phone. Filter for WAV in participating cities.',
    note: 'Set your accessibility preferences in the app for better matches.',
    deeplink: 'curbapp://open',
    webUrl: 'https://gocurb.com',
    phone: ''
  },
  {
    id: 'uber-assist',
    name: 'Uber Assist',
    icon: '🤝',
    color: '#276EF1',
    category: 'driver-assist',
    coverage: 'Major US metros',
    costLabel: '$$',
    waitLabel: '5–15 min',
    accessibleTypes: ['foldable', 'driver-assist'],
    summary: 'Standard Uber with drivers trained to assist riders with mobility devices. Foldable chair must fit a trunk.',
    note: 'Pick "Assist" in the Uber vehicle picker.',
    deeplink: 'uber://?action=setPickup',
    webUrl: 'https://m.uber.com/looking',
    phone: ''
  },
  {
    id: 'uber',
    name: 'Uber (Standard)',
    icon: '🚗',
    color: '#111111',
    category: 'standard',
    coverage: 'Nationwide',
    costLabel: '$',
    waitLabel: '3–10 min',
    accessibleTypes: ['foldable'],
    summary: 'Standard Uber rides. Best when you can transfer to a regular car seat and your chair folds into a trunk.',
    note: '',
    deeplink: 'uber://?action=setPickup',
    webUrl: 'https://m.uber.com',
    phone: ''
  },
  {
    id: 'lyft',
    name: 'Lyft (Standard)',
    icon: '🟣',
    color: '#EA0B8C',
    category: 'standard',
    coverage: 'Nationwide',
    costLabel: '$',
    waitLabel: '3–10 min',
    accessibleTypes: ['foldable'],
    summary: 'Standard Lyft rides. Best when you can transfer to a regular car seat.',
    note: '',
    deeplink: 'lyft://ridetype?id=lyft',
    webUrl: 'https://www.lyft.com',
    phone: ''
  },
  {
    id: 'paratransit',
    name: 'Local Paratransit',
    icon: '🚌',
    color: '#1976D2',
    category: 'public',
    coverage: 'Your city',
    costLabel: '$',
    waitLabel: 'Varies',
    accessibleTypes: ['WAV', 'foldable', 'driver-assist'],
    summary: 'Public ADA paratransit service. Requires eligibility registration with your city\'s transit agency. Bookings typically 24h ahead; very low cost.',
    note: 'Search "[your city] paratransit" to find your local number.',
    deeplink: '',
    webUrl: 'https://www.transit.dot.gov/accessibility',
    phone: ''
  }
];

const CATEGORY_LABELS = {
  all: 'All providers',
  wav: 'Wheelchair-accessible',
  'driver-assist': 'Driver assistance',
  standard: 'Standard (foldable)',
  phone: 'Phone-based',
  public: 'Public transit',
  taxi: 'Taxi'
};

let state = null;
let timerInterval = null;
let timerRemaining = 0;
let timerTotal = 0;
let timerLabel = '';
let calOffsetDays = 0;
let bookingProvider = null;

// ---- DOM helpers ----
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---- Auth (local accounts, device-only) ----
const ACCOUNTS_KEY = 'mydailycare.accounts';
const SESSION_KEY = 'mydailycare.session';
let currentUser = null;

function dataKey(username) {
  return username ? STORAGE_KEY + '@' + username : STORAGE_KEY;
}
function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || {}; } catch { return {}; }
}
function saveAccounts(a) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
async function hashPassword(pass, salt) {
  const data = new TextEncoder().encode(salt + ':' + pass);
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const b of data) h = ((h << 5) - h + b) | 0;
  return 'fb' + Math.abs(h).toString(16);
}

let authMode = 'signin';

function setupAuth() {
  const session = getSession();
  if (session && (!session.username || getAccounts()[session.username])) {
    currentUser = session.username || null;
    enterApp();
    return;
  }
  $('authGate').hidden = false;

  $('authModeBtn').addEventListener('click', () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    $('authSubmitBtn').textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
    $('authModeBtn').textContent = authMode === 'signup' ? 'I already have an account' : 'Create an account';
    $('authError').hidden = true;
  });

  $('authGuestBtn').addEventListener('click', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: null }));
    currentUser = null;
    enterApp();
  });

  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('authUser').value.trim().toLowerCase();
    const pass = $('authPass').value;
    const err = $('authError');
    if (!name || !pass) return;
    const accounts = getAccounts();

    try {
      if (authMode === 'signup') {
        if (accounts[name]) {
          err.textContent = 'That username already exists. Try signing in instead.';
          err.hidden = false;
          return;
        }
        const salt = newId();
        const hash = await hashPassword(pass, salt);
        accounts[name] = { salt, hash };
        saveAccounts(accounts);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: name }));
        currentUser = name;
        enterApp();
      } else {
        const acc = accounts[name];
        if (!acc) {
          err.textContent = 'Account not found. Create one below.';
          err.hidden = false;
          return;
        }
        const hash = await hashPassword(pass, acc.salt);
        if (hash !== acc.hash) {
          err.textContent = 'Wrong password. Try again.';
          err.hidden = false;
          return;
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: name }));
        currentUser = name;
        enterApp();
      }
    } catch {
      err.textContent = 'Something went wrong. Please try again.';
      err.hidden = false;
    }
  });

  $('authUser').focus();
}

function enterApp() {
  $('authGate').hidden = true;
  state = loadState();
  const logoutBtn = $('logoutBtn');
  logoutBtn.hidden = !currentUser;
  if (currentUser) {
    logoutBtn.textContent = '👋 ' + currentUser;
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    });
  }
  init();
}

// ---- Persistence with v1/v2/v3 → v4 migration ----
function loadState() {
  try {
    const raw = localStorage.getItem(dataKey(currentUser));
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign(structuredClone(defaultState), parsed, {
        community: Object.assign(structuredClone(defaultState.community), parsed.community || {})
      });
    }
  } catch {}
  // Migration chain: guest storage only
  if (!currentUser) {
    try {
      const v3 = JSON.parse(localStorage.getItem('mydailycare.state.v3') || 'null');
      if (v3) {
        const base = structuredClone(defaultState);
        return Object.assign(base, v3, {
          community: structuredClone(defaultState.community)
        });
      }
    } catch {}
    try {
      const v2 = JSON.parse(localStorage.getItem('mydailycare.state.v2') || 'null');
      if (v2) {
        const base = structuredClone(defaultState);
        return Object.assign(base, v2, {
          accessibility: null,
          destinations: [],
          trips: [],
          currentLocation: null,
          rideFilter: 'all',
          community: structuredClone(defaultState.community)
        });
      }
    } catch {}
    try {
      const v1 = JSON.parse(localStorage.getItem('nicocare.state.v1') || 'null');
      if (v1) {
        const base = structuredClone(defaultState);
        return Object.assign(base, v1, {
          accessibility: null,
          destinations: [],
          trips: [],
          currentLocation: null,
          rideFilter: 'all',
          community: structuredClone(defaultState.community)
        });
      }
    } catch {}
  }
  return structuredClone(defaultState);
}
function saveState() {
  localStorage.setItem(dataKey(currentUser), JSON.stringify(state));
}

// ---- Time helpers ----
const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => new Date().toISOString().slice(0,10);
function nowHM() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function minutesUntil(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
  let diff = Math.round((target - d) / 60000);
  if (diff < -12*60) diff += 24*60;
  return diff;
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function hmFromTs(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ---- Audio ----
let audioCtx = null;
function beep(durationSec = 1, freq = 880) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + 0.2);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  } catch {}
}
function ringAlarm() {
  beep(0.4, 880);
  setTimeout(() => beep(0.4, 880), 600);
  setTimeout(() => beep(0.6, 1100), 1200);
}

// ---- Notification ----
async function ensureNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
}
function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch {}
  }
}

// ---- Alarm modal ----
let alarmModalShown = false;
function showAlarm(title, message) {
  alarmModalShown = true;
  ringAlarm();
  sendNotification(title, message);
  $('alarmModalTitle').textContent = title;
  $('alarmMessage').textContent = message;
  $('alarmModal').hidden = false;
}
function hideAlarm() {
  $('alarmModal').hidden = true;
  alarmModalShown = false;
}

// ---- Clock ----
function tickClock() {
  const d = new Date();
  $('nowTime').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  $('nowDate').textContent = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' });
}

// ---- Escape helper ----
function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])
  );
}

// ---- Home dashboard ----
function renderDashboard() {
  const enabledMeds = state.medications.filter(m => m.enabled);
  if (enabledMeds.length) {
    enabledMeds.sort((a,b) => minutesUntil(a.time) - minutesUntil(b.time));
    const next = enabledMeds[0];
    $('nextMedName').textContent = 'Next: ' + next.name + (next.dosage ? ' · ' + next.dosage : '');
    $('nextMedTime').textContent = next.time;
  } else {
    $('nextMedName').textContent = 'Next: none';
    $('nextMedTime').textContent = '--:--';
  }

  const enabledCare = state.careTasks.filter(c => c.enabled);
  if (enabledCare.length) {
    const enriched = enabledCare.map(c => {
      const last = state.lastTriggered.care[c.id];
      const dueAt = last ? (last + c.interval * 3600000) : Date.now();
      const ms = dueAt - Date.now();
      return { c, ms };
    }).sort((a,b) => a.ms - b.ms);
    const top = enriched[0];
    if (top.ms <= 0) {
      $('nextCareName').textContent = '🚨 Due now: ' + top.c.name;
      $('nextCareTime').textContent = 'Now';
    } else {
      const min = Math.round(top.ms / 60000);
      const hrs = Math.floor(min / 60);
      $('nextCareName').textContent = 'Next due: ' + top.c.name;
      $('nextCareTime').textContent = hrs > 0 ? (hrs + 'h ' + (min % 60) + 'm') : (min + ' min');
    }
  } else {
    $('nextCareName').textContent = 'Next due: none';
    $('nextCareTime').textContent = '--:--';
  }

  const todayItems = getEventsForDate(new Date());
  const todayMeds = todayItems.filter(x => x.type === 'med').length;
  const todayCare = todayItems.filter(x => x.type === 'care').length;
  $('weekTodayCount').textContent = (todayMeds + todayCare) + ' items today';
  $('weekCountMeta').textContent = todayMeds + ' med · ' + todayCare + ' care';

  renderToday();
}

function renderToday() {
  const ul = $('todayList');
  ul.innerHTML = '';
  const events = getEventsForDate(new Date());

  if (events.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = '📋 Nothing scheduled for today. Tap "Meds" or "Care" to add.';
    ul.appendChild(li);
    return;
  }
  events.forEach(ev => {
    const li = document.createElement('li');
    const icon = ev.type === 'med' ? '💊' : '🩺';
    const label = ev.type === 'med' ? 'Medication' : 'Care';
    li.innerHTML = `
      <div class="med-info">
        <strong>${icon} ${escapeHtml(ev.title)}</strong>
        <span class="med-meta">${escapeHtml(ev.detail || label)}</span>
      </div>
      <span class="item-time">${ev.time}</span>
    `;
    ul.appendChild(li);
  });
}

// ---- Calendar projection ----
function getEventsForDate(date) {
  const out = [];
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();

  state.medications.filter(m => m.enabled).forEach(m => {
    out.push({ type: 'med', time: m.time, title: m.name, detail: m.dosage || 'Medication', id: m.id });
  });

  state.careTasks.filter(c => c.enabled).forEach(c => {
    const last = state.lastTriggered.care[c.id];
    const intervalMs = c.interval * 3600000;

    if (!last) {
      for (let i = 0; i < 24; i += c.interval) {
        const t = new Date(date);
        t.setHours(i, 0, 0, 0);
        if (t.getTime() >= dayStart && t.getTime() <= dayEnd) {
          out.push({ type: 'care', time: hmFromTs(t.getTime()), title: c.name, detail: 'Every ' + c.interval + 'h', id: c.id });
        }
      }
      return;
    }

    let t = last + intervalMs;
    let safety = 0;
    while (t <= dayEnd + intervalMs && safety++ < 200) {
      if (t >= dayStart && t <= dayEnd) {
        out.push({ type: 'care', time: hmFromTs(t), title: c.name, detail: 'Every ' + c.interval + 'h', id: c.id });
      }
      t += intervalMs;
    }
  });

  out.sort((a,b) => a.time.localeCompare(b.time));
  return out;
}

function renderCalendar() {
  const container = $('dayCards');
  container.innerHTML = '';
  const today = startOfDay(new Date());
  const start = addDays(today, calOffsetDays);
  const end = addDays(start, 6);
  const opts = { month: 'short', day: 'numeric' };
  $('calRange').textContent = start.toLocaleDateString('en-US', opts) + ' – ' + end.toLocaleDateString('en-US', opts);

  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const events = getEventsForDate(date);
    const medCount = events.filter(e => e.type === 'med').length;
    const careCount = events.filter(e => e.type === 'care').length;
    const isToday = startOfDay(date).getTime() === today.getTime();

    const card = document.createElement('div');
    card.className = 'day-card' + (isToday ? ' today' : '');
    card.setAttribute('role', 'listitem');

    const dowName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const dom = date.getDate();
    const summaryTitle = isToday ? 'Today · ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                                 : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const counts = (medCount + careCount) === 0
      ? '<span style="color:var(--text-dim);">No items</span>'
      : `<span class="badge">💊 ${medCount}</span><span class="badge">🩺 ${careCount}</span>`;

    card.innerHTML = `
      <div class="day-card-header" data-action="toggle" tabindex="0" role="button" aria-expanded="false">
        <div class="day-date">
          <span class="dow">${dowName}</span>
          <span class="dom">${dom}</span>
          <span class="month">${monthName}</span>
        </div>
        <div class="day-summary">
          <span class="day-summary-title">${escapeHtml(summaryTitle)}</span>
          <span class="day-summary-counts">${counts}</span>
        </div>
        <span class="day-toggle" aria-hidden="true">▾</span>
      </div>
      <div class="day-body">
        ${events.length === 0
          ? '<div class="day-no-events">No events scheduled</div>'
          : `<ul class="day-events">${events.map(ev => {
              const icon = ev.type === 'med' ? '💊' : '🩺';
              return `<li>
                <span class="event-time">${ev.time}</span>
                <span class="event-type">${icon}</span>
                <span class="event-title">${escapeHtml(ev.title)}<small>${escapeHtml(ev.detail || '')}</small></span>
              </li>`;
            }).join('')}</ul>`
        }
      </div>
    `;
    container.appendChild(card);
  }
}
function toggleDayCard(card) {
  const expanded = card.classList.toggle('expanded');
  card.querySelector('[data-action="toggle"]').setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

// ---- Meds/Care renderers ----
function renderMeds() {
  const ul = $('medList');
  ul.innerHTML = '';
  if (state.medications.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = '💊 No medications yet. Tap "+ Add Medication" above.';
    ul.appendChild(li);
    return;
  }
  state.medications.forEach(m => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="item-toggle ${m.enabled ? 'on' : ''}" data-id="${m.id}" data-kind="med" aria-pressed="${m.enabled}" aria-label="Enable reminder"></button>
      <div class="med-info">
        <strong>${escapeHtml(m.name)}</strong>
        <span class="med-meta">${escapeHtml(m.dosage || 'No dosage set')}${m.notes ? ' · ' + escapeHtml(m.notes) : ''}</span>
      </div>
      <span class="item-time">${m.time}</span>
      <div class="item-actions">
        <button class="btn btn-secondary btn-small" data-action="edit-med" data-id="${m.id}">Edit</button>
        <button class="btn btn-secondary btn-small" data-action="del-med" data-id="${m.id}">Delete</button>
      </div>
    `;
    li.classList.toggle('item-blocked', !m.enabled);
    ul.appendChild(li);
  });
}

function renderCare() {
  const ul = $('careList');
  ul.innerHTML = '';
  if (state.careTasks.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = '🩺 No care tasks yet. Tap "+ Add Task" above.';
    ul.appendChild(li);
    return;
  }
  state.careTasks.forEach(c => {
    const li = document.createElement('li');
    const last = state.lastTriggered.care[c.id];
    const lastText = last ? new Date(last).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Never';
    const overdue = c.enabled && last && (Date.now() - last >= c.interval * 3600000);
    li.innerHTML = `
      <button class="item-toggle ${c.enabled ? 'on' : ''}" data-id="${c.id}" data-kind="care" aria-pressed="${c.enabled}" aria-label="Enable reminder"></button>
      <div class="care-info">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="care-meta">Every ${c.interval} hours · Last: ${lastText}${overdue ? ' 🚨' : ''}${c.notes ? ' · ' + escapeHtml(c.notes) : ''}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-primary btn-small" data-action="done-care" data-id="${c.id}">Done</button>
        <button class="btn btn-secondary btn-small" data-action="edit-care" data-id="${c.id}">Edit</button>
        <button class="btn btn-secondary btn-small" data-action="del-care" data-id="${c.id}">Del</button>
      </div>
    `;
    li.classList.toggle('item-blocked', !c.enabled);
    ul.appendChild(li);
  });
}

function renderAlarmLog() {
  const ul = $('alarmLog');
  ul.innerHTML = '';
  const items = state.alarmLog.slice().reverse().slice(0, 20);
  if (items.length === 0) {
    const li = document.createElement('li');
    li.style.borderLeftColor = 'var(--border)';
    li.style.color = 'var(--text-dim)';
    li.textContent = 'No alarms yet.';
    ul.appendChild(li);
    return;
  }
  items.forEach(e => {
    const li = document.createElement('li');
    li.textContent = new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + e.message;
    ul.appendChild(li);
  });
}

// ---- Scheduler (unchanged) ----
function checkSchedule() {
  const now = new Date();
  const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const tk = todayKey() + '|' + hhmm;

  state.medications.forEach(m => {
    if (!m.enabled) return;
    if (m.time === hhmm && !state.lastTriggered.meds[tk] && !state.lastTriggered.meds[m.id + '|' + tk]) {
      const msg = `${m.name}${m.dosage ? ' · ' + m.dosage : ''} (${m.time})`;
      showAlarm('💊 Time for medication', msg);
      state.lastTriggered.meds[tk] = Date.now();
      state.alarmLog.push({ at: Date.now(), message: '💊 ' + msg });
      saveState();
    }
  });

  state.careTasks.forEach(c => {
    if (!c.enabled) return;
    const last = state.lastTriggered.care[c.id] || 0;
    const due = Date.now() - last >= c.interval * 3600000;
    const dueKey = c.id + '|' + todayKey();
    if (due && !state.lastTriggered.care[dueKey] && !alarmModalShown) {
      const msg = `${c.name} (every ${c.interval} hours)`;
      showAlarm('🩺 Care task due', msg);
      state.lastTriggered.care[dueKey] = Date.now();
      state.alarmLog.push({ at: Date.now(), message: '🩺 ' + msg });
      saveState();
    }
  });

  renderDashboard();
  renderCalendar();
  renderAlarmLog();
}

// ---- Timer ----
function startTimer(minutes, label = 'Timer') {
  if (timerInterval) clearInterval(timerInterval);
  timerTotal = minutes * 60;
  timerRemaining = timerTotal;
  timerLabel = label;
  $('timerDisplay').classList.add('running');
  $('timerDisplay').classList.remove('expired');
  $('startTimerBtn').disabled = true;
  $('stopTimerBtn').disabled = false;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerRemaining--;
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerExpired();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}
function updateTimerDisplay() {
  const m = Math.max(0, Math.floor(timerRemaining / 60));
  const s = Math.max(0, timerRemaining % 60);
  $('timerDisplay').textContent = pad(m) + ':' + pad(s);
}
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  $('timerDisplay').classList.remove('running', 'expired');
  $('timerDisplay').textContent = '00:00';
  $('startTimerBtn').disabled = false;
  $('stopTimerBtn').disabled = true;
}
function timerExpired() {
  $('timerDisplay').textContent = "Time's up!";
  $('timerDisplay').classList.add('expired');
  $('timerDisplay').classList.remove('running');
  $('startTimerBtn').disabled = false;
  $('stopTimerBtn').disabled = true;
  showAlarm('⏰ Timer', `${timerLabel} finished`);
  state.alarmLog.push({ at: Date.now(), message: '⏰ ' + timerLabel });
  saveState();
  renderAlarmLog();
}

// ---- Modals (med/care) ----
function openMedModal(id = null) {
  const m = id ? state.medications.find(x => x.id === id) : null;
  $('medId').value = m?.id || '';
  $('medName').value = m?.name || '';
  $('medDosage').value = m?.dosage || '';
  $('medTime').value = m?.time || '08:00';
  $('medEnabled').checked = m ? m.enabled : true;
  $('medNotes').value = m?.notes || '';
  $('medModalTitle').textContent = m ? 'Edit Medication' : 'Add Medication';
  $('medModal').hidden = false;
  $('medName').focus();
}
function closeMedModal() { $('medModal').hidden = true; }

function openCareModal(id = null) {
  const c = id ? state.careTasks.find(x => x.id === id) : null;
  $('careId').value = c?.id || '';
  $('careName').value = c?.name || '';
  $('careInterval').value = c?.interval || 4;
  $('careEnabled').checked = c ? c.enabled : true;
  $('careNotes').value = c?.notes || '';
  $('careModalTitle').textContent = c ? 'Edit Care Task' : 'Add Care Task';
  $('careModal').hidden = false;
  $('careName').focus();
}
function closeCareModal() { $('careModal').hidden = true; }

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

// ======================================================================
// RIDES MODULE
// ======================================================================

function getProfile() {
  return state.accessibility || {
    chairType: 'power',
    needWAV: true,
    needRamp: false,
    needLift: false,
    needAssist: false,
    serviceAnimal: false,
    notes: ''
  };
}

function buildProfileNotes(p) {
  const lines = [];
  if (p.chairType === 'power') lines.push('Power wheelchair.');
  else if (p.chairType === 'manual') lines.push('Manual wheelchair.');
  else if (p.chairType === 'foldable') lines.push('Foldable wheelchair.');
  if (p.needWAV) lines.push('WAV required.');
  if (p.needRamp) lines.push('Need a ramp.');
  if (p.needLift) lines.push('Need a lift.');
  if (p.needAssist) lines.push('Please assist with the door.');
  if (p.serviceAnimal) lines.push('Traveling with a service animal.');
  if (p.notes) lines.push(p.notes);
  return lines.join(' ');
}

function renderProfile() {
  const p = state.accessibility;
  const title = p ? (p.chairType === 'power' ? 'Power wheelchair' :
                    p.chairType === 'manual' ? 'Manual wheelchair' :
                    p.chairType === 'foldable' ? 'Foldable chair' :
                    'No wheelchair') : 'Set up your profile';
  const sub = p
    ? buildProfileSub(p)
    : 'Tap to set your accessibility needs — we\'ll auto-fill driver notes for every booking.';
  $('profTitle').textContent = title;
  $('profSub').textContent = sub;
}

function buildProfileSub(p) {
  const tags = [];
  if (p.needWAV) tags.push('WAV');
  if (p.needRamp) tags.push('Ramp');
  if (p.needLift) tags.push('Lift');
  if (p.needAssist) tags.push('Assist');
  if (p.serviceAnimal) tags.push('Service animal');
  return tags.length ? tags.join(' · ') + ' · applied to every booking' : 'No extra needs · applied to every booking';
}

function openProfModal() {
  const p = getProfile();
  $('profChair').value = p.chairType;
  $('profWAV').checked = !!p.needWAV;
  $('profRamp').checked = !!p.needRamp;
  $('profLift').checked = !!p.needLift;
  $('profAssist').checked = !!p.needAssist;
  $('profAnimal').checked = !!p.serviceAnimal;
  $('profNotes').value = p.notes || '';
  $('profModalTitle').textContent = 'Accessibility Profile';
  $('profModal').hidden = false;
  $('profChair').focus();
}
function closeProfModal() { $('profModal').hidden = true; }

function renderDestinations() {
  const ul = $('destList');
  ul.innerHTML = '';
  if (state.destinations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No saved destinations yet.';
    ul.appendChild(empty);
    return;
  }
  state.destinations.forEach(d => {
    const div = document.createElement('div');
    div.className = 'destination';
    div.innerHTML = `
      <span class="destination-icon" aria-hidden="true">📍</span>
      <div class="destination-main">
        <div class="destination-label">${escapeHtml(d.label)}${d.isDefault ? ' · Default' : ''}</div>
        <div class="destination-addr">${escapeHtml(d.address)}</div>
      </div>
      <div class="destination-actions">
        <button class="btn btn-secondary btn-small" data-action="edit-dest" data-id="${d.id}">Edit</button>
        <button class="btn btn-secondary btn-small" data-action="del-dest" data-id="${d.id}">×</button>
      </div>
    `;
    ul.appendChild(div);
  });
}

function openDestModal(id = null) {
  const d = id ? state.destinations.find(x => x.id === id) : null;
  $('destId').value = d?.id || '';
  $('destLabel').value = d?.label || '';
  $('destAddress').value = d?.address || '';
  $('destDefault').checked = d ? !!d.isDefault : !state.destinations.some(x => x.isDefault);
  $('destModalTitle').textContent = d ? 'Edit Destination' : 'Add Destination';
  $('destModal').hidden = false;
  $('destLabel').focus();
}
function closeDestModal() { $('destModal').hidden = true; }

function filteredProviders() {
  const f = state.rideFilter || 'all';
  return RIDE_PROVIDERS
    .filter(p => f === 'all' || p.category === f)
    .slice()
    .sort((a,b) => {
      if (a.category === 'wav' && b.category !== 'wav') return -1;
      if (b.category === 'wav' && a.category !== 'wav') return 1;
      return 0;
    });
}

function renderProviders() {
  const grid = $('providerGrid');
  grid.innerHTML = '';
  const list = filteredProviders();
  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No providers in this category.';
    grid.appendChild(empty);
    return;
  }
  list.forEach(p => {
    const card = document.createElement('button');
    card.className = 'provider';
    card.style.borderLeftColor = p.color || 'var(--primary)';
    card.dataset.id = p.id;
    card.setAttribute('aria-label', `${p.name}. ${p.summary}`);
    const accessTags = p.accessibleTypes.map(t => `<span class="tag">${t}</span>`).join('');
    card.innerHTML = `
      <span class="provider-emoji" aria-hidden="true">${p.icon}</span>
      <div class="provider-body">
        <div class="provider-name">${escapeHtml(p.name)}</div>
        <div class="provider-desc">${escapeHtml(p.summary)}</div>
        <div class="provider-meta">
          <span class="tag">⏱ ${escapeHtml(p.waitLabel)}</span>
          <span class="tag">📍 ${escapeHtml(p.coverage)}</span>
          ${accessTags}
        </div>
      </div>
      <div class="provider-cost">
        COST
        <strong>${escapeHtml(p.costLabel)}</strong>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderTrips() {
  const ul = $('tripList');
  ul.innerHTML = '';
  const trips = (state.trips || []).slice().reverse().slice(0, 10);
  if (trips.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No trips booked yet.';
    ul.appendChild(empty);
    return;
  }
  trips.forEach(t => {
    const provider = RIDE_PROVIDERS.find(p => p.id === t.providerId);
    const li = document.createElement('li');
    const when = new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    li.innerHTML = `
      <strong>${provider ? provider.icon : '🚗'} ${provider ? escapeHtml(provider.name) : 'Trip'}</strong>
      <small>${escapeHtml(when)} · ${escapeHtml(t.fromLabel || '—')} → ${escapeHtml(t.toLabel || '—')}</small>
    `;
    ul.appendChild(li);
  });
}

function tryGeolocate() {
  if (!('geolocation' in navigator)) {
    $('locBadge').textContent = '📍 Location unavailable';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      state.currentLocation = { lat: latitude, lon: longitude, label: 'Your location' };
      saveState();
      $('locBadge').textContent = '📍 Using your location';
    },
    () => {
      $('locBadge').textContent = '📍 United States';
    },
    { timeout: 4000, maximumAge: 600000 }
  );
}

// ---- Booking flow ----
function openBookModal(providerId) {
  const provider = RIDE_PROVIDERS.find(p => p.id === providerId);
  if (!provider) return;
  bookingProvider = provider;

  $('bookIcon').textContent = provider.icon;
  $('bookModalTitle').textContent = 'Book ' + provider.name;
  $('bookSubtitle').textContent = provider.summary;

  // Pickup dropdown
  const pickup = $('bookPickup');
  pickup.innerHTML = '';
  if (state.currentLocation) {
    const opt = document.createElement('option');
    opt.value = '__current';
    opt.textContent = '📍 Current location';
    pickup.appendChild(opt);
  }
  if (state.destinations.length) {
    state.destinations.filter(d => d.isDefault).forEach(d => {
      const opt = document.createElement('option');
      opt.value = 'dest:' + d.id;
      opt.textContent = '★ ' + d.label + ' — ' + d.address;
      pickup.appendChild(opt);
    });
    state.destinations.filter(d => !d.isDefault).forEach(d => {
      const opt = document.createElement('option');
      opt.value = 'dest:' + d.id;
      opt.textContent = d.label + ' — ' + d.address;
      pickup.appendChild(opt);
    });
  }

  // Dropoff dropdown
  const dropoff = $('bookDropoff');
  dropoff.innerHTML = '';
  if (state.destinations.length) {
    state.destinations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = 'dest:' + d.id;
      opt.textContent = d.label + ' — ' + d.address;
      dropoff.appendChild(opt);
    });
  }
  const optCustom = document.createElement('option');
  optCustom.value = '__custom';
  optCustom.textContent = 'Enter manually ↓';
  dropoff.appendChild(optCustom);

  $('bookWhen').value = 'now';
  $('bookPax').value = '1';
  $('bookNotes').value = buildProfileNotes(getProfile());

  // Show web/call buttons as available
  $('bookWebBtn').hidden = !provider.webUrl;
  $('bookCallBtn').hidden = !provider.phone;
  $('bookLaunchBtn').textContent = provider.deeplink
    ? `▶ Open ${provider.name}`
    : (provider.phone ? '📞 Call now' : '🌐 Open website');

  $('bookModal').hidden = false;
}
function closeBookModal() { $('bookModal').hidden = true; bookingProvider = null; }

function pickLabelByValue(value) {
  if (!value) return '';
  if (value === '__current') return 'Current location';
  if (value === '__custom') return 'Custom destination';
  if (value.startsWith('dest:')) {
    const d = state.destinations.find(x => x.id === value.slice(5));
    return d ? `${d.label} (${d.address})` : 'Saved destination';
  }
  return value;
}

function launchBooking() {
  if (!bookingProvider) return;
  const provider = bookingProvider;
  const fromLabel = pickLabelByValue($('bookPickup').value);
  const toLabel = pickLabelByValue($('bookDropoff').value);
  const notes = $('bookNotes').value.trim();

  state.trips = state.trips || [];
  state.trips.push({
    at: Date.now(),
    providerId: provider.id,
    fromLabel,
    toLabel,
    notes
  });
  state.trips = state.trips.slice(-30);
  saveState();
  renderTrips();

  // Try deeplink first
  if (provider.deeplink) {
    const t = Date.now();
    window.location.href = provider.deeplink;
    setTimeout(() => {
      // Fallback to web URL if the deeplink didn't change the page
      if (Date.now() - t < 2500 && provider.webUrl) {
        try { window.open(provider.webUrl, '_blank'); } catch {}
      }
    }, 1500);
  } else if (provider.phone) {
    window.location.href = 'tel:' + provider.phone;
  } else if (provider.webUrl) {
    window.open(provider.webUrl, '_blank');
  }
  closeBookModal();
}

function launchWeb() {
  if (bookingProvider && bookingProvider.webUrl) {
    window.open(bookingProvider.webUrl, '_blank');
  }
}
function launchCall() {
  if (bookingProvider && bookingProvider.phone) {
    window.location.href = 'tel:' + bookingProvider.phone;
  }
}

// ======================================================================
// COMMUNITY MODULE
// ======================================================================

function getCommunity() {
  const base = Object.assign({
    interests: [], bio: '', saved: [], notes: [], filter: 'all'
  }, state.community || {});
  base.localSocial = Object.assign({ city: '', cardDraft: '' }, state.community?.localSocial || {});
  return base;
}

function renderInterestsCard() {
  const c = getCommunity();
  const title = c.interests.length
    ? INTEREST_OPTIONS.filter(i => c.interests.includes(i.id))
        .map(i => i.label).slice(0, 3).join(' · ') + (c.interests.length > 3 ? ' +' : '')
    : 'Tell us about you';
  const sub = c.interests.length
    ? 'Matching communities are highlighted with a ✓ Match badge'
    : "We'll match resources that fit you best";
  $('interestsTitle').textContent = title;
  $('interestsSub').textContent = sub;

  // Home dashboard count
  const matched = COMMUNITY_RESOURCES.filter(r => matchesInterests(r)).length;
  $('matchCount').textContent = matched + ' match' + (matched === 1 ? '' : 'es');
  $('savedCommunitiesCount').textContent = c.localSocial.city
    ? c.localSocial.city + ' · ' + c.saved.length + ' saved'
    : c.saved.length + ' saved';
}

// ---- Local social: city-based search launchers ----
function buildLocalSearches() {
  const c = getCommunity();
  const city = (c.localSocial.city || '').trim();
  const has = city.length > 0;
  const near = has ? city : 'my area';
  const enc = encodeURIComponent(near);

  return [
    {
      id: 'meetup-disability',
      name: 'Meetup · Disability groups',
      icon: '📍',
      desc: has ? `In-person & online disability meetups near ${city}` : 'Set your city first for local results',
      url: has
        ? `https://www.meetup.com/find/?keywords=disability&location=${enc}`
        : 'https://www.meetup.com/find/?keywords=disability'
    },
    {
      id: 'meetup-wheelchair',
      name: 'Meetup · Wheelchair users',
      icon: '🛞',
      desc: has ? `Wheelchair sports & social meetups near ${city}` : 'Set your city first for local results',
      url: has
        ? `https://www.meetup.com/find/?keywords=wheelchair&location=${enc}`
        : 'https://www.meetup.com/find/?keywords=wheelchair'
    },
    {
      id: 'fb-groups',
      name: 'Facebook · Local groups',
      icon: '👥',
      desc: has ? `Disability groups in ${city}` : 'Set your city first for local results',
      url: has
        ? `https://www.facebook.com/search/groups/?q=${encodeURIComponent('disability ' + city)}`
        : 'https://www.facebook.com/search/groups/?q=disability'
    },
    {
      id: 'g-support',
      name: 'Google · Support groups',
      icon: '🔎',
      desc: has ? `Disability support groups near ${city}` : 'Set your city first for local results',
      url: `https://www.google.com/search?q=${encodeURIComponent((has ? 'disability support groups near ' + city : 'disability support groups near me'))}`
    },
    {
      id: 'g-adaptive',
      name: 'Google · Adaptive sports',
      icon: '🏅',
      desc: has ? `Adaptive sports programs near ${city}` : 'Set your city first for local results',
      url: `https://www.google.com/search?q=${encodeURIComponent((has ? 'adaptive sports programs near ' + city : 'adaptive sports programs near me'))}`
    },
    {
      id: 'g-events',
      name: 'Google · Accessible events',
      icon: '🎪',
      desc: has ? `Accessible community events near ${city}` : 'Set your city first for local results',
      url: `https://www.google.com/search?q=${encodeURIComponent((has ? 'accessible community events near ' + city : 'accessible community events near me'))}`
    }
  ];
}

function renderLocalSocial() {
  // City input
  const c = getCommunity();
  const input = $('cityInput');
  if (input) input.value = c.localSocial.city || '';

  // Local searches
  const grid = $('localSearchGrid');
  if (grid) {
    grid.innerHTML = '';
    buildLocalSearches().forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'launcher';
      btn.innerHTML = `
        <span class="launcher-icon" aria-hidden="true">${s.icon}</span>
        <span class="launcher-main">
          <span class="launcher-name">${escapeHtml(s.name)}</span>
          <span class="launcher-desc">${escapeHtml(s.desc)}</span>
        </span>
        <span class="launcher-arrow" aria-hidden="true">›</span>
      `;
      btn.addEventListener('click', () => window.open(s.url, '_blank', 'noopener'));
      grid.appendChild(btn);
    });
  }

  // Chapter finders
  const cg = $('chapterGrid');
  if (cg) {
    cg.innerHTML = '';
    CHAPTER_FINDER.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'launcher';
      btn.innerHTML = `
        <span class="launcher-icon" aria-hidden="true">${ch.icon}</span>
        <span class="launcher-main">
          <span class="launcher-name">${escapeHtml(ch.name)}</span>
          <span class="launcher-desc">${escapeHtml(ch.desc)}</span>
        </span>
        <span class="launcher-arrow" aria-hidden="true">›</span>
      `;
      btn.addEventListener('click', () => window.open(ch.url, '_blank', 'noopener'));
      cg.appendChild(btn);
    });
  }

  renderConnectCard();
}

// ---- Connect Card ----
function buildConnectCardText() {
  const c = getCommunity();
  const p = state.accessibility;
  const lines = [];

  lines.push('Hi! I use the MyDailyCare app and I\'m looking to connect with people locally.');

  const facts = [];
  if (p) {
    if (p.chairType === 'power') facts.push('I\'m a power wheelchair user');
    else if (p.chairType === 'manual') facts.push('I\'m a manual wheelchair user');
    else if (p.chairType === 'foldable') facts.push('I use a foldable wheelchair');
  }
  if (c.interests.includes('heart')) facts.push('I manage a heart condition');
  if (c.interests.includes('adhd')) facts.push('I have ADHD');

  if (facts.length) lines.push(facts.join(' · ') + '.');
  if (c.bio) lines.push(c.bio);
  if (c.localSocial.city) {
    lines.push(`I'm around ${c.localSocial.city} — always up for coffee chats, adaptive sports, or just good conversation.`);
  } else {
    lines.push('Always up for coffee chats, adaptive sports, or just good conversation.');
  }

  lines.push('Feel free to say hi!');
  return lines.join('\n');
}

function renderConnectCard() {
  const ta = $('connectCardText');
  if (!ta) return;
  const c = getCommunity();
  ta.value = c.localSocial.cardDraft || buildConnectCardText();
}

function saveCity() {
  const c = getCommunity();
  c.localSocial.city = $('cityInput').value.trim();
  state.community = c;
  saveState();
  renderLocalSocial();
  // Home dashboard: update community card hint
  const hint = $('savedCommunitiesCount');
  if (hint && c.localSocial.city) hint.textContent = c.localSocial.city;
}

function copyConnectCard() {
  const text = $('connectCardText').value;
  const c = getCommunity();
  c.localSocial.cardDraft = text;   // remember edits
  state.community = c;
  saveState();
  const done = () => sendNotification('📋 Copied', 'Connect card is on your clipboard');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function matchesInterests(resource) {
  const c = getCommunity();
  if (!c.interests.length) return false;
  return resource.focus.some(f => c.interests.includes(f));
}

function filteredCommunities() {
  const c = getCommunity();
  const f = c.filter || 'all';
  return COMMUNITY_RESOURCES
    .filter(r => f === 'all' || r.category === f)
    .slice()
    .sort((a, b) => {
      const am = matchesInterests(a), bm = matchesInterests(b);
      if (am && !bm) return -1;
      if (bm && !am) return 1;
      return 0;
    });
}

function renderCommunities() {
  const grid = $('communityGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const c = getCommunity();
  const list = filteredCommunities();

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No communities in this category.';
    grid.appendChild(empty);
    return;
  }

  list.forEach(r => {
    const match = matchesInterests(r);
    const isSaved = c.saved.includes(r.id);
    const card = document.createElement('div');
    card.className = 'provider provider-card-wrap';
    card.style.borderLeftColor = 'var(--primary)';
    card.innerHTML = `
      <button class="bookmark-btn" data-action="save-resource" data-id="${r.id}"
              aria-label="${isSaved ? 'Remove from saved' : 'Save for later'}"
              title="${isSaved ? 'Remove from saved' : 'Save for later'}">${isSaved ? '★' : '☆'}</button>
      <span class="provider-emoji" aria-hidden="true">${r.icon}</span>
      <div class="provider-body">
        <div class="provider-name">${escapeHtml(r.name)}${match ? '<span class="provider-match">✓ MATCH</span>' : ''}</div>
        <div class="provider-desc">${escapeHtml(r.description)}</div>
        <div class="provider-meta">
          <span class="tag">👥 ${escapeHtml(r.members)}</span>
          <span class="tag">${escapeHtml(CATEGORY_LABELS[r.category] || r.category)}</span>
        </div>
      </div>
      <div class="provider-cost">
        VISIT
        <strong>›</strong>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-btn')) return;
      window.open(r.url, '_blank', 'noopener');
    });
    grid.appendChild(card);
  });
}

function toggleSavedResource(id) {
  const c = getCommunity();
  const i = c.saved.indexOf(id);
  if (i >= 0) c.saved.splice(i, 1);
  else c.saved.push(id);
  state.community = c;
  saveState();
  renderCommunities();
  renderSavedResources();
  renderInterestsCard();
}

function renderSavedResources() {
  const grid = $('savedGrid');
  if (!grid) return;
  const c = getCommunity();
  $('savedCount').textContent = c.saved.length;
  grid.innerHTML = '';
  if (c.saved.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state small';
    empty.textContent = 'No saved resources yet. Tap ☆ on any community to save it here.';
    grid.appendChild(empty);
    return;
  }
  c.saved.forEach(id => {
    const r = COMMUNITY_RESOURCES.find(x => x.id === id);
    if (!r) return;
    const card = document.createElement('div');
    card.className = 'provider provider-card-wrap';
    card.style.borderLeftColor = 'var(--accent)';
    card.innerHTML = `
      <span class="provider-emoji" aria-hidden="true">${r.icon}</span>
      <div class="provider-body">
        <div class="provider-name">${escapeHtml(r.name)}</div>
        <div class="provider-desc">${escapeHtml(r.description)}</div>
      </div>
      <div class="provider-cost">
        VISIT
        <strong>›</strong>
      </div>
    `;
    card.addEventListener('click', () => window.open(r.url, '_blank', 'noopener'));
    grid.appendChild(card);
  });
}

// ---- Notes ----
function renderNotes() {
  const ul = $('notesList');
  if (!ul) return;
  const c = getCommunity();
  $('notesCount').textContent = c.notes.length;
  ul.innerHTML = '';
  if (c.notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = '📝 No notes yet. Save accessibility tips, favorite venues, or provider notes.';
    ul.appendChild(empty);
    return;
  }
  c.notes.slice().reverse().forEach(n => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', 'Copy note: ' + n.title);
    const when = new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const tags = (n.tags || []).map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join(' ');
    li.innerHTML = `
      <div class="note-title">${escapeHtml(n.title)}</div>
      <div class="note-body">${escapeHtml(n.body)}</div>
      <div class="note-meta">
        <span>${when}</span>
        ${tags}
        <span style="margin-left:auto;color:var(--primary);font-weight:700;">Tap to copy</span>
      </div>
    `;
    li.addEventListener('click', () => copyNote(n));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyNote(n); }
    });
    ul.appendChild(li);
  });
}

function copyNote(n) {
  const text = `${n.title}\n\n${n.body}${n.tags?.length ? '\n\nTags: ' + n.tags.join(', ') : ''}`;
  const done = () => sendNotification('📋 Copied', n.title);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, cb) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    cb();
  } catch {}
}

function openNoteModal(id = null) {
  const c = getCommunity();
  const n = id ? c.notes.find(x => x.id === id) : null;
  $('noteId').value = n?.id || '';
  $('noteTitle').value = n?.title || '';
  $('noteBody').value = n?.body || '';
  $('noteTags').value = n?.tags?.join(', ') || '';
  $('noteModalTitle').textContent = n ? 'Edit Note' : 'Add Note';
  $('noteModal').hidden = false;
  $('noteTitle').focus();
}
function closeNoteModal() { $('noteModal').hidden = true; }

function openInterestsModal() {
  const c = getCommunity();
  const grid = $('interestGrid');
  grid.innerHTML = '';
  INTEREST_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'interest-chip' + (c.interests.includes(opt.id) ? ' selected' : '');
    btn.dataset.interest = opt.id;
    btn.textContent = opt.icon + ' ' + opt.label;
    btn.setAttribute('aria-pressed', c.interests.includes(opt.id));
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      btn.setAttribute('aria-pressed', btn.classList.contains('selected'));
    });
    grid.appendChild(btn);
  });
  $('commBio').value = c.bio || '';
  $('interestsModal').hidden = false;
}
function closeInterestsModal() { $('interestsModal').hidden = true; }

// ======================================================================
// EVENT BINDING
// ======================================================================
function bindEvents() {
  // ---- Tabs ----
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');
      const tab = btn.dataset.tab;
      $('tab-' + tab).classList.add('active');
      if (tab === 'calendar') renderCalendar();
      if (tab === 'rides') {
        renderProfile();
        renderDestinations();
        renderProviders();
        renderTrips();
      }
      if (tab === 'community') {
        renderInterestsCard();
        renderLocalSocial();
        renderCommunities();
        renderSavedResources();
        renderNotes();
      }
    });
  });

  // ---- Dashboard big cards ----
  $$('[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      $$('.tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      const target = card.dataset.goto;
      const t = $(`.tab[data-tab="${target}"]`);
      t.classList.add('active');
      t.setAttribute('aria-selected','true');
      $('tab-' + target).classList.add('active');
      if (target === 'calendar') renderCalendar();
      if (target === 'rides') {
        renderProfile();
        renderDestinations();
        renderProviders();
        renderTrips();
      }
      if (target === 'community') {
        renderInterestsCard();
        renderLocalSocial();
        renderCommunities();
        renderSavedResources();
        renderNotes();
      }
    });
  });

  $('quickCathBtn').addEventListener('click', () => {
    $$('.tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $('.tab[data-tab="timer"]').classList.add('active');
    $('.tab[data-tab="timer"]').setAttribute('aria-selected','true');
    $('tab-timer').classList.add('active');
    $('customMin').value = 240;
    startTimer(240, 'Catheter care');
  });

  // ---- Medication CRUD ----
  $('addMedBtn').addEventListener('click', () => openMedModal());
  $('medCancelBtn').addEventListener('click', closeMedModal);
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
    saveState(); closeMedModal(); renderMeds(); renderDashboard(); renderCalendar();
  });

  // ---- Care CRUD ----
  $('addCareBtn').addEventListener('click', () => openCareModal());
  $('careCancelBtn').addEventListener('click', closeCareModal);
  $('careForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('careId').value || newId();
    const entry = {
      id, name: $('careName').value.trim(), interval: Number($('careInterval').value),
      enabled: $('careEnabled').checked, notes: $('careNotes').value.trim()
    };
    if (!entry.name || !entry.interval || entry.interval < 1) return;
    const i = state.careTasks.findIndex(c => c.id === id);
    if (i >= 0) state.careTasks[i] = entry; else state.careTasks.push(entry);
    saveState(); closeCareModal(); renderCare(); renderDashboard(); renderCalendar();
  });

  $('medList').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('item-toggle')) {
      const m = state.medications.find(x => x.id === id);
      m.enabled = !m.enabled; saveState(); renderMeds(); renderDashboard(); renderCalendar();
    } else if (btn.dataset.action === 'edit-med') openMedModal(id);
    else if (btn.dataset.action === 'del-med' && confirm('Delete this medication?')) {
      state.medications = state.medications.filter(m => m.id !== id);
      saveState(); renderMeds(); renderDashboard(); renderCalendar();
    }
  });

  $('careList').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('item-toggle')) {
      const c = state.careTasks.find(x => x.id === id);
      c.enabled = !c.enabled; saveState(); renderCare(); renderDashboard(); renderCalendar();
    } else if (btn.dataset.action === 'done-care') {
      state.lastTriggered.care[id] = Date.now();
      delete state.lastTriggered.care[id + '|' + todayKey()];
      saveState(); renderCare(); renderDashboard(); renderCalendar();
    } else if (btn.dataset.action === 'edit-care') openCareModal(id);
    else if (btn.dataset.action === 'del-care' && confirm('Delete this care task?')) {
      state.careTasks = state.careTasks.filter(c => c.id !== id);
      saveState(); renderCare(); renderDashboard(); renderCalendar();
    }
  });

  // ---- Timer ----
  $$('.preset-btn').forEach(b => b.addEventListener('click', () => startTimer(Number(b.dataset.min), b.textContent + ' timer')));
  $('startTimerBtn').addEventListener('click', () => {
    const m = Math.max(1, Number($('customMin').value) || 0);
    startTimer(m, 'Custom ' + m + ' min');
  });
  $('stopTimerBtn').addEventListener('click', stopTimer);

  // ---- Alarm modal ----
  $('alarmAckBtn').addEventListener('click', hideAlarm);
  $('alarmSnoozeBtn').addEventListener('click', () => { hideAlarm(); startTimer(5, 'Snooze'); });

  // ---- Calendar nav ----
  $('prevWeekBtn').addEventListener('click', () => { calOffsetDays -= 7; renderCalendar(); });
  $('nextWeekBtn').addEventListener('click', () => { calOffsetDays += 7; renderCalendar(); });
  $('dayCards').addEventListener('click', (e) => {
    const head = e.target.closest('[data-action="toggle"]');
    if (head) toggleDayCard(head.closest('.day-card'));
  });
  $('dayCards').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const head = e.target.closest('[data-action="toggle"]');
      if (head) { e.preventDefault(); toggleDayCard(head.closest('.day-card')); }
    }
  });

  // ---- RIDES ----
  $$('.chip').forEach(c => {
    c.addEventListener('click', () => {
      $$('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.rideFilter = c.dataset.filter;
      saveState();
      renderProviders();
    });
  });

  $('profileCard').addEventListener('click', openProfModal);
  $('profCancelBtn').addEventListener('click', closeProfModal);
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
    saveState();
    closeProfModal();
    renderProfile();
  });

  $('addDestBtn').addEventListener('click', () => openDestModal());
  $('destCancelBtn').addEventListener('click', closeDestModal);
  $('destForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('destId').value || newId();
    const isDefault = $('destDefault').checked;
    const entry = {
      id,
      label: $('destLabel').value.trim(),
      address: $('destAddress').value.trim(),
      isDefault
    };
    if (!entry.label || !entry.address) return;
    if (isDefault) state.destinations.forEach(x => x.isDefault = false);
    const i = state.destinations.findIndex(x => x.id === id);
    if (i >= 0) state.destinations[i] = entry; else state.destinations.push(entry);
    saveState();
    closeDestModal();
    renderDestinations();
  });

  $('destList').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-dest') openDestModal(id);
    else if (btn.dataset.action === 'del-dest') {
      if (confirm('Delete this destination?')) {
        state.destinations = state.destinations.filter(x => x.id !== id);
        saveState(); renderDestinations();
      }
    }
  });

  $('providerGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.provider');
    if (!card) return;
    openBookModal(card.dataset.id);
  });

  $('bookLaunchBtn').addEventListener('click', launchBooking);
  $('bookWebBtn').addEventListener('click', launchWeb);
  $('bookCallBtn').addEventListener('click', launchCall);

  // ---- COMMUNITY ----
  // Local social
  $('saveCityBtn').addEventListener('click', saveCity);
  $('cityInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveCity(); }
  });
  $('regenCardBtn').addEventListener('click', () => {
    const c = getCommunity();
    c.localSocial.cardDraft = '';
    state.community = c;
    saveState();
    renderConnectCard();
  });
  $('copyCardBtn').addEventListener('click', copyConnectCard);

  $$('.chip[data-comfilter]').forEach(c => {
    c.addEventListener('click', () => {
      $$('.chip[data-comfilter]').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      const comm = getCommunity();
      comm.filter = c.dataset.comfilter;
      state.community = comm;
      saveState();
      renderCommunities();
    });
  });

  $('interestsCard').addEventListener('click', openInterestsModal);
  $('interestsCancelBtn').addEventListener('click', closeInterestsModal);
  $('interestsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const comm = getCommunity();
    comm.interests = $$('.interest-chip.selected').map(b => b.dataset.interest);
    comm.bio = $('commBio').value.trim();
    state.community = comm;
    saveState();
    closeInterestsModal();
    renderInterestsCard();
    renderCommunities();
  });

  $('communityGrid').addEventListener('click', (e) => {
    const bm = e.target.closest('.bookmark-btn');
    if (bm) {
      e.stopPropagation();
      toggleSavedResource(bm.dataset.id);
    }
  });

  $('addNoteBtn').addEventListener('click', () => openNoteModal());
  $('noteCancelBtn').addEventListener('click', closeNoteModal);
  $('noteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const comm = getCommunity();
    const id = $('noteId').value || newId();
    const entry = {
      id,
      title: $('noteTitle').value.trim(),
      body: $('noteBody').value.trim(),
      tags: $('noteTags').value.split(',').map(s => s.trim()).filter(Boolean),
      at: Date.now()
    };
    if (!entry.title || !entry.body) return;
    const i = comm.notes.findIndex(n => n.id === id);
    if (i >= 0) comm.notes[i] = entry; else comm.notes.push(entry);
    state.community = comm;
    saveState();
    closeNoteModal();
    renderNotes();
  });

  // ---- Modal dismissal ----
  $$('.modal').forEach(m => m.addEventListener('click', (e) => {
    if (e.target === m && !m.classList.contains('alarm-modal')) m.hidden = true;
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach(m => { if (!m.classList.contains('alarm-modal')) m.hidden = true; });
    }
  });
}

// ---- Seed ----
function seedSample() {
  if (state.medications.length || state.careTasks.length) return;
  state.medications.push(
    { id: newId(), name: 'Heart Medication', dosage: '1 tablet', time: '08:00', enabled: true, notes: 'After breakfast' },
    { id: newId(), name: 'Vitamin D', dosage: '1 tablet', time: '20:00', enabled: true, notes: '' }
  );
  state.careTasks.push(
    { id: newId(), name: 'Catheterization', interval: 4, enabled: true, notes: 'Track fluids' }
  );
  // Seed a couple of sample destinations
  if (!state.destinations || state.destinations.length === 0) {
    state.destinations = [
      { id: newId(), label: 'Home', address: '123 Main St, Your City, USA', isDefault: true },
      { id: newId(), label: 'Doctor', address: 'City Medical Plaza, Suite 204', isDefault: false }
    ];
  }
  saveState();
}

// ---- Init ----
function init() {
  bindEvents();
  ensureNotificationPermission();
  seedSample();
  tickClock();
  setInterval(tickClock, 30000);
  renderDashboard();
  renderMeds();
  renderCare();
  renderAlarmLog();
  renderCalendar();
  // Rides initial render too, so they're warm when user opens the tab
  renderProfile();
  renderDestinations();
  renderProviders();
  renderTrips();
  // Community initial render
  renderInterestsCard();
  renderLocalSocial();
  renderCommunities();
  renderSavedResources();
  renderNotes();
  tryGeolocate();
  checkSchedule();
  setInterval(checkSchedule, 30000);
}

document.addEventListener('DOMContentLoaded', setupAuth);
