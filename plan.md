# LegalSaathi implementation plan

## Product scope
LegalSaathi is a single-page document assistant that preserves the supplied interface and demo experience. Users upload a PDF, choose an output language, and receive a plain-language summary, key points, document type, and red flags. The browser never receives or asks for Gemini, Google Translate, or Manus server credentials.

## Implementation approach
- Keep the supplied HTML/CSS visual language and responsive layout in `public/index.html`.
- Add a small Node.js HTTP server in `server.js` with `POST /api/analyze` and unauthenticated `GET /_app/health`.
- Accept a bounded multipart PDF upload, parse text with `pdf-parse`, and call the Manus OpenAI-compatible LLM endpoint from the server using `MANUS_API_URL` and `MANUS_API_KEY` supplied by the managed runtime.
- Ask the selected Manus model to return strict JSON-shaped legal analysis directly in the requested language, avoiding a separate translation provider and avoiding browser-exposed credentials.
- Serve the static page and `public/manus-routes.json` from the same server so Preview and production use the same origin and relative browser requests.
- Publish as a container with a committed Dockerfile; use Node 22, install the locked dependency set, honor `PORT`, and expose the health endpoint.

## Design decisions
- **Design movement:** editorial legal utility — a calm, print-inspired interface rather than a generic AI dashboard.
- **Core principles:** approachable language, restrained hierarchy, visible trust boundaries, and scan-friendly results.
- **Color philosophy:** warm paper neutrals reduce intimidation; deep green signals guidance and action; amber and red are reserved for warnings.
- **Layout paradigm:** centered reading column with an upload moment, then a vertical legal brief with clear section breaks; no dense dashboard grid.
- **Signature elements:** Instrument Serif editorial headlines, green document-analysis accents, and compact uppercase metadata labels.
- **Interaction philosophy:** one obvious upload action, immediate file confirmation, a single analysis action, and a readable result stack. Loading and errors stay in context.
- **Animation:** subtle button press, drag-over accent, and smooth result reveal; no distracting motion.
- **Typography system:** Instrument Serif for editorial headings and Inter for controls/body copy.
- **Brand essence:** LegalSaathi turns intimidating documents into a plain-language first read for everyday people; calm, practical, human.
- **Brand voice:** clear and reassuring. Example lines: “Understand your legal documents in minutes.” and “See the clauses worth a closer look.”
- **Wordmark & logo:** `LegalSaathi` in the serif wordmark paired with a compact “Legal Simplifier” label.
- **Signature brand color:** deep leaf green `#1C5C3B`.

## Project structure
- `public/index.html` — supplied LegalSaathi UI, updated to call the secure backend.
- `public/manus-routes.json` — the complete page route manifest.
- `server.js` — static serving, upload parsing, PDF text extraction, Manus AI request, validation, and health endpoint.
- `package.json` / `package-lock.json` — pinned runtime dependency and start script.
- `Dockerfile` — reproducible production image and entrypoint.
- `app.config.ts` — platform project logo metadata.
- `TODO.md` — acceptance outcomes tracked during delivery.

## Material constraints
- The app does not persist documents or analysis results; uploaded PDFs are processed in memory and discarded after the request.
- The AI service is Manus-managed and uses project-provided runtime credentials. No user-supplied API key is required.
- PDF extraction requires selectable text in the uploaded document. The server returns a clear recovery message for image-only scans rather than claiming OCR support it does not provide.
