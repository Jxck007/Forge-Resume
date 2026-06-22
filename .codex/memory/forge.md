# Forge Resume Memory

Forge Resume is ATS-first, AI-assisted resume builder.

Core rules:
- One normalized resume model.
- Builder, Preview, PDF, ATS, Parser, Firebase must share same source of truth.
- Firebase Spark only.
- No Cloud Functions.
- Guest mode must not leak into user account.
- React PDF current renderer.
- Prepare Typst architecture only, do not migrate yet.
- AI is optional and replaceable.

BYOK AI Assist (2026-06-20):
- Gemini, Groq, and Cerebras are integrated through a session-memory-only context.
- Guest AI is blocked; signed-in Builder uses reviewed field-level suggestions only.
- Pasted-text import is BYOK-only; file AI import and ATS remain paused.
- Legacy persisted-key execution is neutralized.
- OpenRouter is supported through the same session-only provider layer; one request may run at a time and provider errors are sanitized.
- Settings saves are creation-safe Firestore merge writes with secret stripping.
- Tours portal outside and inert the app shell; only tour controls remain interactive.
- Provider tests preserve the tested model; Gemini/Groq/Cerebras use provider-specific request payloads.
- Gemini REST uses header authentication and a minimal `contents[].parts[].text` body; Preview no longer exposes Print and keeps PDF as the primary export.
