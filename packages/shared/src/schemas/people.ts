import { z } from "zod";
import { idSchema, dateSchema, uuidQuery, enumQuery } from "./common";
import { EMPLOYEE_STATUSES, EMPLOYEE_TYPES, EMPLOYMENT_TYPES, STUDENT_STATUSES } from "../constants";

/* ---------------- Student ---------------- */

export const studentSchema = z.object({
  id: idSchema,
  studentId: z.string(),
  admissionNumber: z.string().nullable(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  fullName: z.string(),
  photoUrl: z.string().nullable(),
  dateOfBirth: dateSchema.nullable(),
  gender: z.enum(["male", "female", "other"]),
  bloodGroup: z.string().nullable(),
  nationality: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  admissionDate: dateSchema.nullable(),
  academicYearId: z.uuid().nullable(),
  classId: z.uuid().nullable(),
  sectionId: z.uuid().nullable(),
  className: z.string().nullable().optional(),
  sectionName: z.string().nullable().optional(),
  rollNumber: z.number().nullable(),
  status: z.enum(STUDENT_STATUSES),
});
export type Student = z.infer<typeof studentSchema>;

export const studentInputSchema = z.object({
  studentId: z.string().trim().min(1).max(30),
  admissionNumber: z.string().trim().max(30).nullable().optional(),
  firstName: z.string().trim().min(1).max(60),
  middleName: z.string().trim().max(60).nullable().optional(),
  lastName: z.string().trim().min(1).max(60),
  photoUrl: z.string().max(500).nullable().optional(),
  dateOfBirth: dateSchema.nullable().optional(),
  gender: z.enum(["male", "female", "other"]),
  bloodGroup: z.string().trim().max(5).nullable().optional(),
  nationality: z.string().trim().max(60).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  admissionDate: dateSchema.nullable().optional(),
  academicYearId: z.uuid().nullable().optional(),
  classId: z.uuid().nullable().optional(),
  sectionId: z.uuid().nullable().optional(),
  rollNumber: z.number().int().min(0).nullable().optional(),
  status: z.enum(STUDENT_STATUSES).default("active"),
});
export type StudentInput = z.infer<typeof studentInputSchema>;

export const studentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().max(200).optional(),
  classId: uuidQuery,
  sectionId: uuidQuery,
  status: enumQuery(STUDENT_STATUSES),
  sort: z.enum(["firstName", "lastName", "rollNumber", "admissionDate", "createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

/* ---------------- Guardian ---------------- */

export const guardianSchema = z.object({
  id: idSchema,
  fullName: z.string(),
  relationship: z.enum(["father", "mother", "guardian", "emergency"]),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  occupation: z.string().nullable(),
  photoUrl: z.string().nullable(),
  isPrimary: z.boolean(),
  hasLogin: z.boolean().optional(),
  children: z
    .array(z.object({ studentId: idSchema, fullName: z.string(), className: z.string().nullable() }))
    .optional(),
});
export type Guardian = z.infer<typeof guardianSchema>;

export const guardianInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  relationship: z.enum(["father", "mother", "guardian", "emergency"]),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  occupation: z.string().trim().max(100).nullable().optional(),
  photoUrl: z.string().max(500).nullable().optional(),
  isPrimary: z.boolean().default(false),
  /** Set when creating a login account for this guardian. */
  password: z.string().min(8).max(200).optional(),
});
export type GuardianInput = z.infer<typeof guardianInputSchema>;

export const linkGuardianSchema = z.object({
  studentId: idSchema,
  guardianId: idSchema,
  isPrimary: z.boolean().default(false),
});

/* ---------------- Employee ---------------- */

export const employeeSchema = z.object({
  id: idSchema,
  employeeId: z.string(),
  fullName: z.string(),
  photoUrl: z.string().nullable(),
  department: z.string().nullable(),
  designation: z.string().nullable(),
  joiningDate: dateSchema.nullable(),
  qualification: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  emergencyContact: z.string().nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  staffType: z.enum(EMPLOYEE_TYPES),
  salary: z.number().nullable(),
  status: z.enum(EMPLOYEE_STATUSES),
  isClassTeacher: z.boolean().optional(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const employeeInputSchema = z.object({
  employeeId: z.string().trim().min(1).max(30),
  fullName: z.string().trim().min(2).max(120),
  photoUrl: z.string().max(500).nullable().optional(),
  department: z.string().trim().max(80).nullable().optional(),
  designation: z.string().trim().max(80).nullable().optional(),
  joiningDate: dateSchema.nullable().optional(),
  qualification: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  emergencyContact: z.string().trim().max(30).nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  staffType: z.enum(EMPLOYEE_TYPES).default("teaching"),
  salary: z.number().min(0).nullable().optional(),
  status: z.enum(EMPLOYEE_STATUSES).default("active"),
  password: z.string().min(8).max(200).optional(),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

/* ---------------- User / roles ---------------- */

export const roleSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  userCount: z.number().optional(),
});
export type Role = z.infer<typeof roleSchema>;

export const roleInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).nullable().optional(),
  permissions: z.array(z.string()).default([]),
  /** Clone an existing system role instead of starting empty. */
  copyFrom: z.string().optional(),
});

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  roles: z.array(z.string()),
  employeeId: z.uuid().nullable(),
  studentId: z.uuid().nullable(),
  lastLoginAt: z.string().nullable(),
  status: z.enum(["active", "disabled"]),
});
export type User = z.infer<typeof userSchema>;

export const userInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().nullable().optional(),
  username: z.string().trim().min(3).max(60).nullable().optional(),
  password: z.string().min(8).max(200),
  roleKeys: z.array(z.string()).min(1),
  employeeId: z.uuid().nullable().optional(),
  studentId: z.uuid().nullable().optional(),
});
