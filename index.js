const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorHandler');
const path = require('path');

const app = express();
// Trust reverse proxy headers in production (needed on PaaS for correct protocol/host)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
// Core middlewares
// Allow same-origin (including Render domain) and dev origins; set CORS_ALLOW_ALL=1 to allow all
const allowAll = String(process.env.CORS_ALLOW_ALL || '').toLowerCase() === '1';
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.get('host');
  // Prefer forwarded proto on PaaS
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const sameOrigin = !!origin && origin.replace(/\/$/, '') === `${proto}://${host}`;

  const isLocal = !!origin && (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(origin) ||
    /^https?:\/\/192\.168\./.test(origin) ||
    /^https?:\/\/10\./.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./.test(origin)
  );
  const isTunnel = !!origin && (
    /^https?:\/\/.+\.ngrok(-free)?\.app$/i.test(origin) ||
    /^https?:\/\/.+\.trycloudflare\.com$/i.test(origin)
  );

  const shouldAllow = allowAll || !origin || sameOrigin || isLocal || isTunnel;
  return cors({
    origin: (_o, cb) => cb(null, shouldAllow),
    credentials: true,
  })(req, res, next);
});
app.use(express.json({ limit: '1mb' }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
// Structured logging (skip tests)
if (process.env.NODE_ENV !== 'test') {
  app.use(pinoHttp({
    redact: ['req.headers.authorization'],
    autoLogging: { ignore: (req) => req.url === '/health' },
    level: process.env.LOG_LEVEL || 'info',
  }));
}

// Basic rate limiting (can be tuned via env)
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);

// (morgan replaced by pino-http)

// Healthcheck simple
app.get('/health', (req, res) => res.json({ ok: true }));

// Import des routes
app.use('/auth', require('./routes/auth'));
app.use('/schedule', require('./routes/schedule'));
app.use('/clubs', require('./routes/club'));
app.use('/events', require('./routes/event'));
app.use('/user', require('./routes/user'));
app.use('/admin', require('./routes/admin'));
app.use('/mmorpg', require('./routes/mmorpg'));
app.use('/chat', require('./routes/chat'));
app.use('/pixco', require('./routes/pixco'));
console.log('[DEBUG] Chargement routes Hangman...');
const hangmanRouter = require('./routes/hangman');
console.log(`[DEBUG] Routes Hangman chargées: ${hangmanRouter.stack ? hangmanRouter.stack.length : 'ERREUR'} routes`);
hangmanRouter.stack.forEach((r, i) => {
  const method = r.route.stack[0].method.toUpperCase();
  const path = r.route.path;
  console.log(`[DEBUG]   ${i+1}. ${method} /hangman${path}`);
});
app.use('/hangman', hangmanRouter);
// Static approved uploads only
app.use('/uploads/approved', express.static(path.join(__dirname, 'uploads', 'approved')));
// Media API
app.use('/media', require('./routes/media'));

// Dynamic sitemap to avoid hardcoding the domain
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = [
    '/',
    '/events',
    '/clubs',
    '/chat',
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map(u => `\n  <url><loc>${base}${u}</loc></url>`).join('') +
    `\n</urlset>`;
  res.type('application/xml').send(body);
});

// --- Compatibility redirect for old client bundle names (cached index.html) ---
// Some older builds referenced main.28a49edc.js; redirect it to the current bundle
app.get('/static/js/main.28a49edc.js', (req, res) => {
  res.redirect(302, '/static/js/main.ac669778.js');
});

// ---- Serve React build (single-origin setup) ----
// In production or when a build exists, serve the client build from the server
const clientBuild = path.join(__dirname, 'public');
app.use(express.static(clientBuild, {
  // Allow fallthrough so React Router can handle unknown routes
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
// Catch-all: let React Router handle unknown routes (SPA fallback)
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

// === Socket.IO server ===
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: (origin, cb) => cb(null, true) } });
// expose io on app for routes to use
app.set('io', io);
require('./realtime/tictactoe')(io);
require('./realtime/mmorpg')(io);
require('./realtime/chat')(io);
require('./realtime/pixco')(io);
require('./realtime/hangman')(io);

// Helper: listen with automatic fallback if the port is taken (unless PORT is explicitly set)
async function listenWithFallback(startPort) {
  return new Promise((resolve, reject) => {
    let desired = Number(startPort) || 5000;
    const isFixed = !!process.env.PORT; // If user set PORT, don't auto-advance

    const tryListen = () => {
      server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && !isFixed) {
          console.warn(`Port ${desired} occupé, tentative sur ${desired + 1}...`);
          desired += 1;
          // Remove the listener and retry
          setImmediate(tryListen);
        } else {
          reject(err);
        }
      });
      server.once('listening', () => {
        // Remove any residual error listeners to avoid memory leaks
        server.removeAllListeners('error');
        resolve(desired);
      });
      server.listen(desired, () => {
        // The 'listening' event above will resolve
      });
    };

    tryListen();
  });
}

// Configure MongoDB connection from environment with sensible defaults and good error messages
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/sitelyee';
// const PORT = process.env.PORT || 10000;
const START_PORT = Number(process.env.PORT) || 10000;
console.log('DEBUG: process.env.PORT =', process.env.PORT, '; using start port =', START_PORT);

// Validate required env vars in production
if (process.env.NODE_ENV === 'production' && !process.env.MONGO_URI) {
  console.error('FATAL: MONGO_URI is not set. Please configure the MONGO_URI environment variable on Render.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connecté');
    try {
      const actualPort = await listenWithFallback(START_PORT);
      console.log(`Serveur démarré sur le port ${actualPort}`);
    } catch (err) {
      console.error('Erreur lors du démarrage du serveur:', err);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Erreur MongoDB:', err);
    process.exit(1);
  });

