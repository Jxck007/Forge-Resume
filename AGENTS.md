# AGENTS.md
# Forge Resume Rules

## Workspace Context

Codex workspace files:

- Project config: `.codex/config.toml`
- Project memory: `.codex/memory/forge.md`
- Project skills: `.codex/skills/*/SKILL.md`
- Large vendor references: `.ai/vendor/*`

At session start:
1. Read `.codex/memory/forge.md`.
2. Use relevant `.codex/skills`.
3. Do not load full `.ai/vendor` folders unless needed.
4. Prefer targeted reads.

## Required Context Loading

At the start of every Codex session for this repo:

1. Read `.ai/memory/forge.md`.
2. Treat `.ai/vendor/agent-skills` as available reference skills.
3. Treat `.ai/vendor/ui-ux-pro-max-skill` as the UI/UX reference skill.
4. Treat `.ai/vendor/caveman` as the low-token response style reference.
5. Treat `.ai/vendor/graphify` as the architecture/codebase mapping reference.
6. Do not load entire vendor folders unless needed.
7. Use targeted reads/searches only.
8. If a skill is not needed for the task, do not load it.

Priority:
1. AGENTS.md
2. `.ai/memory/forge.md`
3. Forge Resume product rules
4. Relevant vendor skill only
5. User request

## Product

Forge Resume is an ATS-first, AI-assisted resume builder and resume intelligence platform.

It must feel like a professional document intelligence tool, not a simple form builder.

Core product goals:

1. Build ATS-safe resumes.
2. Generate reliable text-based PDFs.
3. Analyze resumes transparently.
4. Help users improve content with AI.
5. Support guest/no-signup usage.
6. Prepare for future Typst rendering.

---

## Current Stack

* React 19
* TypeScript
* Vite
* Firebase
* Firestore
* Firebase Auth
* React PDF
* Vercel deployment

---

## Hard Constraints

* Firebase Spark plan only.
* No Cloud Functions.
* No paid backend dependency required for core features.
* Vercel deployment.
* Keep API usage optional and replaceable.
* Never expose API keys or Firebase admin credentials.
* Core builder must work without AI if AI is unavailable.

---
## Agent Execution Rules

Before making changes:

1. Inspect architecture first.
2. Identify exact affected files.
3. Explain proposed file-by-file changes.
4. Wait for approval if more than 10 files are affected.

Implementation rules:

* Prefer modifying existing files over creating new files.
* Do not duplicate business logic.
* Do not create alternate resume models.
* Do not create alternate ATS scoring systems.
* Do not create alternate PDF rendering pipelines.
* Reuse existing utilities and types where possible.
* Keep bundle size reasonable.
* Prefer composition over duplication.

Validation rules:

* Run TypeScript checks.
* Run lint checks.
* Run build checks.
* Report failures honestly.
* Never claim tests passed if they were not executed.

Token efficiency:

* Read only files relevant to the task.
* Do not load entire repositories unnecessarily.
* Do not print unchanged files.
* Return patches and summaries instead of full file dumps.

## Product Priorities

1. ATS compatibility
2. PDF reliability
3. Data safety
4. Mobile responsiveness
5. Accessibility
6. Clean UX
7. AI assistance
8. Future renderer flexibility

---

## Design Direction

Inspired by:

* Linear
* Vercel
* Raycast
* OpenResume cleanliness

Design should be:

* Minimal
* Fast
* Clean
* Professional
* Mobile-first
* Accessible
* Low clutter

Avoid:

* Glassmorphism
* Purple gradients
* Crypto styling
* Overdesigned cards
* Heavy shadows
* Unreadable contrast
* Gimmicky animations

---

## Authentication Modes

Forge must support two modes:

### Guest Mode

* No signup required.
* User can build resume immediately.
* Local-only storage.
* Can download PDF.
* Can run ATS scan.
* Can import/export JSON.
* Must show clear privacy message.

### Account Mode

* Firebase Auth.
* Cloud-saved resumes.
* Resume history.
* Profile reuse.
* Saved scans where possible.

### Guest to Account Upgrade

When guest logs in:

Ask:

“Import current guest resume into this account?”

Options:

* Import as new resume
* Keep local only
* Discard guest draft

Never auto-merge guest data into account data.

---

## Data Safety Rules

Fix and prevent localStorage leakage.

Never use global resume storage keys.

Use scoped keys:

Guest:

* `forgeResume:guest:activeResume`
* `forgeResume:guest:editorState`

User:

* `forgeResume:user:{uid}:activeResume`
* `forgeResume:user:{uid}:profile`
* `forgeResume:user:{uid}:editorState`

Rules:

