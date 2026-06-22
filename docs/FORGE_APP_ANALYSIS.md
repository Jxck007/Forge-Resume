# Forge Resume App Analysis

## 1. Executive Summary
Forge Resume is a React 19 + TypeScript + Vite app with Firebase Auth/Firestore, local guest mode, React PDF export, a normalized resume schema, a profile-to-resume pipeline, template previews, and a paused ATS surface. The current product direction appears to be a stable resume builder first: guest or sign-in entry, create/import/edit, preview, export PDF, then later AI/ATS/Typst.

Most core builder and preview flows are present. The largest current product risks from code structure are around ATS clutter/legacy code, AI/import complexity, and some layout overlap risk in project rendering. Guest/account storage is already scoped, but several historical/legacy paths still exist and should be treated carefully.

## 2. Tech Stack Detected
- **Framework/build:** React 19, TypeScript, Vite (`package.json`, `vite.config.ts`)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`, custom CSS variables in `src/index.css`
- **Auth/data:** Firebase Auth + Firestore + Storage (`src/config/firebase.ts`, `src/services/firebase.ts`)
- **PDF:** `@react-pdf/renderer` (`src/components/ResumePdfDocument.tsx`)
- **Parsing/import:** `pdfjs-dist`, `mammoth`, `tesseract.js`, `pako` (`src/utils/resumeParser.ts`, `src/utils/resumeImport.ts`)
- **AI:** Google GenAI SDK plus custom provider wrappers (`src/services/ai.ts`, `src/services/aiProvider.ts`, `src/services/groq.ts`)
- **Animation/UI:** `motion`, `lucide-react`
- **Deployment target:** Vercel per repo instructions/README

### Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run clean`
- `npm run lint` (TypeScript check via `tsc --noEmit`)

## 3. Repository Structure
### Main entry points
- `src/main.tsx`
- `src/App.tsx`

### Layout / shell
- `src/components/Header.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/WorkspaceLoadingScreen.tsx`
- `src/components/NotFoundPage.tsx`
- `src/components/FirebaseSetupWizard.tsx`

### Primary pages/features
- `src/components/Dashboard.tsx`
- `src/components/ResumeBuilder.tsx`
- `src/components/ResumePreview.tsx`
- `src/components/MyProfile.tsx`
- `src/components/Settings.tsx`
- `src/components/Auth.tsx`
- `src/components/ProfileSetup.tsx`
- `src/components/ATSAnalyzer.tsx` (legacy/visible only if route/tab exposes it)
- `src/components/AtsDiagnosticsConsole.tsx`
- `src/components/TemplateShowcase.tsx`
- `src/components/TemplateActualPreview.tsx`

### Shared component folders
- `src/components/resume/*` (PDF block components)

### State / types / schema
- `src/types.ts`
- `src/schema/resumeSchema.ts`
- `src/utils/utils.ts` (general helpers via `src/utils.ts`)

### Services / data
- `src/services/firebase.ts`
- `src/services/ai.ts`
- `src/services/aiProvider.ts`
- `src/services/groq.ts`

### Firebase
- `src/config/firebase.ts`
- `firestore.rules`
- `README.md` references Firebase setup

### PDF / preview / template
- `src/components/ResumePdfDocument.tsx`
- `src/components/ResumePreview.tsx`
- `src/components/TemplateShowcase.tsx`
- `src/components/TemplateActualPreview.tsx`
- `src/components/resume/*`
- `src/design-system/resumeSystem.ts`

### Parser / import
- `src/utils/resumeParser.ts`
- `src/utils/resumeImport.ts`
- `src/utils/aiImportQuality.ts`

### ATS / scan
- `src/utils/advancedAtsEngine.ts`
- `src/utils/atsV2.ts`
- `src/utils/atsSuggestionEngine.ts`
- `src/utils/atsAiPrompts.ts`
- `src/utils/atsAiValidators.ts`
- `src/components/ATSAnalyzer.tsx`
- `src/components/AtsDiagnosticsConsole.tsx`
- `src/ats/*`

