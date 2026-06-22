# Forge Resume Current State

_Last verified against the repository: 2026-06-20._

## 1. Product Goal

Forge Resume currently targets a stable professional resume-building workflow: enter as a guest or authenticated user, create a resume, edit normalized resume data, inspect the React-PDF preview, and export a selectable PDF. ATS is intentionally paused in the visible product. AI and Typst work described below is planning only; this document does not mark those phases complete.

## 2. Current User Flow

1. Open Forge.
2. Sign in with Firebase Auth or choose **Continue as guest**.
3. Use Dashboard actions to create, import, edit, choose a template, or open PDF export.
4. Choose a template from the Dashboard popup. One complete John Doe sample is rendered at a time with the production PDF renderer.
5. Start from scratch, import, or use a saved profile where available.
6. Edit in `ResumeBuilder`; preview and export through `ResumePreview`.

Guest mode can create, edit, preview, and export one local draft. The current import UI requires sign-in and a configured AI provider; guest import is not currently functional.

## 3. Working Features

### Auth and guest mode

- `src/components/Auth.tsx` provides email/password, Google sign-in, password reset, and guest entry.
- A synchronous guard disables guest entry while a Google authentication attempt is pending.
- `src/App.tsx` hydrates guest data only from guest-scoped keys and authenticated data only from UID-scoped keys.
- Account switching resets volatile workspace state before user hydration.
- Existing guest data is not auto-imported after login; the account receives a local-only notice.

### Dashboard

- Visible actions: Create Resume, Import Resume, Edit Latest Resume, Choose Template, Export PDF.
- Template selection is a Dashboard popup, not a navigation route.
- Resume cards support open, duplicate, archive, and delete where account mode allows them.
- Guest empty states and local-storage messaging are present.
- No visible ATS card, scan action, score widget, or ATS navigation item was found in the active Dashboard/Header flow.

### Builder and profile

- `src/components/ResumeBuilder.tsx` edits personal details, summary, education, experience, internships, skills, projects, certifications, achievements, volunteering, languages, and custom sections.
- Section headings and section order use shared resolver utilities.
- Profile-created resumes use `profileToResume()`.
- Blank creation is an explicit choice.
- Guest changes persist immediately to guest local storage.
- Account changes update local React state immediately and debounce Firestore writes by one second.

### Stability and guidance

- `ErrorBoundary`, `NotFoundPage`, and `WorkspaceLoadingScreen` exist.
- Loading timeout fallback appears after eight seconds.
- First-run and contextual tours use `GuidedSpotlightTour` and leave highlighted background controls pointer-accessible.
- Header Help is contextual for Dashboard, Builder, Profile, and Settings.

## 4. Paused Features

- ATS/scan is hidden from product navigation and Dashboard.
- Direct `/ats` access renders a feature-paused page instead of the analyzer.
- Legacy ATS engines, result types, AI job-match modules, and ATS UI components remain in the repository for a future adapter-first rebuild.
- Typst is not implemented.
- Job search and MCP agents are not implemented.
- Guest resume import is currently sign-in-gated.

## 5. Known Risks

### High

- **Provider keys are currently stored in authenticated Firestore settings.** This conflicts with the planned session-only BYOK policy. `Settings.tsx` and `services/firebase.ts` must be migrated before the AI phase. Do not describe current storage as server-secret encryption.
- **Existing AI code is already present.** Builder rewrite actions and signed-in import can call configured providers from the browser. It is optional and hidden without a key, but it is not a clean future-only abstraction yet.
- **React-PDF is large.** The renderer is lazy-loaded, but its generated chunk remains around 1.5 MB and can feel slow on low-memory mobile devices.

### Medium

- Header tab changes primarily update React state; URL synchronization is not consistently centralized through `navigateTo()`. Browser history behavior needs verification.
- `resetFirebaseConfiguration()` calls `sessionStorage.clear()`, which can clear unrelated session-scoped values for the same origin.
- The Error Boundary states that resume data is safe even when the most recent in-memory edit may not have completed a debounced cloud save.
- Template popup responsiveness and real PDF iframe behavior need device testing at 320–375 px widths.
- PDF page-fit logic is renderer-based, but all templates still need long-content regression fixtures.
- User settings include a default export format, but direct preview export currently remains PDF-focused. JSON export behavior needs verification.

### Low / needs verification

- Old ATS-only text remains inside inactive Builder action branches and legacy ATS files, although no active no-key control exposes it.
- No dedicated automated storage-isolation or PDF-layout regression suite was found.
- Firestore rules were not inspected through Firebase tooling in this snapshot.

## 6. Current Routes

| Path | Current behavior |
|---|---|
| `/`, `/dashboard` | Dashboard after auth/guest entry |
| `/builder` | Active resume Builder, or a safe no-resume state |
| `/profile` | Authenticated profile; guest receives a restricted-state page |
| `/settings` | Authenticated settings; guest receives a restricted-state page |
| `/ats` | Feature temporarily paused page |
| Unknown path | `NotFoundPage` with Dashboard action |

There is no Templates route. Template selection lives in the Dashboard popup.

## 7. Current Storage Keys

### Guest

- `forgeResume:guest:activeResume`
- `forgeResume:guest:editorState`
- `forgeResume:guest:profileDraft`
- `forgeResume:guest:atsCache` (legacy/paused ATS cache)
- `forgeResume:guest:feedbackSubmissions`
- `forgeResume:guest:tutorialCompleted`

