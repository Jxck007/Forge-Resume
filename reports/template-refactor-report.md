# Forge Resume Template Refactor Report

## Audit Summary

Before this refactor, all 12 templates were rendered from one monolithic document with
template profile switches. Most differences were fonts, colors, borders, entry cards,
and specialty skill treatments rather than distinct information architecture.

The primary duplicate groups were:

- ATS Friendly and Modern Professional
- Corporate Standard, Software Developer, and Data & Metrics
- Academic Student, Startup Growth, and Creative Dynamic
- Executive Boardroom and Classical Editorial

Designer Portfolio was the only materially different layout because it used a sidebar.

The largest sources of vertical waste were project cards, chip/matrix skill groups,
specialty capability indicators, large section reservations, card padding, and
template-specific header treatments. The highest one-page risks were Academic Student,
Software Developer, Startup Growth, Data & Metrics, Creative Dynamic, and Designer
Portfolio.

ATS risks included two-column extraction in Designer Portfolio, visual capability
meters in Data & Metrics, inconsistent skill structures, and structural behavior hidden
inside theme profiles.

## Changed Files

- `src/design-system/resumeSystem.ts`
- `src/schema/resumeSchema.ts`
- `src/components/resume/types.ts`
- `src/components/resume/HeaderBlock.tsx`
- `src/components/resume/ContactRow.tsx`
- `src/components/resume/SummaryBlock.tsx`
- `src/components/resume/SkillsBlock.tsx`
- `src/components/resume/ProjectBlock.tsx`
- `src/components/resume/CertificationBlock.tsx`
- `src/components/resume/ExperienceBlock.tsx`
- `src/components/resume/EducationBlock.tsx`
- `src/components/resume/AchievementBullet.tsx`
- `src/components/ResumePdfDocument.tsx`
- `src/utils/resumeValidator.ts`
- `reports/template-refactor-report.md`

## Architecture

The rendering path is now:

1. Existing `ResumeData`
2. Backward-compatible `normalizeResumeData` projection
3. Shared semantic resume primitives
4. Explicit template-family plan
5. Existing React PDF renderer

No Firestore schema, builder form, persistent resume type, ATS score, or renderer
technology was replaced.

The centralized design system defines typography, spacing, density, link labels, ATS
rules, family membership, layout strategy, and section priority. Templates no longer
own independent skill or project data structures.

## Template-by-Template Summary

| Template | Family | Structural purpose |
| --- | --- | --- |
| ATS Friendly | ATS | Strict linear flow with skills and projects before experience |
| Corporate Standard | ATS | Experience-first enterprise flow with credentials before projects |
| Modern Professional | ATS | Skills-forward recruiter flow with rail entries |
| Academic Student | Student | Education and projects before professional experience |
| Software Developer | Student | Technical skills and projects before experience |
| Executive Boardroom | Business | Experience and leadership impact before supporting sections |
| Startup Growth | Business | Projects and execution evidence before skills and education |
| Data & Metrics | Business | Experience and analytical projects before normalized skills |
| Minimal Elegant | Creative | Dense single-column experience and education flow |
| Classical Editorial | Creative | Editorial experience, education, and project sequence |
| Creative Dynamic | Creative | Portfolio projects lead the document |
| Designer Portfolio | Creative | Only true sidebar layout; portfolio content remains primary |

All template-plan signatures are unique. Designer Portfolio is the only major
two-column exception.

## Removed Waste Patterns

- Removed Data & Metrics capability bars and counts.
- Removed Software Developer technology matrix containers.
- Removed template-specific skill chips as the primary skill architecture.
- Normalized skills to at most five label-value categories.
- Consolidated project technologies and links into one metadata row.
- Consolidated certification issuer and credential into one metadata row.
- Standardized compact contact links with labels instead of raw URLs.
- Reduced section gaps to a maximum 6pt and entry gaps to a maximum 3pt.
- Standardized section headings at 11pt and body copy at 10pt.
- Removed final-section trailing space.

## Page-Fit Results

The validation matrix contains 8 fixture classes across all 12 templates, for 96
render combinations.

| Resolver | Before refactor | After refactor |
| --- | ---: | ---: |
| Single levels 0-3 | 58.3% | 69.8% |
| Force | 60.4% | 71.9% |

Single one-page success increased by 11.5 percentage points, or approximately 19.7%
relative to the pre-refactor fit rate.

The controlled occupied-text-height average decreased from approximately 582.7pt to
545.3pt, a 6.4% reduction. The global height reduction does not reach 20% because the
pre-refactor renderer already used aggressive compact levels. Reaching another 20%
without changing content would require reducing body text below 10pt, suppressing
content, or weakening line-height and pagination safeguards. Those options were
rejected to preserve readability and ATS integrity.

Templates that still risk a second page under long or section-heavy fixtures:

- Executive Boardroom
- Creative Dynamic
- Software Developer
- Academic Student
- Startup Growth
- Designer Portfolio
- Data & Metrics

Every deliberately impossible fixture remains multi-page in all templates instead of
reporting false one-page success.

## ATS Regression Checks

Validation passed for all 12 templates on the balanced fixture:

- Text remained selectable and extractable.
- Name, role, company, institution, project title, dates, and skills were found in PDF
  extraction.
- No raw web URLs were visible.
- Eight expected links were embedded per fixture.
- No duplicate or zero-area annotations were found.
- No horizontal clipping was detected.
- Automatic word hyphenation remained disabled.
- ATS-family templates remained single-column.
- Designer Portfolio remained the only sidebar template.

## Remaining Risks

- Designer Portfolio has inherently less predictable extraction order because of its
  sidebar, although all text remains selectable.
- Very long unbroken email addresses can consume additional width because automatic
  hyphen insertion is intentionally disabled.
- Project descriptions are not truncated; unusually long content can still require
  multiple pages.
- Fit analysis renders every template and remains computationally expensive in the
  browser.
- Legacy visual fields still exist in the internal PDF theme profile while structural
  decisions now come from `resumeTemplatePlans`. They should be removed only after a
  dedicated compatibility pass.

## Recommended Next Steps

1. Add committed fixture-based PDF regression tests around the validator.
2. Capture extraction-order snapshots for Designer Portfolio.
3. Add render timing telemetry for the 12-template fit scan.
4. Remove unused legacy profile layout fields after compatibility testing.
5. Begin Typst evaluation only after the shared schema, primitives, family plans, and
   validator are stable.

The shared design system is sufficient to support a later Typst migration because
content normalization, layout intent, semantic primitives, and validation rules are no
longer coupled to template-specific React PDF branches.
