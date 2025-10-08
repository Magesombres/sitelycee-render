const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const [, token] = h.split(' ');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const payload = jwt.verify(token, secret);
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      managerClubs: payload.managerClubs || [],
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function isAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé aux admins' });
  next();
}

// Autorise si admin OU si le club demandé est dans managerClubs
function canManageClub(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role === 'admin') return next();
  const clubId = req.params.clubId || req.params.id || req.body.clubId;
  if (!clubId) return res.status(400).json({ error: 'clubId requis' });
  const ok = (req.user.managerClubs || []).includes(String(clubId));
  if (!ok) return res.status(403).json({ error: 'Accès club refusé' });
  next();
}

module.exports = { authMiddleware, isAdmin, canManageClub };
