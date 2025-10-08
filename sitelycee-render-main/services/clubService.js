const ClubSchedule = require('../models/ClubSchedule');
const mongoose = require('mongoose');
const { normalizeDateOnly } = require('../utils/validation');

function isAideClub(club) {
  return (club?.clubName || '').trim().toLowerCase() === 'aide';
}

async function listClubs() { return ClubSchedule.find().lean(); }
async function getClub(id) { return ClubSchedule.findById(id).lean(); }

async function createClub(data) {
  const club = new ClubSchedule(data);
  await club.save();
  return club;
}

async function deleteClub(id) { await ClubSchedule.findByIdAndDelete(id); return true; }

async function updateClub(id, patch) {
  const club = await ClubSchedule.findById(id);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  Object.assign(club, patch);
  await club.save();
  return club;
}

async function addAvailability(id, data) {
  const club = await ClubSchedule.findById(id);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  if (!isAideClub(club)) throw { status: 403, message: 'Fonctionnalité réservée au club "Aide"' };
  const d = normalizeDateOnly(data.date);
  if (!d) throw { status: 400, message: 'date invalide' };
  club.availabilities.push({
    date: d,
    startHour: data.startHour,
    endHour: data.endHour,
    subject: data.subject.trim(),
    teacher: data.teacher.trim(),
    capacity: typeof data.capacity === 'number' ? data.capacity : 1,
    notes: data.notes,
  });
  await club.save();
  return club;
}

async function removeAvailability(clubId, availId) {
  const club = await ClubSchedule.findById(clubId);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  if (!isAideClub(club)) throw { status: 403, message: 'Fonctionnalité réservée au club "Aide"' };
  const avail = club.availabilities.id(availId);
  if (!avail) throw { status: 404, message: 'Disponibilité introuvable' };
  club.requests = (club.requests || []).filter(r => String(r.availabilityId) !== String(avail._id));
  avail.deleteOne();
  await club.save();
  return true;
}

async function listRequests(clubId) {
  const club = await ClubSchedule.findById(clubId)
    .populate('requests.student', 'username')
    .lean();
  if (!club) throw { status: 404, message: 'Club introuvable' };
  if (!isAideClub(club)) throw { status: 403, message: 'Fonctionnalité réservée au club "Aide"' };
  const availById = new Map((club.availabilities || []).map(a => [String(a._id), a]));
  return (club.requests || []).map(r => {
    const a = availById.get(String(r.availabilityId));
    return {
      _id: String(r._id),
      status: r.status,
      note: r.note || '',
      student: r.student ? { id: String(r.student._id || r.student), username: r.student.username } : null,
      availability: a ? {
        _id: String(a._id),
        date: a.date,
        startHour: a.startHour,
        endHour: a.endHour,
        subject: a.subject,
        teacher: a.teacher,
        capacity: a.capacity,
        notes: a.notes || '',
      } : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

async function createRequest(clubId, { availabilityId, note }, userId) {
  const club = await ClubSchedule.findById(clubId);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  if (!isAideClub(club)) throw { status: 403, message: 'Fonctionnalité réservée au club "Aide"' };
  const avail = club.availabilities.id(availabilityId);
  if (!avail) throw { status: 404, message: 'Disponibilité introuvable' };
  const dup = (club.requests || []).find(r => String(r.availabilityId) === String(availabilityId) && String(r.student) === String(userId) && r.status === 'pending');
  if (dup) throw { status: 400, message: 'Demande déjà en attente' };
  club.requests.push({
    student: new mongoose.Types.ObjectId(userId),
    availabilityId: new mongoose.Types.ObjectId(availabilityId),
    note: (note || '').slice(0, 500),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await club.save();
  return true;
}

async function updateRequest(clubId, reqId, action) {
  const club = await ClubSchedule.findById(clubId);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  if (!isAideClub(club)) throw { status: 403, message: 'Fonctionnalité réservée au club "Aide"' };
  const reqSub = club.requests.id(reqId);
  if (!reqSub) throw { status: 404, message: 'Demande introuvable' };
  reqSub.status = action === 'approve' ? 'approved' : 'denied';
  reqSub.updatedAt = new Date();
  await club.save();
  return reqSub.status;
}

async function addWeeklySlot(clubId, data) {
  const club = await ClubSchedule.findById(clubId);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  club.weeklySlots = club.weeklySlots || [];
  club.weeklySlots.push({ day: data.day, startHour: data.startHour, endHour: data.endHour, location: data.location, notes: data.notes });
  await club.save();
  return club;
}

async function removeWeeklySlot(clubId, slotId) {
  const club = await ClubSchedule.findById(clubId);
  if (!club) throw { status: 404, message: 'Club introuvable' };
  const slot = club.weeklySlots.id(slotId);
  if (!slot) throw { status: 404, message: 'Horaire introuvable' };
  slot.deleteOne();
  await club.save();
  return true;
}

async function followClub(clubId, user) {
  const club = await ClubSchedule.findById(clubId).lean();
  if (!club) throw { status: 404, message: 'Club introuvable' };
  const idStr = String(club._id);
  const exists = (user.followingClubs||[]).map(String).includes(idStr);
  if (!exists) { user.followingClubs.push(club._id); await user.save(); }
  return { following: true };
}

async function unfollowClub(clubId, user) {
  user.followingClubs = (user.followingClubs||[]).filter(c => String(c) !== String(clubId));
  await user.save();
  return { following: false };
}

module.exports = {
  listClubs,
  getClub,
  createClub,
  deleteClub,
  updateClub,
  addAvailability,
  removeAvailability,
  listRequests,
  createRequest,
  updateRequest,
  addWeeklySlot,
  removeWeeklySlot,
  followClub,
  unfollowClub,
};
