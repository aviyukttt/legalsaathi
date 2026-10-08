const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const pdfParse = require('pdf-parse');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  bn: 'Bengali',
  mr: 'Marathi'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function safeFilePath(urlPath) {
  const requested = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, requested);
  return resolved.startsWith(PUBLIC_DIR + path.sep) ? resolved : null;
}

function serveStatic(req, res) {
  const filePath = safeFilePath(new URL(req.url, 'http://localhost').pathname);
  if (!filePath) return sendText(res, 404, 'Not found');
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, err.code === 'ENOENT' ? 404 : 500, err.code === 'ENOENT' ? 'Not found' : 'Unable to read file');
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600' });
    res.end(data);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        reject(Object.assign(new Error('PDF is too large. Please upload a file under 12 MB.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(body, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) throw Object.assign(new Error('The upload form was not received correctly.'), { status: 400 });
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const fields = {};
  let file = null;
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(boundary, cursor);
    if (start < 0) break;
    const partStart = start + boundary.length;
    if (body.slice(partStart, partStart + 2).toString() === '--') break;
    const headersStart = partStart + 2;
    const headersEnd = body.indexOf(Buffer.from('\r\n\r\n'), headersStart);
    if (headersEnd < 0) break;
    const headers = body.slice(headersStart, headersEnd).toString('utf8');
    const contentStart = headersEnd + 4;
    const nextBoundary = body.indexOf(boundary, contentStart);
    if (nextBoundary < 0) break;
    const contentEnd = nextBoundary - 2;
    const disposition = /content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headers);
    if (disposition) {
      const name = disposition[1];
      const filename = disposition[2];
      const content = body.slice(contentStart, Math.max(contentStart, contentEnd));
      if (filename !== undefined) file = { filename: path.basename(filename), content };
      else fields[name] = content.toString('utf8').trim();
    }
    cursor = nextBoundary;
  }
  return { fields, file };
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI returned an unreadable analysis. Please try again.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateAnalysis(value, language) {
  const result = {
    document_type: typeof value.document_type === 'string' ? value.document_type.trim() : 'Legal document',
    summary: typeof value.summary === 'string' ? value.summary.trim() : '',
    key_points: Array.isArray(value.key_points) ? value.key_points.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 8) : [],
    red_flags: Array.isArray(value.red_flags) ? value.red_flags.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 8) : []
  };
  if (!result.summary || result.key_points.length === 0) throw new Error('The AI returned an incomplete analysis. Please try again.');
  return { ...result, language };
}

async function analyzeDocument(pdfBuffer, languageCode) {
  const parsed = await pdfParse(pdfBuffer);
  const text = String(parsed.text || '').replace(/\s+/g, ' ').trim();
  if (text.length < 80) throw Object.assign(new Error('This PDF has too little selectable text. Image-only scans need OCR before they can be analyzed.'), { status: 422 });

  const language = LANGUAGES[languageCode] || LANGUAGES.en;
  const prompt = `You are LegalSaathi, a careful legal-document explainer for people in India. Analyze the document below and return ONLY valid JSON with exactly these keys: document_type (string), summary (3-5 plain-language sentences), key_points (array of 4-7 concise strings), red_flags (array of risky or unusual clauses with a short reason, or an empty array). Write every value in ${language}. Use simple language suitable for a Class 8 reader. Do not invent facts and do not give a definitive legal opinion. Add a brief practical caution inside the summary when the document is ambiguous.\n\nDocument text:\n${text.slice(0, 18000)}`;
  const apiUrl = process.env.MANUS_API_URL;
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiUrl || !apiKey) throw new Error('The Manus AI service is not available in this environment.');

  const requestBody = {
    messages: [
      { role: 'system', content: 'Return only valid JSON. Never wrap the JSON in Markdown fences.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  };
  if (process.env.MANUS_MODEL) requestBody.model = process.env.MANUS_MODEL;

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message || 'The Manus AI service could not analyze this document.');
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('The Manus AI service returned no analysis. Please try again.');
  return validateAnalysis(extractJson(content), language);
}

async function handleAnalyze(req, res) {
  try {
    const body = await readRequestBody(req);
    const { fields, file } = parseMultipart(body, req.headers['content-type']);
    if (!file || !file.content.length) throw Object.assign(new Error('Please choose a PDF file first.'), { status: 400 });
    if (!/\.pdf$/i.test(file.filename) && req.headers['content-type']?.toLowerCase().includes('application/pdf') === false) {
      throw Object.assign(new Error('Only PDF files are supported.'), { status: 415 });
    }
    const result = await analyzeDocument(file.content, fields.lang || 'en');
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    const status = Number(error.status) || 502;
    sendJson(res, status >= 400 && status < 600 ? status : 502, { ok: false, error: error.message || 'Unable to analyze this document.' });
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/_app/health') return sendJson(res, 200, { ok: true, service: 'legalsaathi' });
  if (requestUrl.pathname === '/api/analyze' && req.method === 'POST') return handleAnalyze(req, res);
  if (requestUrl.pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'API route not found.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => console.log(`LegalSaathi listening on ${HOST}:${PORT}`));
