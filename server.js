const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3001;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'testimonials.json');
const MAX_TESTIMONIALS = 100;
const MAX_BODY_SIZE = 1024 * 32;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sanitizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

async function ensureTestimonialsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TESTIMONIALS_FILE);
  } catch {
    await fs.writeFile(TESTIMONIALS_FILE, '[]\n', 'utf8');
  }
}

async function readTestimonials() {
  try {
    const raw = await fs.readFile(TESTIMONIALS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.name && item.message);
  } catch {
    return [];
  }
}

async function writeTestimonials(list) {
  const limited = list.slice(0, MAX_TESTIMONIALS);
  await fs.writeFile(TESTIMONIALS_FILE, `${JSON.stringify(limited, null, 2)}\n`, 'utf8');
}

async function parseJsonBody(req) {
  let raw = '';

  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_SIZE) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      throw error;
    }
  }

  if (!raw) {
    const error = new Error('Empty request body');
    error.statusCode = 400;
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath || '/');
  const normalized = path.posix.normalize(decoded);
  const requestedPath = normalized === '/' ? '/index.html' : normalized;
  const relativePath = requestedPath.replace(/^\/+/, '');

  if (relativePath.includes('..')) {
    return null;
  }

  const absolutePath = path.join(ROOT_DIR, relativePath);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return absolutePath;
}

async function handleApi(req, res, pathname) {
  if (pathname !== '/api/testimonials') return false;

  if (req.method === 'GET') {
    const testimonials = await readTestimonials();
    sendJson(res, 200, testimonials);
    return true;
  }

  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const name = sanitizeText(body.name);
      const message = sanitizeText(body.message);
      const rating = normalizeRating(body.rating);

      if (!name || !message) {
        sendJson(res, 400, { error: 'name and message are required' });
        return true;
      }

      const entry = {
        name: name.slice(0, 60),
        message: message.slice(0, 320),
        rating,
        createdAt: new Date().toISOString()
      };

      const list = await readTestimonials();
      list.unshift(entry);
      await writeTestimonials(list);

      sendJson(res, 201, entry);
      return true;
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error' : error.message;
      sendJson(res, statusCode, { error: message });
      return true;
    }
  }

  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
}

async function handleStatic(req, res, pathname) {
  const absolutePath = resolveStaticPath(pathname);
  if (!absolutePath) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(absolutePath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

async function start() {
  await ensureTestimonialsFile();

  const createServer = () =>
    http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const handled = await handleApi(req, res, url.pathname);
      if (handled) return;

      await handleStatic(req, res, url.pathname);
    });

  const listenWithFallback = (port) =>
    new Promise((resolve, reject) => {
      const server = createServer();

      server.once('error', (error) => {
        if (error && error.code === 'EADDRINUSE') {
          const nextPort = port + 1;
          console.warn(`Porta ${port} ocupada. A tentar ${nextPort}...`);
          resolve(listenWithFallback(nextPort));
          return;
        }

        reject(error);
      });

      server.listen(port, HOST, () => {
        console.log(`Servidor ativo em http://${HOST}:${port}`);
        resolve(server);
      });
    });

  await listenWithFallback(PORT);
}

start().catch((error) => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});
