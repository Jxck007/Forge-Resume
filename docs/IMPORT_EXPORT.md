# Import / Export

This document describes the current production-facing import and export behavior for Forge Resume.

## Import status

Resume import is currently a **beta** workflow.

The current app flow is designed around:

- extracting or preparing source content
- sending that content through the import pipeline
- showing a review step
- saving only after the user confirms

## Review-before-save

Imported content is not meant to be silently saved.

Expected behavior:

- the app parses the source
- the user reviews detected sections
- warnings may be shown when extraction is weak or uncertain
- the resume is saved only after confirmation

## Supported import sources

### Paste text

Paste text is the simplest import path.

Use it when:

- you already have resume text copied from another source
- PDF extraction was weak
- you want the most predictable beta import input

### PDF import

Current documented PDF flow:

- local extraction using `pdfjs-dist`
- if selectable text is weak, fallback preparation for image/vision import
- warnings may appear if extraction quality is limited

PDF imports work best when the source PDF contains selectable text.

### DOCX import

Current documented DOCX flow:

- local text extraction using `mammoth`
- extracted content is then structured for review

DOCX often works better than scanned PDFs when the original document is available.

### Image import

Current documented image flow:

- accepted formats: PNG, JPG, JPEG, WEBP
- images may be resized before sending to the import pipeline
- structured output should still be reviewed before saving

Image import quality depends heavily on source clarity.

## Current import constraints

The current beta UI and pipeline are designed with practical limits such as:

- PDF: up to 5 MB
- DOCX: up to 5 MB
- image: up to 4 MB

These limits may evolve during beta.

## Import availability notes

- import is part of the signed-in AI-assisted flow
- guest users should not be documented as having full production import capability
- AI availability and quota status affect whether assisted import can run

## Export status

### Current production export

- **PDF export** is the current production export path

The app uses React PDF to generate a text-based downloadable PDF.

## Planned / not-primary exports

If other export formats appear in menus or placeholders, they should be treated as:

- planned
- disabled
- not yet production-ready

Do not document them as active unless verified in the current app behavior.

## Best practices for users

- review imported names, dates, links, and employers
- verify section ordering and wording before export
- prefer DOCX or pasted text if a scanned PDF imports poorly
- use PDF export only after checking the live preview

## Related docs

- [README](../README.md)
- [AI](./AI.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
