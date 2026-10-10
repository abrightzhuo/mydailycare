# MyDailyCare · Daily Care, Medication, Accessible Rides & Community Companion

A warm yellow-themed care companion web app designed around Nico's needs: ADHD / Executive Functioning support, wheelchair accessibility, Apple Watch heart-rate context, one-tap reminders for medication and care tasks (e.g. catheterization), a single hub for every accessible ride option in the United States, **and a community hub for connecting with other disabled adults nationwide**.

## Modules

| # | Module | Description |
| --- | --- | --- |
| 💊 | **Medications** | Add medication name, dosage and daily time (HH:MM). Alarm, audio chime and OS notification at the chosen time. |
| 🩺 | **Care Tasks** | Set interval in hours (e.g. catheterization every 4h). Reminded when due; tap **Done** to reset. |
| 📅 | **7-Day Calendar** | Roll-forward view with 💊 / 🩺 count badges. Tap to expand any day. ‹ / › for week navigation. |
| ⏲️ | **Quick Timer** | 5 / 10 / 15 / 30 / 60 min / 4-hour presets + custom minutes. |
| 💧 | **Catheter Timer** | One-tap 4-hour quick launch from the home dashboard. |
| 🚐 | **Accessible Rides (US)** | Single hub for every WAV, driver-assist and phone-based accessible ride service. |
| 🤝 | **Community (US)** | **NEW** — connect with other disabled adults across the U.S. via vetted online communities, saved resources, and personal accessibility notes. |

## Accessible Rides module

Nico's biggest remaining pain point was the inability to compare wheelchair-accessible ride options in one place. The Rides module solves that.

### Curated US providers

| Provider | Category | Coverage | Cost | Wait |
| --- | --- | --- | --- | --- |
| **Uber WAV** | WAV 🚐 | Nationwide | $$ | 5–20 min |
| **Lyft Access** | WAV 🚐 | Major metros | $$ | 5–25 min |
| **GoGoGrandparent** | Phone ☎️ | Nationwide · 24/7 | $$ | 15–30 min |
| **Curb** | Taxi 🚕 | 20+ US cities | $ | 5–15 min |
| **Uber Assist** | Driver-assist 🤝 | Major metros | $$ | 5–15 min |
| **Uber (Standard)** | Standard 🚗 | Nationwide | $ | 3–10 min |
| **Lyft (Standard)** | Standard 🚗 | Nationwide | $ | 3–10 min |
| **Local Paratransit** | Public 🚌 | Your city | $ | Varies |

Filters: **All · WAV · Driver Assist · Standard · Phone · Public**.

### One-tap booking

1. **Accessibility Profile** is saved once and auto-fills every booking's "Notes for driver":
   - Chair type (power / manual / foldable / none)
   - WAV / ramp / lift / driver-assist needs
   - Service animal
   - Pickup notes
2. **Saved Destinations** (Home, Doctor, Pharmacy, etc.) keep booking to two taps.
3. **Pickup + Dropoff + When + Riders** are chosen in one bottom-sheet.
4. Tap **Launch** — the app:
   - tries the **deep link** (e.g. `uber://?action=setPickup`) to open the native app;
   - if no native handler or 1.5s timeout, falls back to the **website** (`window.open(webUrl)`);
   - for phone-based providers (GoGoGrandparent, paratransit), falls back to `tel:` dial.
5. **Trip history** records every launch for later reference.

### Live location (best-effort)

The app requests location via the Geolocation API on first visit. If granted, it pre-selects "Current location" in the pickup menu. If denied or unavailable, a static "United States" badge is shown and providers are still listed with their national/regional coverage notes.

## Design choices (for Nico's profile)

- **Yellow / amber palette** with high contrast. Dark and light color schemes auto-adapt.
- **Executive-function friendly**: huge hit zones, clear iconography, single-tap Catheter Timer and one-tap provider cards.
- **Accessibility**: ARIA roles, labels, live regions; visible focus rings; `prefers-reduced-motion` respected; ≥ 44 × 44 px targets.
- **Multi-sensory reminders**: in-app alarm modal + synthesized audio chime + browser/system notification (granted after first interaction).
- **Local persistence**: `localStorage`; survives reloads.
- **Offline-capable**: pure static HTML / CSS / JS — no backend, no network deps at runtime.
- **One-screen view of everything**: the home dashboard shows medication next-up, care next-up, today's calendar count and the catheter quick-launch in a single glance.

## Community module

Nico wants to connect with other disabled adults across the country. This module curates real, free, public US communities — no account needed on this side; each card opens the community's own site in a new tab.

### Curated communities

