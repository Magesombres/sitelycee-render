// Centralized error & notFound handlers + small helper utilities
// This keeps consistent JSON structure for errors

function notFound(req, res, next) {
  res.status(404).json({ error: 'Route introuvable' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return; // avoid double send
  const status = err.status || 500;
  const payload = {
    error: err.publicMessage || err.message || 'Erreur serveur',
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
    if (err.details) payload.details = err.details; // validation details
  }
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
