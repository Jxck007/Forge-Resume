# AI Guide

Forge Resume includes optional AI assistance. The app should still remain usable without AI.

## AI modes

### Forge Free Beta AI

Forge Free Beta AI is the app-managed AI path.

Current documented behavior:

- intended for writing help and import structuring
- availability depends on server configuration
- protected by quota and abuse controls
- may use provider fallback for supported tasks
- requires user review before resume content is saved or applied

Typical uses:

- improve a summary
- rewrite a bullet
- fix grammar
- structure imported resume content

### BYOK AI

BYOK means **Bring Your Own Key**.

Current expectations:

- the user connects a provider through the app UI
- usage remains separate from Forge Free Beta quota
- AI suggestions still require review before apply

## Review-before-apply rule

This is a core product rule:

- AI should not silently overwrite resume content
- AI import results should be reviewed before saving
- AI writing suggestions should be reviewed before applying

## Forge Free Beta quota

Current user-facing limits:

- **25 writing actions per 12 hours**
- **3 resume imports per 12 hours**

These limits exist to reduce abuse and cost spikes during beta.

## Upstash abuse protection

Forge Free Beta AI uses Upstash Redis REST for quota and abuse control.

Current documented protections include:

- device-based limits
- IP-based limits
- global limits
- separate import counters
- cooldown behavior
- reset windows

The app should surface safe, non-secret reason states such as:

- free AI unavailable
- provider keys missing
- quota store not configured
- quota limit reached

## Provider fallback

Current documented provider behavior:

### Writing / text import tasks

Fallback order:

1. Gemini
2. Cerebras
3. Groq

### Image / vision import tasks

- Gemini only

Provider availability may differ by deployment environment.

## Limitations

AI assistance has important limits:

- AI can make mistakes
- AI can miss resume details
- imported structure can still require cleanup
- provider availability can change by environment
- free AI can be disabled or unavailable

## What AI should not be documented as doing

Do **not** describe the current product as:

- a live ATS scoring platform
- a guarantee of recruiter outcomes
- a guarantee of perfect import parsing
- a system that auto-applies resume rewrites without user approval

## Recommended user guidance

When AI is enabled, users should:

- verify names, dates, links, and employers
- confirm bullet wording matches real experience
- check imported sections before saving
- review every applied suggestion

## Related docs

- [README](../README.md)
- [Import / Export](./IMPORT_EXPORT.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
