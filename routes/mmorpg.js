const express = require('express');
const router = express.Router();
const Guild = require('../models/Guild');
const City = require('../models/City');
const Character = require('../models/Character');
const { authMiddleware } = require('../middleware/authMiddleware'); // fix backslash

// Créer/mettre à jour le perso
router.post('/character', authMiddleware, async (req, res) => {
  try {
    const name = (req.body?.name || '').trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    let ch = await Character.findOne({ user: req.user.id });
    if (!ch) ch = new Character({ user: req.user.id, name });
    else ch.name = name;
    await ch.save();
    res.json(ch);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Infos joueur (perso + guilde + ville)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const ch = await Character.findOne({ user: req.user.id })
      .populate({ path: 'guild', populate: { path: 'city' } });
    res.json(ch || null);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une guilde
router.post('/guilds', authMiddleware, async (req, res) => {
  try {
    const name = (req.body?.name || '').trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: 'Nom requis' });

    let ch = await Character.findOne({ user: req.user.id });
    if (!ch) return res.status(400).json({ error: 'Créez d’abord votre personnage' });
    if (ch.guild) return res.status(400).json({ error: 'Déjà dans une guilde' });

    const exists = await Guild.findOne({ name });
    if (exists) return res.status(400).json({ error: 'Nom déjà pris' });

    const guild = await Guild.create({ name, owner: req.user.id, members: [req.user.id] });
    const city = await City.create({ guild: guild._id, name: `Village ${name}`, level: 1 });
    guild.city = city._id; await guild.save();

    ch.guild = guild._id;
    ch.zone = `city:${guild._id.toString()}`;
    ch.x = 10; ch.y = 10; await ch.save();

    const populated = await Guild.findById(guild._id).populate('city');
    res.status(201).json({ guild: populated });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rejoindre une guilde
router.post('/guilds/:id/join', authMiddleware, async (req, res) => {
  try {
    let ch = await Character.findOne({ user: req.user.id });
    if (!ch) return res.status(400).json({ error: 'Créez d’abord votre personnage' });
    if (ch.guild) return res.status(400).json({ error: 'Déjà dans une guilde' });

    const guild = await Guild.findById(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guilde introuvable' });

    await Guild.updateOne({ _id: guild._id }, { $addToSet: { members: req.user.id } });
    ch.guild = guild._id;
    ch.zone = `city:${guild._id.toString()}`;
    ch.x = 10; ch.y = 10;
    await ch.save();

    const populated = await Guild.findById(guild._id).populate('city');
    res.json({ guild: populated });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Quitter sa guilde
router.post('/guilds/leave', authMiddleware, async (req, res) => {
  try {
    const ch = await Character.findOne({ user: req.user.id });
    if (!ch?.guild) return res.status(400).json({ error: 'Pas de guilde' });

    const guild = await Guild.findById(ch.guild);
    if (!guild) {
      ch.guild = undefined; await ch.save();
      return res.json({ ok: true });
    }

    await Guild.updateOne({ _id: guild._id }, { $pull: { members: req.user.id } });
    if (String(guild.owner) === req.user.id) {
      // Si propriétaire part: garder la guilde mais définir le 1er membre comme owner si dispo
      const nextOwner = (guild.members || []).find((m) => String(m) !== String(req.user.id));
      if (nextOwner) {
        guild.owner = nextOwner;
        await guild.save();
      }
    }
    ch.guild = undefined;
    ch.zone = 'plaine'; ch.x = 10; ch.y = 10;
    await ch.save();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lister les guildes (simple)
router.get('/guilds', authMiddleware, async (req, res) => {
  try {
    const list = await Guild.find().select('name owner members').lean();
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer la ville de la guilde (si absente)
router.post('/cities/create', authMiddleware, async (req, res) => {
  try {
    const ch = await Character.findOne({ user: req.user.id }).populate('guild');
    if (!ch?.guild) return res.status(400).json({ error: 'Rejoignez une guilde' });

    const guild = await Guild.findById(ch.guild._id).populate('city');
    if (guild.city) return res.status(200).json({ city: guild.city, created: false });

    const city = await City.create({
      guild: guild._id,
      name: `Village ${guild.name}`,
      level: 1,
      resources: { wood: 0, stone: 0, food: 0 },
      buildings: [{ key: 'townhall', level: 1 }],
    });
    guild.city = city._id;
    await guild.save();

    const populated = await City.findById(city._id).lean();
    res.status(201).json({ city: populated, created: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;