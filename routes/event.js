const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const ClubSchedule = require('../models/ClubSchedule'); // FIX: needed for /events/club route
const { authMiddleware, isAdmin, canManageClub } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { baseEventSchema, zodValidate, normalizeDateOnly, emptySchema } = require('../utils/validation');
const { baseEventPatchSchema } = require('../utils/validation');
const svc = require('../services/eventService');

// GET /events?clubId=... (ou tous)
router.get('/', async (req, res) => {
  try {
    const { clubId, from, to, page, limit } = req.query;
    const result = await svc.listEvents({ clubId, from, to, page, limit });
    // Basic caching headers for list endpoints
    res.set('Cache-Control', 'public, max-age=60');
    res.json(result);
  } catch (e) {
    console.error('GET /events error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /events (admin pour général; si clubId fourni, admin OU gérant du club)
router.post('/', authMiddleware, zodValidate(baseEventSchema), async (req, res, next) => {
  const { clubId } = req.body || {};
  if (clubId) return canManageClub(req, res, next);
  return isAdmin(req, res, next);
}, async (req, res) => {
  try {
  const ev = await svc.createEvent(req.validatedBody, req.user.id);
  res.status(201).json(ev);
  } catch (e) {
    console.error('POST /events error:', e);
  res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' });
  }
});

// POST /events/club/:clubId (admin ou gérant du club)
router.post('/club/:clubId', authMiddleware, canManageClub, zodValidate(baseEventSchema), async (req, res) => {
  try {
    const { clubId } = req.params;
    const club = await ClubSchedule.findById(clubId);
    if (!club) return res.status(404).json({ error: 'Club introuvable' });
  const ev = await svc.createClubEvent(club._id, req.validatedBody, req.user.id);
  res.status(201).json(ev);
  } catch (e) {
    console.error('POST /events/club/:clubId error:', e);
  res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' });
  }
});

// DELETE /events/:id (admin)
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    await svc.deleteEvent(req.params.id);
    res.json({ message: 'Événement supprimé' });
  } catch (e) {
    console.error('DELETE /events/:id error:', e);
    res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' });
  }
});

module.exports = router;

// Subscribe / Unsubscribe to event
router.post('/:id/subscribe', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const r = await svc.subscribe(req.params.id, req.user.id); res.json(r); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' }); }
});
router.post('/:id/unsubscribe', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const r = await svc.unsubscribe(req.params.id, req.user.id); res.json(r); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' }); }
});

// Pin / Unpin (ajouter à l'emploi du temps personnel)
router.post('/:id/pin', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const r = await svc.pinEvent(req.params.id, req.user.id); res.json(r); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' }); }
});
router.post('/:id/unpin', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const r = await svc.unpinEvent(req.params.id, req.user.id); res.json(r); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' }); }
});

// Update event (owner or admin)
router.patch('/:id', authMiddleware, zodValidate(baseEventPatchSchema), async (req, res) => {
  try {
    const updated = await svc.updateEvent(req.params.id, req.validatedBody, req.user);
    res.json(updated);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur serveur' });
  }
});
