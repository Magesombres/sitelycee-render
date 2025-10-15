const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  console.log('[DEBUG AUTH] authMiddleware appelé pour', req.method, req.url);
  try {
    const h = req.headers.authorization || '';
    console.log('[DEBUG AUTH] Authorization header:', h ? `Bearer ${h.substring(7, 20)}...` : 'ABSENT');
    const [, token] = h.split(' ');
    if (!token) {
      console.log('[DEBUG AUTH] Token manquant, retour 401');
      return res.status(401).json({ error: 'Token manquant' });
    }

    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const payload = jwt.verify(token, secret);
    console.log('[DEBUG AUTH] Token vérifié, payload.id:', payload.id);
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      managerClubs: payload.managerClubs || [],
    };
    console.log('[DEBUG AUTH] req.user défini:', JSON.stringify(req.user));
    next();
  } catch (err) {
    console.log('[DEBUG AUTH] Erreur JWT:', err.message);
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