### Authenticated user

- `forgeResume:user:{uid}:activeResume`
- `forgeResume:user:{uid}:profile`
- `forgeResume:user:{uid}:editorState`
- `forgeResume:user:{uid}:atsCache`
- `forgeResume:user:{uid}:feedbackSubmissions`
- `forgeResume:user:{uid}:tutorialCompleted`
- `forgeResume:user:{uid}:settingsTutorialCompleted`
- `forgeResume:user:{uid}:resumeIndex`
- `forgeResume:user:{uid}:resume:{resumeId}`

Legacy global key names remain only as ignored markers in `storageKeys.ts`: `forge_profile_`, `forge_settings_`, `forge_resume_`, and `forge_local_resumes_list`. No active direct load from those keys was found. Local storage access is centralized in `storageKeys.ts`. No resume data is intentionally stored in session storage, but Firebase configuration reset currently clears all session storage.

## 8. Current Resume Data Flow

```text
Profile / blank creation / reviewed import
  -> profileToResume() or partial ResumeData
  -> normalizeResume()
  -> React App resume state
  -> ResumeBuilder onChange
  -> guest scoped local persistence OR debounced Firestore update
  -> ResumePreview
  -> ResumePdfDocument
```

`ResumeData` in `src/types.ts` is the active runtime shape. `normalizeResume()` supplies defaults and compatibility handling. `src/schema/resumeSchema.ts` adapts data for renderer primitives. There are normalized-model utilities in the repository, but complete migration of every old type path needs verification before a model refactor.

## 9. Current PDF/Preview Flow

- Renderer: `@react-pdf/renderer` through `ResumePdfDocument.tsx`.
- Preview: generated Blob URL displayed in an iframe by `ResumePreview.tsx`.
- Export: the same React-PDF document pipeline creates downloadable, text-based PDFs.
- Heavy Builder/Preview/PDF modules are lazy-loaded.
- Project rendering uses shared `ProjectBlock` flow: title and right-side metadata/links, then wrapping technology text, then description. Links use shared `linkDisplay` utilities and remain React-PDF links.
- Certification and contact blocks use shared renderer primitives.
- Page fitting uses rendered page counts and compact levels rather than character count alone.
- Remaining overlap risk: long localized strings, unusually long raw URLs, and dense multi-project resumes need fixture-based regression testing.

## 10. Current Import Status

- Dashboard supports signed-in import choices for PDF, DOCX, image OCR, and pasted text.
- PDF.js, Mammoth, and Tesseract are dynamically imported.
- Extracted text is sent through the currently configured browser-side AI provider for structuring.
- A review screen is shown before saving the imported resume.
- The selected Dashboard template is retained when the imported resume is created.
- Guest import currently shows available formats and asks the user to sign in; it does not parse locally into Builder.
- A local parser foundation exists in `src/utils/resumeParser.ts`, but it is not the active Dashboard import path. Full local-first parser UI integration needs verification/work.

## 11. Current Onboarding Status

- General completion keys are separated by guest and UID.
- Settings tour completion is UID-scoped.
- Dashboard, Builder, Profile, and Settings have contextual spotlight steps.
- Header Help starts the guide for the active page.
- Tour controls support Back, Next, Skip, Finish, Escape, and arrow keys.
- The spotlight layer is pointer-transparent except for the guide card, so highlighted background controls remain usable.
- Mobile uses a bottom guide card; device testing is still required for keyboard viewport and nested modal interactions.

## 12. Next Planned Phase: AI Assistant

Planning only:

- Keep free local Builder/Preview/PDF mode available without AI.
- Evaluate Puter AI as a candidate for public, no-bill-to-developer assistance.
- A future Forge Free Beta may use server-side Gemini with strict limits; this requires a secure Vercel-compatible architecture and must not assume Firebase Cloud Functions.
- Advanced BYOK may support Gemini, Groq, and OpenRouter.
- BYOK keys should be session-only first.
- No provider key should be stored in local storage, session storage, or Firestore.
- AI may assist with import structuring, summaries, bullet rewrites, grammar cleanup, and later job-description comparison.
- Every suggestion must be validated and reviewed before application. AI must never silently overwrite resume content.

Required prerequisite: remove current Firestore provider-key persistence and define a secure optional-provider boundary.

## 13. Later Phase: Typst Renderer

Planning only:

- Preserve the normalized resume source of truth.
- Introduce a renderer interface before adding Typst.
- Keep React-PDF as the working renderer until parity exists for text selection, links, pagination, templates, and deployment.
- Typst must not bypass shared section, link, or normalized-model rules.

## 14. Later Phase: Job Match / ATS Rebuild

Planning only:

- Keep local deterministic readability separate from AI semantic job matching.
- Require both AI availability and a target job description before displaying job-match results.
- Do not restore fake aggregate scores.
- Reuse normalized resume, parser evidence, section aliases, and renderer metrics.
- Migrate through adapters; do not delete shared resume/PDF utilities with legacy ATS code.
- Existing ATS files to audit later include `src/components/ATSAnalyzer.tsx`, `src/components/AtsDiagnosticsConsole.tsx`, `src/utils/advancedAtsEngine.ts`, `src/utils/atsV2.ts`, and `src/ats/*`.
