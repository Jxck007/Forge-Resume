# ATS Intelligence migration

## Modules

- `core`: canonical modes, statuses, issues, reports, and orchestration contracts.
- `local-readability`: deterministic contact, section, parseability, PDF text, link, page, and layout checks.
- `ai-job-match`: provider-required, job-description-required semantic matching and content analysis.
- `suggestions`: evidence classification and truthful recommendation lifecycle.
- `patch-engine`: previewed, user-approved, reversible normalized-resume patches.
- `report-export`: versioned local/cloud report serialization without UI state.
- `ui`: future route shell consuming only canonical ATS reports.

## Migration order

1. Keep `/ats` and legacy reports operational.
2. Introduce canonical contracts and adapt the existing structural engine.
3. Move validated AI job matching behind `ai-job-match`.
4. Adapt the current suggestion and patch utilities.
5. Point the existing route at one canonical report.
6. Migrate persisted reports by schema version.
7. Remove legacy scores, duplicate diagnostics, and adapters only after validation.

## Scoring boundary

Local readability is not a full ATS score. App/dashboard/mobile/tablet responsiveness never affects it.
AI Job Match has a score only after a configured provider successfully analyzes a target job description.