* Never load one user's data into another account.
* Never load guest data into account without confirmation.
* On logout, clear volatile editor state.
* On account switch, reset in-memory state before hydration.
* Old global localStorage keys must be ignored or offered as manual import only.

---

## Resume Data Model

Use a normalized resume model.

Builder, Preview, PDF, ATS, Parser, and future Typst renderer must consume the same normalized data.

Required function:

* `normalizeResumeModel()`

It should support migration from old editor data to new editor data.

Do not duplicate resume logic between modules.

---
## MCP Usage Rules

Use MCP servers only when necessary.

Preferred MCPs:

* Context7
* GitHub
* Firebase

Avoid unnecessary MCP calls when repository context already contains the answer.

Documentation lookup:
Context7

Repository operations:
GitHub

Firebase schema, auth, rules:
Firebase MCP

Do not use MCP servers as a substitute for reading the actual project code.
## Skills Priority

When multiple skills are available:

Priority Order:

1. Forge Resume Rules (this document)
2. Project-specific architecture decisions
3. UI UX Pro Max Skill
4. Agent Skills
5. Ponytail

Ponytail may improve workflow and memory, but must never override product architecture, ATS rules, PDF requirements, or data safety requirements.

## Profile to Resume Rules

Profile onboarding must create a useful resume.

If user fills:

* Name
* Email
* Phone
* Location
* Professional Summary
* Career Objective
* Skills
* Education
* Projects
* Links
* Certifications
* Achievements

Then generated resume must include those fields.

Never create a blank resume when profile data exists.

When creating a new resume, offer:

1. Create from Profile
2. Create Blank Resume

Blank must be intentional.

---

## Section Engine

No section heading should be hardcoded.

Use centralized section resolver.

Supported base sections:

* Summary
* Experience
* Education
* Skills
* Projects
* Certifications
* Achievements

Aliases:

* Summary
* Professional Summary
* Career Objective
* Profile
* About Me

All should count as summary for ATS.

Future support:

* Custom sections
* Section renaming
* Drag-and-drop ordering
* Template-specific headings
* AI-generated section names

---

## Link Handling

Support embedded and raw link modes.

Supported links:

* GitHub
* LinkedIn
* Portfolio
* Project links
* Live demo links
* Certificate links

Modes:

### Embedded

Example:

GitHub Profile

### Raw

Example:

https://github.com/example

Controls:

* Global default
* Per section override
* Per link override later if needed

Sections may include:

`linkDisplayMode: "embedded" | "raw" | "inherit"`

Builder, Preview, PDF, ATS, and future Typst renderer must respect the same setting.

---

## PDF Requirements

PDFs must be:

* Text-based
* ATS-readable
* Selectable
* Copyable
* Reliable
* Properly paginated
* Link-clickable
* Consistent with preview

Avoid:

* Image-only PDFs
* Broken hyperlinks
* Text overlap
* Date/title collision
* Section overflow
* False one-page estimation

React PDF remains current renderer.

Do not migrate to Typst yet.

---

## Typst Preparation

Prepare architecture only.

Future renderer architecture:

Resume Builder
→ Normalized Resume Model
→ Renderer Interface
→ ReactPdfRenderer
→ TypstRenderer
→ DocxRenderer

Create:

* `NormalizedResume`
* `ResumeRenderer`
* `RenderMetrics`
* `LayoutDiagnostics`
* `ReactPdfRenderer`

Typst will be added later for premium ATS-quality output.

---

## Resume Parser

Implement OpenResume-style parser flow, but do not copy code blindly.

Parser should support:

* Upload PDF
* Extract metadata
* Extract text
* Extract coordinates
* Detect sections
* Detect links
* Detect contact info
* Estimate reading order
* Detect multi-column risks
* Convert parsed resume into editable Forge resume

Extract:

* File name
* Page count
* PDF title
* Author
* Creation date
* Modification date
* Producer/tool
* Font names if available
* Embedded links if available
* Text items with page, x, y, width, height

Parser output should include:

* Metadata
* Text items
* Detected sections
* Detected resume model
* Parse diagnostics

---

## ATS Requirements

ATS must be evidence-based.

No fake scores.

No black-box scoring.

Every score must show:

* Why score exists
* Which section helped
* Which section hurt
* How to improve
* Score impact

ATS must support the 4-stage analyzer.

---

## 4-Stage ATS Analyzer

### Stage 1: Structural Scan

Handled by code.

Checks:

* Contact info
* Section existence
* Section order
* Layout risk
* Multi-column risk
* Page estimation
* Link formatting
* Skills layout
* Mobile responsiveness
* Tablet responsiveness

### Stage 2: Keywords Match

