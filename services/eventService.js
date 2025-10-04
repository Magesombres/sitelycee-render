const Event = require('../models/Event');
const ClubSchedule = require('../models/ClubSchedule');
const User = require('../models/User');
const { normalizeDateOnly } = require('../utils/validation');

async function listEvents({ clubId, from, to, page = 1, limit = 200 }) {
  const q = {};
  if (clubId) q.club = clubId;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = normalizeDateOnly(from);
    if (to) q.date.$lte = normalizeDateOnly(to);
  }
  page = Math.max(1, Number(page)||1);
  limit = Math.min(500, Math.max(1, Number(limit)||100));
  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    Event.find(q)
      .sort({ date: 1, startHour: 1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username role')
      .populate('club', 'clubName day startHour endHour')
      .lean(),
    Event.countDocuments(q)
  ]);
  return { events, total, page, pages: Math.ceil(total / limit) };
}

function buildRecurrence(recurrence) {
  if (!recurrence || !recurrence.frequency) return undefined;
  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval || 1,
    count: recurrence.count,
    until: recurrence.until ? normalizeDateOnly(recurrence.until) : undefined,
    byDay: Array.isArray(recurrence.byDay) ? recurrence.byDay.slice(0,7) : undefined,
  };
}

async function createEvent(data, userId) {
  const { title, date, endDate, startHour, endHour, description, location, color, imageUrl, clubId, recurrence } = data;
  const mainDate = normalizeDateOnly(date);
  if (!mainDate) throw { status: 400, message: 'date invalide' };
  let endDateNorm;
  if (endDate) {
    endDateNorm = normalizeDateOnly(endDate);
    if (!endDateNorm) throw { status: 400, message: 'endDate invalide' };
    if (endDateNorm < mainDate) throw { status: 400, message: 'endDate doit être ≥ date' };
  }
  let club = undefined;
  if (clubId) {
    const exists = await ClubSchedule.findById(clubId).lean();
    if (!exists) throw { status: 404, message: 'Club introuvable' };
    club = exists._id;
  }
  const payload = {
    title,
    date: mainDate,
    endDate: endDateNorm,
    startHour,
    endHour,
    description,
    location,
  color,
  imageUrl,
    club,
    createdBy: userId,
    recurrence: buildRecurrence(recurrence),
  };
  const ev = await Event.create(payload);
  return Event.findById(ev._id)
    .populate('createdBy', 'username role')
    .populate('club', 'clubName day startHour endHour');
}

async function createClubEvent(clubId, data, userId) {
  return createEvent({ ...data, clubId }, userId);
}

async function deleteEvent(id) {
  const del = await Event.findByIdAndDelete(id);
  if (!del) throw { status: 404, message: 'Introuvable' };
  return true;
}

async function subscribe(eventId, userId) {
  const ev = await Event.findById(eventId);
  if (!ev) throw { status: 404, message: 'Événement introuvable' };
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' };
  const idStr = String(ev._id);
  if (!user.subscribedEvents.map(String).includes(idStr)) user.subscribedEvents.push(ev._id);
  if (!ev.subscribers.map(String).includes(userId)) ev.subscribers.push(user._id);
  await user.save();
  await ev.save();
  return { subscribed: true };
}

async function unsubscribe(eventId, userId) {
  const ev = await Event.findById(eventId);
  if (!ev) throw { status: 404, message: 'Événement introuvable' };
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' };
  user.subscribedEvents = (user.subscribedEvents||[]).filter(eid => String(eid)!==String(ev._id));
  ev.subscribers = (ev.subscribers||[]).filter(uid => String(uid)!==String(userId));
  await user.save();
  await ev.save();
  return { subscribed: false };
}

async function pinEvent(eventId, userId) {
  const ev = await Event.findById(eventId);
  if (!ev) throw { status: 404, message: 'Événement introuvable' };
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' };
  if (!user.pinnedEvents.map(String).includes(String(ev._id))) user.pinnedEvents.push(ev._id);
  await user.save();
  return { pinned: true };
}

async function unpinEvent(eventId, userId) {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable' };
  user.pinnedEvents = (user.pinnedEvents||[]).filter(eid => String(eid)!==String(eventId));
  await user.save();
  return { pinned: false };
}

async function updateEvent(id, data, userCtx) {
  const ev = await Event.findById(id);
  if (!ev) throw { status: 404, message: 'Événement introuvable' };
  const isOwner = String(ev.createdBy) === String(userCtx.id);
  const isAdmin = userCtx.role === 'admin';
  if (!isOwner && !isAdmin) throw { status: 403, message: 'Accès refusé' };

  if (data.title !== undefined) ev.title = data.title;
  if (data.description !== undefined) ev.description = data.description || undefined;
  if (data.location !== undefined) ev.location = data.location || undefined;
  if (data.color !== undefined) ev.color = data.color || undefined;
  if (data.imageUrl !== undefined) ev.imageUrl = data.imageUrl || undefined;
  if (data.date !== undefined) {
    const d = normalizeDateOnly(data.date);
    if (!d) throw { status: 400, message: 'date invalide' };
    ev.date = d;
  }
  if (data.endDate !== undefined) {
    if (!data.endDate) ev.endDate = undefined; else {
      const e = normalizeDateOnly(data.endDate);
      if (!e) throw { status: 400, message: 'endDate invalide' };
      if (ev.date && e < ev.date) throw { status: 400, message: 'endDate doit être ≥ date' };
      ev.endDate = e;
    }
  }
  if (data.startHour !== undefined) ev.startHour = data.startHour || undefined;
  if (data.endHour !== undefined) ev.endHour = data.endHour || undefined;
  if (data.clubId !== undefined) {
    if (!data.clubId) ev.club = undefined; else {
      const club = await ClubSchedule.findById(data.clubId).lean();
      if (!club) throw { status: 404, message: 'Club introuvable' };
      ev.club = club._id;
    }
  }
  if (data.recurrence !== undefined) {
    ev.recurrence = buildRecurrence(data.recurrence);
  }
  await ev.save();
  return Event.findById(ev._id)
    .populate('createdBy', 'username role')
    .populate('club', 'clubName day startHour endHour');
}

module.exports = {
  listEvents,
  createEvent,
  createClubEvent,
  deleteEvent,
  subscribe,
  unsubscribe,
  pinEvent,
  unpinEvent,
  updateEvent,
  // test only
  _buildRecurrence: buildRecurrence,
};