### AI-related
- `src/services/ai.ts`
- `src/services/aiProvider.ts`
- `src/services/groq.ts`
- `src/utils/atsAiPrompts.ts`
- `src/utils/atsAiValidators.ts`
- `src/utils/aiImportQuality.ts`

## 4. Entry Points and App Boot Flow
- `src/main.tsx` mounts `<ErrorBoundary><App /></ErrorBoundary>`.
- `src/App.tsx` decides auth, guest mode, routing, workspace hydration, and which major page renders.
- Firebase config is initialized in `src/config/firebase.ts` if env vars exist.
- `App` listens for auth state, hydrates user/guest workspace, and routes by `window.location.pathname`.

## 5. Routes and Pages
Observed paths in `src/App.tsx`:
- `/` and `/dashboard` → Dashboard
- `/builder` → Resume builder + live preview
- `/profile` → Profile page / setup
- `/settings` → Settings page
- `/ats` → paused feature page
- unknown route → `NotFoundPage`

### Dashboard
**File:** `src/components/Dashboard.tsx`
- Current dashboard is the main launchpad for create/import/open/resume actions.
- It includes template selection, import, duplicate/archive/delete, and latest resume actions.
- ATS clutter appears to be largely hidden from top-level nav, but legacy ATS code remains in the repo.
- Fits current clean Forge flow and should be kept.
- UX note: the dashboard is also where template gallery and create/import decisions happen, so it is a core flow surface.

### Builder / Edit Resume
**File:** `src/components/ResumeBuilder.tsx` via `src/App.tsx`
- Primary editing experience.
- Uses normalized resume state plus settings/profile hydration.
- Has mobile editor/preview tabs.
- Currently central to the product and should be kept.

### Preview
**File:** `src/components/ResumePreview.tsx`
- Live PDF preview and export orchestration.
- Renders React PDF output and template fit states.
- Core product surface; keep.

### Templates
**Files:** `src/components/TemplateShowcase.tsx`, `src/components/TemplateActualPreview.tsx`
- Template gallery is currently presented in a popup from the dashboard.
- Uses a real renderer preview of a sample John Doe resume.
- This should be kept as part of template selection UX.

### Import
**Files:** `src/utils/resumeImport.ts`, `src/utils/resumeParser.ts`, dashboard import UI
- Import exists and supports PDF/DOCX/text/image based on utility functions.
- Guest import is intentionally restricted in UI.
- Review-before-add flow exists in the dashboard.
- Needs verification for robustness on all file types.

### Settings / Profile
**Files:** `src/components/Settings.tsx`, `src/components/MyProfile.tsx`, `src/components/ProfileSetup.tsx`
- Settings currently contains resume preferences, AI provider setup, and help/tutorial controls.
- Profile is gated for signed-in users.
- Profile setup exists as part of onboarding / account flow.

### Help / Feedback
**Files:** `src/components/Header.tsx`, `src/components/GuidedSpotlightTour.tsx`, `src/components/OnboardingTour.tsx`
- Feedback dialog exists in the header.
- Contextual tutorials exist and are routed from header help.
- Global help behavior is contextual, not a separate route.

### Auth / Login / Signup
**File:** `src/components/Auth.tsx`
- Login/register/forgot password and Google sign-in exist.
- Guest continuation exists.
- There was a recent guard to avoid Google/guest race conditions.

### Guest mode UI/components
- Guest state is handled in `src/App.tsx`.
- Guest-only storage and guest warnings are present.
- Guest import restrictions are in dashboard and app shell.

### Not Found / error pages
- `src/components/NotFoundPage.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/WorkspaceLoadingScreen.tsx`

### ATS / Scan / Reports / Interview simulator
- `src/components/ATSAnalyzer.tsx`
- `src/components/AtsDiagnosticsConsole.tsx`
- `src/utils/advancedAtsEngine.ts`
- `src/utils/atsV2.ts`
- `src/utils/atsSuggestionEngine.ts`
- `src/ats/*`
- ATS is currently paused in product routing (`/ats` shows paused page), but the code remains in repo.

