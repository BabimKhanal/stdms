import { z } from "zod";
import { dateSchema, idSchema, paginationQuerySchema } from "./common";
import { ACADEMIC_TYPES, WEEK_DAYS } from "../constants";

/* ---------------- Academic year & term ---------------- */

export const academicYearSchema = z.object({
  id: idSchema,
  name: z.string(),
  startDate: dateSchema,
  endDate: dateSchema,
  isCurrent: z.boolean(),
});
export type AcademicYear = z.infer<typeof academicYearSchema>;

export const academicYearInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  startDate: dateSchema,
  endDate: dateSchema,
  isCurrent: z.boolean().default(false),
});
export type AcademicYearInput = z.infer<typeof academicYearInputSchema>;

export const termSchema = z.object({
  id: idSchema,
  academicYearId: idSchema,
  name: z.string(),
  startDate: dateSchema,
  endDate: dateSchema,
});
export type Term = z.infer<typeof termSchema>;

export const termInputSchema = z.object({
  academicYearId: idSchema,
  name: z.string().trim().min(1).max(60),
  startDate: dateSchema,
  endDate: dateSchema,
});
export type TermInput = z.infer<typeof termInputSchema>;

/* ---------------- Class / section / subject ---------------- */

export const classSchema = z.object({
  id: idSchema,
  name: z.string(),
  numericLevel: z.number().nullable(),
  classTeacherId: z.uuid().nullable(),
  classTeacherName: z.string().nullable().optional(),
  studentCount: z.number().optional(),
});
export type ClassRecord = z.infer<typeof classSchema>;

export const classInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  numericLevel: z.number().int().min(0).max(30).nullable().optional(),
  classTeacherId: z.uuid().nullable().optional(),
});
export type ClassInput = z.infer<typeof classInputSchema>;

export const sectionSchema = z.object({
  id: idSchema,
  classId: idSchema,
  name: z.string(),
  classTeacherId: z.uuid().nullable(),
  classTeacherName: z.string().nullable().optional(),
  studentCount: z.number().optional(),
});
export type Section = z.infer<typeof sectionSchema>;

export const sectionInputSchema = z.object({
  classId: idSchema,
  name: z.string().trim().min(1).max(30),
  classTeacherId: z.uuid().nullable().optional(),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

export const subjectSchema = z.object({
  id: idSchema,
  code: z.string().nullable(),
  name: z.string(),
  type: z.enum(["theory", "practical", "both"]),
  creditHours: z.number().nullable(),
});
export type Subject = z.infer<typeof subjectSchema>;

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().max(20).nullable().optional(),
  type: z.enum(["theory", "practical", "both"]).default("theory"),
  creditHours: z.number().min(0).max(10).nullable().optional(),
});
export type SubjectInput = z.infer<typeof subjectInputSchema>;

export const classSubjectSchema = z.object({
  id: idSchema,
  classId: idSchema,
  subjectId: idSchema,
  teacherId: z.uuid().nullable(),
  teacherName: z.string().nullable().optional(),
  subjectName: z.string().optional(),
});
export type ClassSubject = z.infer<typeof classSubjectSchema>;

export const classSubjectInputSchema = z.object({
  classId: idSchema,
  subjectId: idSchema,
  teacherId: z.uuid().nullable().optional(),
});
export type ClassSubjectInput = z.infer<typeof classSubjectInputSchema>;

/* ---------------- Timetable ---------------- */

export const timetablePeriodSchema = z.object({
  id: idSchema,
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  isBreak: z.boolean(),
  orderIndex: z.number(),
});
export type TimetablePeriod = z.infer<typeof timetablePeriodSchema>;

export const timetablePeriodInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isBreak: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
});
export type TimetablePeriodInput = z.infer<typeof timetablePeriodInputSchema>;

export const timetableSlotSchema = z.object({
  id: idSchema,
  sectionId: idSchema,
  day: z.enum(WEEK_DAYS),
  periodId: idSchema,
  subjectId: idSchema,
  teacherId: z.uuid().nullable(),
  room: z.string().nullable(),
  subjectName: z.string().optional(),
  teacherName: z.string().nullable().optional(),
  periodName: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});
export type TimetableSlot = z.infer<typeof timetableSlotSchema>;

export const timetableSlotInputSchema = z.object({
  sectionId: idSchema,
  day: z.enum(WEEK_DAYS),
  periodId: idSchema,
  subjectId: idSchema,
  teacherId: z.uuid().nullable().optional(),
  room: z.string().trim().max(30).nullable().optional(),
});
export type TimetableSlotInput = z.infer<typeof timetableSlotInputSchema>;

/* ---------------- Organisation profile ---------------- */

export const organisationSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  academicType: z.enum(ACADEMIC_TYPES),
  country: z.string(),
  currency: z.string(),
  timezone: z.string(),
  dateFormat: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  status: z.enum(["active", "suspended", "trial"]),
  plan: z.string(),
  maxStudents: z.number(),
  maxUsers: z.number(),
  maxStorageMb: z.number(),
  features: z.array(z.string()),
  currentAcademicYearId: z.uuid().nullable(),
});
export type Organisation = z.infer<typeof organisationSchema>;

export const organisationInputSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  registrationNumber: z.string().trim().max(60).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  website: z.string().trim().max(150).nullable().optional(),
  academicType: z.enum(ACADEMIC_TYPES).default("school"),
  country: z.string().trim().max(60).default("Nepal"),
  currency: z.string().trim().max(10).default("NPR"),
  timezone: z.string().trim().max(60).default("Asia/Kathmandu"),
  dateFormat: z.string().trim().max(20).default("YYYY-MM-DD"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
});
export type OrganisationInput = z.infer<typeof organisationInputSchema>;

export const academicSetupSchema = paginationQuerySchema.partial().optional();
