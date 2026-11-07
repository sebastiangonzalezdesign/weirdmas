# Weirdmas

A December 2026 illustration challenge for Lu, Sebastian, and future participants. The React + TypeScript + Vite PWA uses Supabase email OTP authentication, Postgres for participant assignments and drawing metadata, and a private Storage bucket for uploaded artwork.

## Run locally

Requirements: Node.js 22+, and npm.

```sh
npm install
npm run dev
```

Create a local `.env.local` from `.env.example` and add the Supabase project URL and publishable key. Never use a service-role key in the browser or a `VITE_` variable. Open the local URL printed by Vite. The production checks are:

```sh
npm run lint
npm run build
npm run preview
```

Use HTTPS or localhost to test PWA installation and service-worker behavior. The app uses Google Fonts when online and falls back to system sans-serif/script fonts when unavailable.

## Artwork upload slots

The current worktree includes portrait SVGs and a transparent mascot PNG, which are used in onboarding and the dashboard. For final replacements, use these stable slots:

| Slot | Path | Intended use |
|---|---|---|
| Lu profile portrait | `public/assets/avatars/lu.png` | Profile selection and participant avatar; square PNG, transparent or solid background |
| Sebastian profile portrait | `public/assets/avatars/sebastian.png` | Profile selection and participant avatar; square PNG, transparent or solid background |
| Challenge cover | `public/assets/illustrations/weirdmas-cover.webp` | Optional welcome/dashboard decorative image; landscape 3:2 |
| Left/right wordmark decorations | `public/assets/illustrations/decoration-left.svg`, `decoration-right.svg` | Decorative illustrations on either side of the wordmark |
| Calendar day tile | `public/assets/illustrations/calendar-shape.svg` | Background shape for available, locked, and completed days |
| Sketchbook empty-state icon | `public/assets/illustrations/Book.svg` | Icon shown when no drawings are saved for the selected day |
| Empty sketchbook illustration | `public/assets/illustrations/empty-sketchbook.svg` | Optional replacement for the CSS-drawn gallery empty state |

The active preview assets are `public/assets/avatars/Lu.svg`, `public/assets/avatars/Sebastian.svg`, `public/assets/illustrations/cover.png`, the left/right decoration SVGs, `public/assets/illustrations/calendar-shape.svg`, and `public/assets/illustrations/Book.svg`. Participant records in `src/data/participants.ts` own their display names, profile labels, and avatar paths; illustration paths are set in `src/App.tsx`, `src/components/Gallery.tsx`, and calendar styles. Keep filenames stable or update those references when replacing artwork. Missing portraits fall back to initials. SVG is preferred for simple vector illustrations; use optimized WebP/PNG for raster artwork. Recommended profile source size is 512 × 512 px and cover source size is at least 1200 × 800 px. Add new participants as records in the same array; IDs must be unique and stable.

`public/assets/brand/weirdmas-mark.png` is the Weirdmas home-screen icon source. The 180 px variant is used by iPhone home-screen installation; 192 px and 512 px variants are used by the PWA manifest.

## Supabase setup

1. In the Supabase project, open **SQL Editor**, run the migration in `supabase/migrations/20260601000000_weirdmas_challenge.sql`, and confirm it completes.
2. Before prelaunch testing, run the follow-up migration in `supabase/migrations/20261107182500_weirdmas_test_mode.sql`. It temporarily bypasses date locks while preserving sequential, one-day-at-a-time progression.
3. Generate one private, one-time profile code per participant in the SQL Editor:

   ```sql
   select public.issue_participant_claim_code('lu');
   select public.issue_participant_claim_code('sebastian');
   ```

   Each query returns a random code once. Share each code privately with its participant; do not put the codes in the app, source control, or chat. A code can be claimed only once. If an unused code needs to be replaced, run its query again; a claimed profile cannot be re-issued through this function.
4. Each participant selects their profile, enters their own email, verifies the emailed OTP, then enters their one-time profile code. The verified email account is permanently bound to that profile. Email addresses do not need to be added to Supabase in advance. Future sign-ins need only the email OTP.
5. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project's API settings. The publishable/anon key is intended for the browser; never expose a service-role or secret key.
6. Add those same two values to the Vercel project's Environment Variables for the environments you deploy, then redeploy. The app displays an explicit configuration error if these values are missing.
7. Supabase Auth must allow the deployed app's URL. The email OTP template should contain `{{ .Token }}`; SMTP delivery can use the configured Resend sender.

While test mode is on, the Sebastian profile has a reset button that deletes both participants' test drawings and revealed prompts while preserving their profile bindings and claim codes. After testing, disable test mode in SQL Editor:

```sql
update public.challenge_settings
set test_mode = false
where singleton = true;
```

Reload the app after disabling test mode to restore the December date locks and hide the reset control.

The migration seeds Lu, Sebastian, all 31 prompts, and deterministic assignments. A unique database constraint guarantees different prompts for participants on each day. It also creates the private `weirdmas-drawings` bucket, row-level security policies, and server-side eligibility checks. The challenge unlock time is 6:00 am in `America/Bogota`; each participant must complete their earliest due day before a later incomplete day opens. Missed days do not expire. A participant can replace their own drawing for a completed day until the shared reveal.

Each participant can read only their own drawings and revealed prompts until both active participants have all 31 drawings. An organizer can manually release histories from the Supabase SQL Editor if needed:

```sql
update public.challenge_settings
set force_shared_reveal = true
where singleton = true;
```

Uploaded images are limited to PNG, JPEG, WebP, or GIF, up to 10 MB. The bucket remains private; the app requests temporary signed URLs. The app does not currently queue uploads offline.

Vercel deployments connected to GitHub run when the configured branch is pushed. The PWA is configured to update automatically when a new production build is available. The Supabase migration and one-time profile codes still need to be applied/configured in the project before participants can sign in.

## Structure

```text
src/
  components/       Reusable calendar, mobile navigation, participant picker, prompt, gallery, sketchbook page, and icon
  data/             Local participant display fallback and the 31 prompt records
  lib/               Challenge date formatting and Supabase client/services
  App.tsx            Onboarding, dashboard, and sketchbook-page composition
  styles.css         Design tokens, glass surface, responsive layouts, component styles
supabase/migrations/ Database schema, assignments, storage bucket, and row-level security
public/assets/       PWA icon and reserved artwork upload slots
```

The participant picker is populated from Supabase display records and can expand beyond the initial two. Each active profile needs its own one-time claim code and 31 distinct daily assignments. On narrow screens, a floating glass navigation switches among Today (prompt and upload), Calendar, and Sketchbook; choosing an available calendar day returns to Today.

## Design system

CSS custom properties at the top of `src/styles.css` are the source of truth for the supplied palette. Reusable glass panels use a translucent dark gradient, subtle border, inset highlight, and backdrop blur, with a solid dark fallback. Lato is used for UI and Great Vibes for the wordmark and script accents. Components are kept small and data-driven so the visual language can expand without tying it to the initial two participants.

## Limitations

Uploads require a network connection. Authentication, participant binding, date eligibility, prompt reveal, and drawing visibility are enforced by Supabase; client-side state is only used for the current screen. New participants require an active row, a one-time claim code, 31 distinct daily assignments, and matching Supabase Auth configuration.
