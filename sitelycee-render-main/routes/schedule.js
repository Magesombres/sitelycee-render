const express = require('express');
const router = express.Router();
const Schedule = require ('../models/Schedule');
const ScheduleException = require('../models/ScheduleException');
const { authMiddleware } = require('../middleware/authMiddleware');

function normalizeDateOnly(input) {
  // attend 'YYYY-MM-DD' ou date parsable; normalise à 00:00 locale
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Voir son EDT
router.get('/', authMiddleware, async (req, res) => {
  try {
    const entries = await Schedule.find({ user: req.user.id }).sort({ day: 1, startHour: 1 });
    res.json(entries);
  } catch (e) {
    console.error('GET /schedule error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un cours: accepte weekType 'A' ou 'B' (sinon non défini = toutes semaines)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { day, startHour, endHour, subject, location, color, status, weekType } = req.body;
    if (!day || !startHour || !endHour || !subject) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    if (startHour >= endHour) {
      return res.status(400).json({ error: "L'heure de début doit être avant l'heure de fin" });
    }

    // Couleur par matière si non fournie
    let finalColor = color;
    if (!finalColor) {
      const existing = await Schedule.findOne({
        user: req.user.id, subject, color: { $exists: true, $ne: null }
      }).select('color').lean();
      if (existing?.color) finalColor = existing.color;
    }

    const payload = {
      user: req.user.id,
      day, startHour, endHour, subject, location,
      color: finalColor,
      status,
    };
    if (weekType === 'A' || weekType === 'B') payload.weekType = weekType; // sinon, non défini => A et B

    const entry = new Schedule(payload);
    await entry.save();
    res.status(201).json(entry);
  } catch (e) {
    console.error('POST /schedule error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un cours
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Schedule.deleteOne({ _id: req.params.id, user: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Non trouvé' });
    res.json({ message: 'DELETED' });
  } catch (e) {
    console.error('DELETE /schedule error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour la couleur: applique à toutes les occurrences de la même matière (pour cet utilisateur)
router.patch('/:id/color', authMiddleware, async (req, res) => {
  try {
    const { color } = req.body || {};
    if (!color) return res.status(400).json({ error: 'Couleur manquante' });

    const entry = await Schedule.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!entry) return res.status(404).json({ error: 'Non trouvé' });

    const result = await Schedule.updateMany(
      { user: req.user.id, subject: entry.subject },
      { $set: { color } }
    );
    // Retourne les documents mis à jour (option simple: refetch)
    const updated = await Schedule.find({ user: req.user.id }).sort({ day: 1, startHour: 1 });
    res.json({ updated, matched: result.matchedCount, modified: result.modifiedCount });
  } catch (e) {
    console.error('PATCH /schedule/:id/color error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour l’état d’un cours (au cas par cas)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['normal', 'annule', 'prof_absent'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'État invalide' });

    const updated = await Schedule.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { status } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Non trouvé' });
    res.json(updated);
  } catch (e) {
    console.error('PATCH /schedule/:id/status error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Exceptions de la semaine: GET /schedule/exceptions?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/exceptions', authMiddleware, async (req, res) => {
  try {
    const start = normalizeDateOnly(req.query.start);
    const end = normalizeDateOnly(req.query.end);
    if (!start || !end) return res.status(400).json({ error: 'start/end invalides' });
    const list = await ScheduleException.find({
      user: req.user.id,
      date: { $gte: start, $lte: end }
    }).lean();
    res.json(list);
  } catch (e) {
    console.error('GET /schedule/exceptions error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Poser/modifier l’état d’un cours pour un jour donné
// PATCH /schedule/:id/status-on-date { date: 'YYYY-MM-DD', status: 'annule'|'prof_absent'|'normal' }
router.patch('/:id/status-on-date', authMiddleware, async (req, res) => {
  try {
    const { date, status } = req.body || {};
    const allowed = ['normal', 'annule', 'prof_absent'];
    if (!date || !allowed.includes(status)) return res.status(400).json({ error: 'Données invalides' });

    // Vérifier que le cours appartient à l’utilisateur
    const entry = await Schedule.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!entry) return res.status(404).json({ error: 'Cours introuvable' });

    const d = normalizeDateOnly(date);
    if (!d) return res.status(400).json({ error: 'Date invalide' });

    const updated = await ScheduleException.findOneAndUpdate(
      { user: req.user.id, schedule: entry._id, date: d },
      { $set: { status } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(updated);
  } catch (e) {
    console.error('PATCH /schedule/:id/status-on-date error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;