const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ClubSchedule = require('../models/ClubSchedule');
const { authMiddleware, isAdmin, canManageClub } = require('../middleware/authMiddleware');
const sanitizeHtml = require('sanitize-html');
const { clubCreateSchema, clubPatchSchema, availabilityCreateSchema, aideRequestCreateSchema, aideRequestUpdateSchema, weeklySlotCreateSchema, clubCustomizationSchema, zodValidate, DAYS, normalizeDateOnly, emptySchema } = require('../utils/validation');
const svc = require('../services/clubService');
const User = require('../models/User');

// Utils (some helpers still local; date normalization imported)
// legacy helpers retained for endpoints not yet migrated (remove later)
function validTime(t) { return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t); }
function timeLt(a, b) { return a < b; }
function isAideClubName(name) {
  return typeof name === 'string' && name.trim().toLowerCase() === 'aide';
}

function isValidImageUrl(s = '') {
  if (typeof s !== 'string' || !s.trim()) return true; // autoriser vide pour supprimer
  const v = s.trim();
  return /^https?:\/\/.+/i.test(v) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(v);
}
function isUrl(s = '') {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  return /^https?:\/\/.+/i.test(v);
}
function isImgUrl(s = '') {
  if (!s) return true; // facultatif
  return /^https?:\/\/.+/i.test(String(s).trim()) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(String(s).trim());
}
const SANITIZE_OPTS = {
  allowedTags: ['a','p','br','ul','ol','li','strong','em','b','i','u','s','h1','h2','h3','h4','blockquote','code','pre','span','div','img'],
  allowedAttributes: {
    a: ['href','target','rel','title'],
    img: ['src','alt','title','width','height','loading'],
    '*': ['class','style'],
  },
  allowedSchemes: ['http','https','mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener nofollow',
      },
    }),
    img: (tagName, attribs) => ({
      tagName: 'img',
      attribs: {
        ...attribs,
        loading: attribs.loading || 'lazy',
      },
    }),
  },
};

/* === Mise à jour d’un club (gérant/admin) === */
router.patch('/:id', authMiddleware, canManageClub, zodValidate(clubPatchSchema), async (req, res) => {
  try { const club = await svc.updateClub(req.params.id, req.validatedBody); res.json(club); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

// 🌐 Voir tous les clubs
router.get('/', async (req, res) => { const clubs = await svc.listClubs(); res.set('Cache-Control','public, max-age=300'); res.json(clubs); });

// 🌐 Détail club
router.get('/:id', async (req, res) => { try { const c = await svc.getClub(req.params.id); if(!c) return res.status(404).json({ error:'Club introuvable'}); res.set('Cache-Control','public, max-age=120'); res.json(c); } catch { res.status(400).json({ error:'ID invalide'}); } });

// Follow / Unfollow club (auth)
router.post('/:id/follow', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const user = await User.findById(req.user.id); if(!user) return res.status(404).json({ error:'Utilisateur introuvable'}); const r = await svc.followClub(req.params.id, user); res.json(r); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});
router.post('/:id/unfollow', authMiddleware, zodValidate(emptySchema), async (req, res) => {
  try { const user = await User.findById(req.user.id); if(!user) return res.status(404).json({ error:'Utilisateur introuvable'}); const r = await svc.unfollowClub(req.params.id, user); res.json(r); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

// 🔐 Ajouter (admin)
router.post('/', authMiddleware, isAdmin, zodValidate(clubCreateSchema), async (req, res) => {
  try { const club = await svc.createClub(req.validatedBody); res.status(201).json(club); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

// 🗑️ Supprimer (admin)
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => { await svc.deleteClub(req.params.id); res.json({ message:'Club supprimé' }); });

/* === Disponibilités / Cours (gérant/admin) === */
router.post('/:id/availability', authMiddleware, canManageClub, zodValidate(availabilityCreateSchema), async (req, res) => {
  try { const club = await svc.addAvailability(req.params.id, req.validatedBody); res.status(201).json(club); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

router.delete('/:id/availability/:availId', authMiddleware, canManageClub, async (req, res) => {
  try { await svc.removeAvailability(req.params.id, req.params.availId); res.json({ message:'Disponibilité supprimée' }); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

/* === Demandes (élèves) et modération (gérant/admin) === */
router.post('/:id/requests', authMiddleware, zodValidate(aideRequestCreateSchema), async (req, res) => {
  try { await svc.createRequest(req.params.id, req.validatedBody, req.user.id); res.status(201).json({ message:'Demande envoyée' }); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

router.get('/:id/requests', authMiddleware, canManageClub, async (req, res) => {
  try { const out = await svc.listRequests(req.params.id); res.json(out); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

router.patch('/:id/requests/:reqId', authMiddleware, canManageClub, zodValidate(aideRequestUpdateSchema), async (req, res) => {
  try { const status = await svc.updateRequest(req.params.id, req.params.reqId, req.validatedBody.action); res.json({ message:'Statut mis à jour', status }); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

/* === Horaires hebdomadaires (gérant/admin) — pour tous clubs === */
router.post('/:id/weekly-slot', authMiddleware, canManageClub, zodValidate(weeklySlotCreateSchema), async (req, res) => {
  try { const club = await svc.addWeeklySlot(req.params.id, req.validatedBody); res.status(201).json(club); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

router.delete('/:id/weekly-slot/:slotId', authMiddleware, canManageClub, async (req, res) => {
  try { await svc.removeWeeklySlot(req.params.id, req.params.slotId); res.json({ message:'Horaire supprimé' }); }
  catch(e){ res.status(e.status||500).json({ error: e.message||'Erreur serveur' }); }
});

/* === Personnalisation (gérant/admin) === */
// PATCH /clubs/:id/custom — gérant/admin
router.patch('/:id/custom', authMiddleware, canManageClub, zodValidate(clubCustomizationSchema), async (req, res) => {
  try {
    const club = await ClubSchedule.findById(req.params.id);
    if (!club) return res.status(404).json({ error: 'Club introuvable' });
    const { externalLinks, customHtml } = req.validatedBody;
    if (externalLinks !== undefined) {
      const cleaned = externalLinks.map(l => ({
        title: l.title.trim(),
        url: l.url.trim(),
        iconUrl: l.iconUrl ? l.iconUrl.trim() : undefined,
      }));
      club.externalLinks = cleaned;
    }
    if (customHtml !== undefined) {
      club.customHtml = sanitizeHtml(customHtml || '', SANITIZE_OPTS);
    }

    await club.save();
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