| Community | Category | Members | Focus |
| --- | --- | --- | --- |
| **The Mighty** | General | 2M+ | Disability / chronic illness stories, groups, Q&A |
| **r/disability** | General | 60K+ | Broad disability discussion on Reddit |
| **r/wheelchairs** | Wheelchair | 15K+ | Gear, transfers, travel, accessibility |
| **United Spinal Association** | Wheelchair | 50K+ | SCI/D peer mentoring & local chapters |
| **AHA Support Network** | Heart | 100K+ | Heart patients & caregivers |
| **CHADD (Adults with ADHD)** | ADHD | 20K+ | ADHD adults, local groups, toolkits |
| **r/ADHD** | ADHD | 1M+ | Massive ADHD peer community |
| **Paralyzed Veterans of America** | Veterans | 20K+ | Veterans with SCI, sports, advocacy |
| **MDA** | Other conditions | — | Muscular dystrophy, ALS, neuromuscular |
| **Spina Bifida Association** | Other conditions | — | Spina bifida community & local chapters |
| **PatientsLikeMe** | Other conditions | 800K+ | Structured outcome-sharing across conditions |
| **Everyday Health Heart** | Heart | — | Heart disease discussion boards |

Filters: **All · General · Wheelchair · Heart · ADHD · Other conditions · Veterans**.

### Features

1. **About You** — pick interests (wheelchair, heart, ADHD, veterans, …). Matching communities get a ✓ MATCH badge and float to the top. All data stays on this device.
2. **Save for later (★)** — bookmark communities; they appear under "My Saved Resources" for one-tap access.
3. **Accessibility Notes** — save personal tips (venue accessibility, best WAV pickup spots, paratransit tricks). Tap any note to copy it to the clipboard for pasting into Reddit, The Mighty, or a friend's message.

### Connect Locally 🇺🇸 (NEW)

Real-world socializing with people near Nico:

1. **Set your city once** (e.g. "Austin, TX") — every search below is auto-built around it.
2. **One-tap local searches** — Meetup disability/wheelchair groups, Facebook local groups, Google support groups / adaptive sports / accessible events near the city.
3. **Local chapter finders** — real national orgs with in-person presence in most U.S. cities:
   - Center for Independent Living (CIL) directory
   - United Spinal local chapters
   - Move United adaptive sports chapters (wheelchair basketball, skiing, cycling…)
   - CHADD in-person ADHD support groups by state
   - MDA local care & community
   - Special Olympics local programs
4. **My Connect Card** — auto-generates a friendly self-intro from Nico's accessibility profile + interests + bio + city. Tap **Copy** to put it on the clipboard and paste it into a group post, email, or show someone new. Edits are saved; **↻ Regenerate** rebuilds it from profile data.

## Run locally

```bash
cd nico-care
python -m http.server 8765
# or
npx http-server -p 8765
```

Open `http://localhost:8765/` in your browser.

> Browser notifications and audio unlock after the first user interaction. Geolocation is requested once; if denied, providers still display by national coverage.

## File structure

```
nico-care/
├── index.html   Markup + ARIA roles (6 tabs + 5 modals)
├── styles.css   Yellow/amber palette · dark + light themes · Rides styles
├── app.js       State · scheduler · timer · calendar · Rides aggregator
└── README.md    This file
```

## Data model

`localStorage` key: `mydailycare.state.v4` (auto-migrates from v1, v2 and v3)

```ts
{
  medications: [{ id, name, dosage, time (HH:MM), enabled, notes }],
  careTasks:   [{ id, name, interval (hours), enabled, notes }],
  lastTriggered: { meds: { key: ts }, care: { taskId: ts } },
  alarmLog:    [{ at, message }],

  // v3:
  accessibility: {
    chairType,           // 'power' | 'manual' | 'foldable' | 'none'
    needWAV, needRamp, needLift, needAssist, serviceAnimal,
    notes
  },
  destinations: [{ id, label, address, isDefault }],
  trips:        [{ at, providerId, fromLabel, toLabel, notes }],
  currentLocation: { lat, lon, label } | null,
  rideFilter:   'all' | 'wav' | 'driver-assist' | 'standard' | 'phone' | 'public' | 'taxi',

  // v4:
  community: {
    interests: ['wheelchair', 'heart', 'adhd', ...],
    bio: '',
    saved: ['the-mighty', 'reddit-wheelchairs', ...],
    notes: [{ id, title, body, tags: [], at }],
    filter: 'all' | 'general' | 'wheelchair' | 'heart' | 'adhd' | 'condition' | 'veterans',
    localSocial: {
      city: 'Austin, TX',
      cardDraft: ''          // last-edited Connect Card text
    }
  }
}
```

The Calendar projects future occurrences:

- **Medications** at the same time every day.
- **Care tasks** from the last **Done** tap, stepping by `interval` hours; unscheduled ones fall on each interval slot of the day.

The Rides module projects no calendar data — it is a real-time aggregator with on-tap launch. Trip history is stored in `state.trips`.