## 6. Navigation and User Flow
### Current flow
1. Open Forge
2. Auth screen or continue as guest
3. Dashboard
4. Create/import/open resume
5. Builder + preview
6. PDF export

### Guest mode
- Guest mode is maintained in app state and localStorage-scoped keys.
- Guest can edit locally and export PDFs.
- Guest can see dashboard/builder/help, but profile/settings are restricted.
- Guest import currently prompts sign-in rather than silently importing.

### Where users can get stuck
- If auth is unresolved, `WorkspaceLoadingScreen` appears.
- If no resume is selected, builder shows a no-resume state.
- Guest in restricted areas is redirected to a paused/blocked state message.
- Unknown route shows 404.

### Protected routes / redirects
- `/profile` and `/settings` show guest-restricted message when not signed in.
- `/ats` is paused.
- Unknown routes route to `NotFoundPage`.

### Mobile / tablet concerns
- Builder uses a mobile toggle between editor and preview.
- Template showcase and PDF preview are large, so smaller screens should be verified.

## 7. Auth and Guest Mode
### Observed behavior
- Google/email/password auth in `src/components/Auth.tsx`.
- Guest continuation exists and is blocked while Google auth is in progress.
- Auth state is listened to in `src/App.tsx` via `onAuthStateChanged`.
- On auth transition, workspace state is reset before hydration.

### Guest persistence
- Guest-scoped keys exist in `src/utils/storageKeys.ts`.
- Guest editor/resume/profile draft are persisted locally in `src/App.tsx`.
- Guest to account import is not automatic; app shows a notice instead.

### Risks / notes
- Legacy global localStorage keys still exist as ignored markers only.
- `resetFirebaseConfiguration()` currently clears `sessionStorage` and reloads the page (`src/config/firebase.ts`).
- Guest/import behavior may still need more UX polish.

## 8. Firebase and Data Model
### Firebase setup
- `src/config/firebase.ts` reads `VITE_FIREBASE_*` env vars.
- If config exists, app initializes Firebase client SDK.
- README says copy `.env.example` to `.env.local`, but `.env.example` is not present in the current repo state (needs verification).

### Data model
- Canonical app types are in `src/types.ts`.
- Resume normalization is in `src/schema/resumeSchema.ts`.
- There is a migration-friendly normalized model plus adapters from older shapes.

### Firestore usage
- Firebase services in `src/services/firebase.ts` handle user resumes, profile, settings, feedback, and sync logic.
- Firestore paths are not fully mapped here; needs verification from service functions.

## 9. Resume Builder Flow
### Data flow
- App hydrates user or guest workspace in `src/App.tsx`.
- Dashboard chooses create/import/open actions.
- Builder edits active resume.
- Preview reads the same resume object and renders PDF.
- Save flow appears centralized in app/service layer.

### Creation flow
- Create from profile or blank is supported in dashboard UI.
- Profile-created resume is expected to use `profileToResume` (`src/utils/profileToResume.ts`).
- Guest creation uses local guest resume normalization in `src/App.tsx`.

### Save/load flow
- Signed-in resumes use Firestore and user-scoped cache keys.
- Guest resumes use localStorage keys.
- Active resume selection is also persisted locally by scope.

## 10. Templates, Preview, and PDF Export
### Template system
- Template gallery popup exists in dashboard.
- Real renderer preview is lazy-loaded from `TemplateActualPreview`.
- Sample previews use a John Doe resume and the actual PDF renderer.

### PDF renderer
- `src/components/ResumePdfDocument.tsx` is the main React PDF document.
- Fonts are registered there.
- Layout profiles vary by template.

