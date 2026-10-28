import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { EXAM_TYPES } from "../constants";

export const examSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: z.enum(EXAM_TYPES),
  termId: z.uuid().nullable(),
  termName: z.string().nullable().optional(),
  academicYearId: z.uuid(),
  startDate: dateSchema.nullable(),
  endDate: dateSchema.nullable(),
  status: z.enum(["draft", "ongoing", "completed", "published"]),
  subjectCount: z.number().optional(),
});
export type Exam = z.infer<typeof examSchema>;

export const examInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(EXAM_TYPES),
  termId: z.uuid().nullable().optional(),
  academicYearId: idSchema,
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  status: z.enum(["draft", "ongoing", "completed", "published"]).default("draft"),
});

export const examSubjectSchema = z.object({
  id: idSchema,
  examId: idSchema,
  classId: idSchema,
  subjectId: idSchema,
  className: z.string().optional(),
  subjectName: z.string().optional(),
  fullMarks: z.number(),
  passMarks: z.number(),
  theoryMarks: z.number().nullable(),
  practicalMarks: z.number().nullable(),
  internalMarks: z.number().nullable(),
});
export type ExamSubject = z.infer<typeof examSubjectSchema>;

export const examSubjectInputSchema = z.object({
  classId: idSchema,
  subjectId: idSchema,
  fullMarks: z.number().min(1).default(100),
  passMarks: z.number().min(1).default(35),
  theoryMarks: z.number().min(0).nullable().optional(),
  practicalMarks: z.number().min(0).nullable().optional(),
  internalMarks: z.number().min(0).nullable().optional(),
});

export const markEntrySchema = z.object({
  examSubjectId: idSchema,
  marks: z
    .array(
      z.object({
        studentId: idSchema,
        marksObtained: z.number().min(0).nullable(),
        remarks: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type MarkEntryInput = z.infer<typeof markEntrySchema>;

export const markSchema = z.object({
  id: idSchema,
  studentId: idSchema,
  examSubjectId: idSchema,
  marksObtained: z.number().nullable(),
  isAbsent: z.boolean(),
  remarks: z.string().nullable(),
});
export type Mark = z.infer<typeof markSchema>;

export const gradingScaleBandSchema = z.object({
  id: idSchema,
  gradingScaleId: idSchema,
  minPercent: z.number(),
  maxPercent: z.number(),
  grade: z.string(),
  gpa: z.number(),
  remark: z.string().nullable(),
});
export type GradingScaleBand = z.infer<typeof gradingScaleBandSchema>;

export const gradingScaleSchema = z.object({
  id: idSchema,
  name: z.string(),
  isDefault: z.boolean(),
  bands: z.array(gradingScaleBandSchema),
});
export type GradingScale = z.infer<typeof gradingScaleSchema>;

export const gradingScaleInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  isDefault: z.boolean().optional(),
  bands: z
    .array(
      z.object({
        minPercent: z.number().min(0).max(100),
        maxPercent: z.number().min(0).max(100),
        grade: z.string().trim().min(1).max(10),
        gpa: z.number().min(0).max(4),
        remark: z.string().trim().max(60).nullable().optional(),
      }),
    )
    .min(1),
});
export type GradingScaleInput = z.infer<typeof gradingScaleInputSchema>;

export const resultRowSchema = z.object({
  studentId: idSchema,
  studentName: z.string(),
  rollNumber: z.number().nullable(),
  className: z.string().nullable(),
  sectionName: z.string().nullable(),
  subjects: z.array(
    z.object({
      examSubjectId: idSchema,
      subjectName: z.string(),
      fullMarks: z.number(),
      passMarks: z.number(),
      marksObtained: z.number().nullable(),
      isAbsent: z.boolean(),
      grade: z.string().nullable(),
      gpa: z.number().nullable(),
      passed: z.boolean(),
    }),
  ),
  totalObtained: z.number(),
  totalFull: z.number(),
  percentage: z.number(),
  gpa: z.number().nullable(),
  grade: z.string().nullable(),
  rank: z.number().nullable(),
  sectionRank: z.number().nullable().optional(),
  passed: z.boolean(),
});
export type ResultRow = z.infer<typeof resultRowSchema>;

export const resultQuerySchema = z.object({
  examId: idSchema,
  classId: z.uuid().optional(),
  sectionId: z.uuid().optional(),
});
