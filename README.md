# Weirdmas

A December illustration challenge for Lu, Sebastian, and future participants. This repository starts with the responsive React shell, reusable interface components, prompt content, and installable PWA setup. The browser build is a front-end prototype; it does not sync accounts, prompts, or drawings across devices yet.

## Run locally

Requirements: Node.js 20.19+ or 22.12+, and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The production checks are:

```sh
npm run lint
npm run build
npm run preview
```

Use HTTPS or localhost to test PWA installation and service-worker behavior. The app uses Google Fonts when online and falls back to system sans-serif/script fonts when unavailable.

## Artwork upload slots

No character artwork is included. Add the assets at these exact paths when ready:

| Slot | Path | Intended use |
|---|---|---|
| Lu profile portrait | `public/assets/avatars/lu.png` | Profile selection and participant avatar; square PNG, transparent or solid background |
| Sebastian profile portrait | `public/assets/avatars/sebastian.png` | Profile selection and participant avatar; square PNG, transparent or solid background |
| Challenge cover | `public/assets/illustrations/weirdmas-cover.webp` | Optional welcome/dashboard decorative image; landscape 3:2 |
| Empty sketchbook illustration | `public/assets/illustrations/empty-sketchbook.svg` | Optional replacement for the CSS-drawn gallery empty state |

Keep uploaded image filenames stable. Participant records in `src/data/participants.ts` own their avatar paths. SVG is preferred for simple vector illustrations; use optimized WebP/PNG for raster artwork. Recommended profile source size is 512 × 512 px and cover source size is at least 1200 × 800 px. Add new participants as records in the same array; IDs must be unique and stable.

The app shell currently uses CSS initials and abstract shapes so missing artwork never produces broken-image placeholders. `public/assets/brand/weirdmas-mark.svg` is a simple install icon, not final character art.

## Structure

```text
src/
  components/       Reusable calendar, participant picker, prompt, gallery, and icon
  data/             Participant configuration and the 31 prompt records
  lib/               Challenge date, unlock, and local assignment rules
  App.tsx            Onboarding and dashboard composition
  styles.css         Design tokens, glass surface, responsive layouts, component styles
public/assets/       PWA icon and reserved artwork upload slots
```

The initial participant list contains Lu and Sebastian. The picker reads an array, not a two-person conditional. For a given date, prompt assignment is deterministic in this local prototype and distinct between participants while there are enough prompts. The calendar is for December 2026 and each date unlocks at 6:00 am in the device's local timezone. Drawings uploaded in the current browser session appear in that session's gallery and mark that profile/day as completed; they are not persisted after refresh and are not shared with another device.

## Design system

CSS custom properties at the top of `src/styles.css` are the source of truth for the supplied palette. Reusable glass panels use a translucent dark gradient, subtle border, inset highlight, and backdrop blur, with a solid dark fallback. Lato is used for UI and Great Vibes for the wordmark and script accents. Components are kept small and data-driven so the visual language can expand without tying it to the initial two participants.

## Future integration points

- **Prompt service:** replace the deterministic `promptFor` demo function with an API that atomically assigns a prompt per challenge date and participant, enforcing no duplicate prompt for the same date.
- **Unlock authority:** move the 6:00 am date check to server-side policy, using the challenge's agreed timezone. The client check is only a visual prototype rule and can be changed locally.
- **Identity and participants:** replace the local profile selector with authenticated participant records while preserving stable participant IDs.
- **Drawing storage/gallery:** upload files to object storage and persist metadata (participant ID, prompt/date, storage URL, visibility) in a backend. Define who can view drawings and whether daily work stays hidden until the physical book reveal before enabling shared reads.
- **Offline behavior:** the PWA precaches the production shell. Persisting uploaded drawings offline and resolving later sync conflicts needs a deliberate storage/sync design.

No Supabase integration or prompt backend is included in this foundation.