### Known risk areas
- Project tech stack / description overlap has been a known layout risk in preview/PDF.
- Template differences can cause overflow, especially in compact or multi-column layouts.
- Raw vs embedded link handling is centralized in `src/utils/linkDisplay.ts`.

### Browser preview vs exported PDF
- Preview is rendered from the same React PDF document but also has fit/slot logic.
- There can still be differences in how browser iframe preview and final export behave.

## 11. Design System and Visual Language
### Current visual language
- Dark product shell with teal/emerald accent.
- Custom CSS variables in `src/index.css`:
  - `--forge-bg: #090d0f`
  - `--forge-surface: #101619`
  - `--forge-surface-raised: #162024`
  - `--forge-border: #253238`
  - `--forge-text: #f4f8f7`
  - `--forge-text-muted: #a7b5b5`
  - `--forge-accent: #72dfca`
  - `--forge-accent-strong: #39baa9`
  - `--forge-danger: #fb7185`
  - `--forge-warning: #fbbf24`
- Border radius is relatively small/moderate (`--forge-radius: 9px`).
- Shadows are restrained, with some larger product-card shadows.
- Fonts imported in CSS: Inter, JetBrains Mono, Playfair Display, Space Grotesk, Merriweather, Plus Jakarta Sans.
- Tailwind utility classes are used heavily in components.

### UI patterns
- Mostly dark cards, bordered panels, rounded corners.
- Buttons use emerald accents and muted borders.
- Loading states use spinner-based shells and professional copy.
- Empty states exist for no resume selected, paused features, auth, and not found.

### UX feel
- Generally professional and calm.
- Some legacy ATS/AI surfaces still create clutter in code even if hidden in UI.

## 12. Loading, Empty, Error, and Not Found States
### Loading
- `WorkspaceLoadingScreen` is used for auth and workspace hydration.
- Lazy-loaded route content uses suspense fallback.
- Template preview has its own loading state.

### Empty states
- No resume selected state in builder.
- Dashboard empty/launch states.
- ATS empty state in console component.

### Error states
- `ErrorBoundary` wraps the app.
- `NotFoundPage` exists for unknown routes.
- Firebase setup wizard appears when config is missing.
- `WorkspaceLoadingScreen` offers retry/home/dashboard actions.

### Raw error exposure
- Some dev console errors still exist in services and AI utilities.
- Needs verification whether any user-facing stack traces remain in production paths.

## 13. ATS / Scan / Reports Clutter Audit
### Present files (visible or internal)
- `src/components/ATSAnalyzer.tsx` — legacy ATS UI, likely hidden/paused now
- `src/components/AtsDiagnosticsConsole.tsx` — console UI for staged ATS
- `src/utils/advancedAtsEngine.ts` — old deterministic ATS engine
- `src/utils/atsV2.ts` — newer ATS orchestration/diagnostics
- `src/utils/atsSuggestionEngine.ts` — suggestion classification
- `src/utils/atsAiPrompts.ts` — AI prompts
- `src/utils/atsAiValidators.ts` — JSON validators
- `src/ats/ARCHITECTURE.md`
- `src/ats/core/types.ts`
- `src/ats/local-readability/index.ts`
- `src/ats/ai-job-match/index.ts`
- `src/services/aiProvider.ts`
- `src/services/groq.ts`
- `src/App.tsx` `/ats` paused route

### Audit notes
- ATS is currently visible in code but paused in route UI.
- Legacy deterministic and AI ATS code still remains internal.
- Some AI helpers still have old deep-ATS / rewrite flows.
- Recommended product action: keep hidden/paused now; delete later only after core builder is stable.

## 14. AI Readiness Audit
### Current AI-related code
- `src/services/ai.ts` provides provider API calls.
- `src/services/aiProvider.ts` wraps JSON generation and validation.
- `src/services/groq.ts` contains content rewrite and parse helpers.
- `src/utils/aiImportQuality.ts` exists for import-quality AI assistance.
- `src/utils/atsAiPrompts.ts` and `src/utils/atsAiValidators.ts` define prompt/JSON helpers.

