const { z } = require('zod');

/* =====================
 * Password
 * ===================== */
const passwordSchema = z.string().min(8)
  .regex(/[A-Z]/, 'Une majuscule requise')
  .regex(/[a-z]/, 'Une minuscule requise')
  .regex(/[0-9]/, 'Un chiffre requis')
  .regex(/[^A-Za-z0-9]/, 'Un caractère spécial requis');

function validatePassword(pw){
  const r = passwordSchema.safeParse(pw);
  if (!r.success) return r.error.issues[0].message;
  return null;
}

/* =====================
 * Shared date / time helpers
 * ===================== */
function normalizeDateOnly(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0,0,0,0);
  return d;
}

const timeRegex = /^\d{2}:\d{2}$/;
const timeStringSchema = z.string().regex(timeRegex, 'Format heure HH:mm');

const optionalTimeRange = z.object({
  startHour: timeStringSchema.optional(),
  endHour: timeStringSchema.optional()
}).refine(v => {
  if (v.startHour && v.endHour) return v.startHour < v.endHour; // lexicographic OK for HH:mm
  return true;
}, { message: "L'heure de début doit être avant l'heure de fin" });

/* =====================
 * Recurrence schema (metadata only for now)
 * ===================== */
// Accept either full datetime (ISO) or simple date-only YYYY-MM-DD for recurrence.until
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Format date attendu YYYY-MM-DD');
const recurrenceSchema = z.object({
  frequency: z.enum(['DAILY','WEEKLY','MONTHLY','YEARLY']),
  interval: z.number().int().min(1).max(52).default(1).optional(),
  count: z.number().int().min(1).max(500).optional(),
  until: z.union([dateOnlySchema, z.string().datetime()]).optional(), // accept date-only or datetime
  byDay: z.array(z.enum(['MO','TU','WE','TH','FR','SA','SU'])).min(1).max(7).optional(),
}).strict();

/* =====================
 * Event create/update schemas
 * ===================== */
// Define a core object first so we can reuse it for both full and partial variants
const baseEventCore = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  location: z.string().max(512).optional().nullable(),
  color: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/).optional(),
  imageUrl: z.string().url().max(2048).optional().or(z.literal('').transform(()=>undefined)),
  date: z.string(), // validated & normalized later
  endDate: z.string().optional(),
  startHour: timeStringSchema.optional(),
  endHour: timeStringSchema.optional(),
  clubId: z.string().optional(),
  recurrence: recurrenceSchema.partial({ interval:true, count:true, until:true, byDay:true }).optional(),
});

const baseEventSchema = baseEventCore.superRefine((val, ctx) => {
  if (val.startHour && val.endHour && !(val.startHour < val.endHour)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path: ['endHour'] });
  }
});

// For PATCH, make all fields optional but keep the same time ordering guard
const baseEventPatchSchema = baseEventCore.partial().superRefine((val, ctx) => {
  if (val.startHour && val.endHour && !(val.startHour < val.endHour)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path: ['endHour'] });
  }
});

/* =====================
 * Club create / patch schemas
 * ===================== */
const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const dayEnumSchema = z.enum(['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']);

const clubCreateSchema = z.object({
  clubName: z.string().min(1).max(120),
  day: dayEnumSchema,
  startHour: timeStringSchema,
  endHour: timeStringSchema,
  location: z.string().max(512).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
}).superRefine((val, ctx) => {
  if (!(val.startHour < val.endHour)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path:['endHour'] });
  }
});

const clubPatchSchema = z.object({
  bgImageUrl: z.string().url().max(2048).optional().or(z.literal('').transform(()=>undefined)),
  day: dayEnumSchema.optional(),
  startHour: timeStringSchema.optional(),
  endHour: timeStringSchema.optional(),
  location: z.string().max(512).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.startHour && val.endHour && !(val.startHour < val.endHour)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path:['endHour'] });
  }
});

/* =====================
 * Aide club availability & requests
 * ===================== */
const availabilityCreateSchema = z.object({
  date: z.string(),
  startHour: timeStringSchema,
  endHour: timeStringSchema,
  subject: z.string().min(1).max(200),
  teacher: z.string().min(1).max(120),
  capacity: z.number().int().min(1).max(500).optional(),
  notes: z.string().max(1000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (!(v.startHour < v.endHour)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path:['endHour'] });
});

const aideRequestCreateSchema = z.object({
  availabilityId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

const aideRequestUpdateSchema = z.object({
  action: z.enum(['approve','deny']),
});

/* =====================
 * Weekly slot schema
 * ===================== */
const weeklySlotCreateSchema = z.object({
  day: dayEnumSchema,
  startHour: timeStringSchema,
  endHour: timeStringSchema,
  location: z.string().max(512).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (!(v.startHour < v.endHour)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "L'heure de début doit être avant l'heure de fin", path:['endHour'] });
});

/* =====================
 * Club customization
 * ===================== */
const externalLinkSchema = z.object({
  title: z.string().min(1).max(80),
  url: z.string().url().max(1024),
  iconUrl: z.string().url().max(1024).optional().or(z.literal('').transform(()=>undefined)),
});
const clubCustomizationSchema = z.object({
  externalLinks: z.array(externalLinkSchema).max(12).optional(),
  customHtml: z.string().max(20000).optional().nullable(),
});

// Empty body schema (strict) for endpoints expecting no payload
const emptySchema = z.object({}).strict();

/* =====================
 * Middleware factory
 * ===================== */
function zodValidate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    req.validatedBody = parsed.data;
    next();
  };
}

module.exports = {
  // password
  passwordSchema,
  validatePassword,
  // time/date helpers
  normalizeDateOnly,
  timeStringSchema,
  // schemas
  baseEventSchema,
  baseEventPatchSchema,
  clubCreateSchema,
  clubPatchSchema,
  recurrenceSchema,
  availabilityCreateSchema,
  aideRequestCreateSchema,
  aideRequestUpdateSchema,
  weeklySlotCreateSchema,
  clubCustomizationSchema,
  emptySchema,
  // middleware
  zodValidate,
  // constants
  DAYS,
};