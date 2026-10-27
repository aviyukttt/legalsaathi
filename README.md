# Legal Sathi

> Understand your legal documents in minutes.

Legal Sathi is a calm, plain-language document assistant for a first read of everyday legal PDFs. Upload a text-based PDF, choose an output language, and receive a structured brief with a summary, key points, document type, and clauses worth a closer look.

## Highlights

- Plain-language analysis designed for non-specialists
- Multilingual output: English, Hindi, Tamil, Telugu, Kannada, Bengali, and Marathi
- Structured results: summary, key points, document type, and red flags
- Secure same-origin browser-to-server flow; provider credentials stay server-side
- In-memory document processing with no document or result persistence
- Responsive editorial interface designed to feel clear rather than intimidating
- Health endpoint for deployment checks and a committed Dockerfile for reproducible builds

## Important notice

Legal Sathi is an informational document assistant, not a lawyer, law firm, or substitute for professional legal advice. Its output can be incomplete or incorrect. Do not rely on it alone for legal decisions, deadlines, filings, or disputes; consult a qualified legal professional when the stakes are meaningful.

## Quick start

### Requirements

- Node.js 20 or newer
- A Manus-compatible runtime with `MANUS_API_URL` and `MANUS_API_KEY` available to the server

### Install and run

```bash
npm ci
npm start
```

The app listens on `PORT` when provided, otherwise `3000`.

### Docker

```bash
docker build -t legal-saathi .
docker run --rm -p 3000:3000 \
  -e MANUS_API_URL="$MANUS_API_URL" \
  -e MANUS_API_KEY="$MANUS_API_KEY" \
  legal-saathi
```

Open `http://localhost:3000` after the server starts. The health check is available at `/_app/health`.

## Privacy and processing

PDFs are accepted up to 12 MB, parsed in memory, and discarded after the request. The browser never receives the AI provider credentials. Image-only PDFs are not OCR'd; upload a selectable-text PDF for reliable extraction.

## Project structure

| Path | Purpose |
| --- | --- |
| `public/index.html` | Responsive Legal Sathi interface |
| `public/manus-routes.json` | Route manifest |
| `server.js` | Static server, upload handling, PDF extraction, and AI request |
| `Dockerfile` | Production container definition |
| `package.json` | Runtime metadata and start script |

## Design direction

Legal Sathi uses an editorial legal-utility approach: warm paper neutrals, deep leaf green (`#1C5C3B`), restrained hierarchy, and scan-friendly result sections. The product voice is clear, reassuring, and practical.

## Status

The project is an actively evolving prototype. Review `TODO.md` for known follow-up work before using it in a production legal workflow.