### Environment/config
- AI provider keys appear to live in `UserSettings` and may be persisted in Firestore for signed-in users.
- No backend route is clearly required for current client-side provider calls.

### Proposed future AI structure (planning only)
- Local Only
- Forge Free Beta AI
- BYOK Advanced
- Puter AI later
- No ATS for now

## 15. Mobile and Responsive UX Risks
- Builder already has mobile editor/preview toggle.
- Template popup and PDF iframe previews are dense and may need mobile validation.
- Header and dashboard have multiple action clusters that can wrap badly on narrow screens.
- Template showcase and preview are likely the most sensitive to horizontal overflow.
- Needs verification on tablet widths and iPhone-sized widths.

## 16. Known Bugs and Risk Areas
1. **Project tech stack overlap risk** — project blocks in preview/PDF can overlap description if layout math is too tight.
   - Files to inspect: `src/components/resume/ProjectBlock.tsx`, `src/components/ResumePdfDocument.tsx`, `src/components/ResumePreview.tsx`
2. **Legacy ATS clutter** — many ATS files still exist even though `/ats` is paused.
3. **AI helper complexity** — multiple old and new AI paths coexist.
4. **Storage/account safety** — scoped keys are in place, but legacy globals still exist as ignored markers.
5. **Template preview heaviness** — `TemplateActualPreview` renders the real PDF and may be expensive.
6. **No automated regression coverage found** — storage/PDF/ATS flows appear mostly manual.
7. **Potential env mismatch** — README mentions `.env.example`, but it is not currently visible in repo root.

## 17. Prioritized Issues
### P0
- Blank page / raw error / auth stuck state
- Account mix / data leakage
- Lost resume due to improper guest/account hydration

### P1
- PDF / preview overlap or broken export
- Profile-to-resume mismatch
- Builder data shape mismatch or missing normalization

### P2
- Navigation cleanup
- ATS clutter hidden but still present in code
- Template showcase and help/tutorial polish
- Empty/loading states consistency

### P3
- AI provider UX and BYOK planning
- Import quality AI

### P4
- Future ATS rebuild
- Typst renderer preparation

## 18. Recommended Roadmap
### Phase A: App flow + guest fixes
- Verify guest/account boundaries and hydration.
- Keep no-resume and auth loading states stable.
- Ensure guest import decisions are clear.

### Phase B: Navigation/dashboard cleanup
- Keep only core builder flow visible.
- Remove/continue hiding ATS and old scan clutter.
- Simplify dashboard actions.

### Phase C: Hide ATS clutter + paused pages
- Keep `/ats` paused.
- Remove visible ATS wording from product shell.

### Phase D: Preview/PDF/template fixes
- Fix project tech stack overlap.
- Validate link rendering and wrapping.
- Check page-fit behavior.

### Phase E: Tutorial/loading/error polish
- Make onboarding contextual and safe.
- Improve loading microcopy and error fallback.

### Phase F: AI Assist Beta intro card only
- Add planning-only surfacing, no core ATS yet.

### Phase G: BYOK and free AI backend later
- Session-only byok rules first.
- Avoid storing secrets in weak client storage.

### Phase H: Honest ATS rebuild much later
- Rebuild ATS after builder/export are stable.

## 19. Questions for Owner
Only blocking questions:
1. Should the paused ATS route remain permanently hidden from nav, or should it keep a redirect/pause page for direct links?
2. Is the `.env.example` file expected to exist, or should one be created later?
3. Should any legacy AI helper features remain in the UI or be fully hidden until the next AI phase?

## 20. Recommended Next Codex Prompt
Phase A + B only:

> Fix any remaining app-flow and dashboard/navigation risks without touching AI or ATS implementation. Prioritize guest/account safety, no blank/loading states, clearer create/import choices, and making the dashboard the single clean entry point for create/import/template selection. Keep changes small, preserve builder/preview/PDF behavior, and validate with build/lint/typecheck.