Handled by AI.

Checks:

* Job description alignment
* Missing skills
* Matched skills
* Partial matches
* Semantic equivalents

Examples:

* JS = JavaScript
* GCP = Google Cloud Platform
* PostgreSQL = Postgres
* NodeJS = Node.js
* CI/CD = Continuous Integration and Deployment

### Stage 3: Content Polishing

Handled by AI.

Checks:

* Weak bullets
* Buzzwords
* Missing metrics
* Grammar
* Spelling
* Readability
* Clarity

Must support Google XYZ rewrite.

Never auto-apply AI changes.

User must click Apply.

### Stage 4: Interview Simulator

Handled by AI.

Uses resume projects, skills, and experience to ask realistic interview questions.

Should include:

* Question
* Resume evidence
* Difficulty
* Expected answer points
* Follow-up question
* Optional answer feedback

---

## ATS Issues

Issues must be clickable and expandable.

Every issue must include:

* Title
* Severity
* Category
* Affected section
* Explanation
* Suggested fix
* Score impact

Severity:

* Critical
* High
* Medium
* Low

Groups:

* Content
* Structure
* ATS Essentials
* Formatting
* Spelling
* Grammar
* Layout
* Responsiveness

---

## Page Estimation

Do not estimate pages using only character count.

Use actual rendered layout metrics where possible.

Output:

* Estimated pages
* Confidence level

Examples:

* 1.0
* 1.2
* 1.5
* 2.0

Avoid false warnings when resume visibly fits one page.

---

## Skills Rules

Skills must be normalized and consistently rendered.

Recommended grouping:

* Languages
* Frameworks
* Databases
* Tools
* Cloud
* Soft Skills

Software Developer template:

* No broken skill columns.
* No mixed row/column layout.
* Keep grouping readable.

ATS Friendly template:

* Remove unnecessary skill divider lines.
* Keep ATS-safe structure.

---

## AI Rules

AI should handle:

* Semantic matching
* Bullet rewriting
* Content quality
* Buzzwords
* Interview questions
* Role alignment

Code should handle:

* Contact detection
* Email validation
* Phone validation
* Section existence
* Page estimation
* Layout coordinates
* Storage safety
* PDF rendering

Never trust AI output directly.

Always validate AI JSON.

If AI fails, show:

“AI analysis temporarily unavailable.”

---

## AI Disclaimer

Show at bottom of ATS reports:

AI-powered ATS analysis provides guidance and recommendations based on industry best practices. Results may differ from external ATS platforms, recruiters, or employer-specific screening systems. AI analysis can occasionally make mistakes and should be used as a decision-support tool rather than a guaranteed assessment.

---

## FAQ / Marketing Pages

FAQ and extra UX sections are allowed later.

Do not prioritize them before the core system works.

Core first:

1. Data safety
2. Builder correctness
3. Profile to resume
4. Parser
5. PDF reliability
6. ATS analyzer
7. Link handling
8. Typst preparation

After core is stable, add:

* FAQ
* Landing page polish
* Template showcase
* Compare templates
* Resume examples
* Public roadmap
* Open-source page

---

## Open Source Direction

Forge can be open-source friendly.

Safe to open-source:

* Frontend
* Resume schema
* Parser types
* ATS types
* Template system
* UI components
* Documentation

Never expose:

* Private API keys
* Firebase admin credentials
* Model provider keys
* Production secrets

Add later:

* README.md
* AGENTS.md
* CONTRIBUTING.md
* ROADMAP.md
* LICENSE
* SECURITY.md

---

## Build Order

1. Fix localStorage and account data leakage.
2. Fix profile onboarding to resume generation.
3. Add create from profile / blank resume choice.
4. Normalize resume model.
5. Add section engine and aliases.
6. Add link display mode.
7. Add parser foundation.
8. Add structural ATS scan.
9. Add 4-stage ATS console UI.
10. Add AI keyword matcher.
11. Add AI content polishing.
12. Add interview simulator.
13. Prepare renderer interface for Typst.
14. Improve landing page and FAQ later.

Use this repo with low-token, architecture-first coding.

## Skills
- Use Ponytail only if installed in standalone Codex CLI.
- Use UI UX Pro Max from `.ai/vendor/ui-ux-pro-max-skill` for UI/UX, layouts, dashboards, resume templates, landing pages, and responsive design.
- Do not load the entire UI UX Pro Max folder into context.
- Use only targeted guidance from it.

## Rules
- Inspect files before editing.
- Make minimal safe changes.
- Reuse existing components and styles.
- Do not rewrite unrelated code.
- Do not paste unchanged files.
- Run build/typecheck/lint when available.
