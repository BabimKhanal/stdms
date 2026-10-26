import { z } from "zod";
import { dateSchema, idSchema, monthSchema } from "./common";
import {
  ATTENDANCE_STATUSES,
  HOMEWORK_STATUSES,
  LEAVE_APPLICANTS,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  NOTICE_PRIORITIES,
} from "../constants";

/* ---------------- Attendance (attendance_records) ---------------- */

export const attendanceRecordSchema = z.object({
  id: idSchema,
  studentId: idSchema,
  studentName: z.string().optional(),
  studentCode: z.string().optional(),
  classId: z.uuid().nullable(),
  sectionId: z.uuid().nullable(),
  date: dateSchema,
  periodId: z.uuid().nullable(),
  status: z.enum(ATTENDANCE_STATUSES),
  markedBy: z.uuid().nullable(),
  remarks: z.string().nullable(),
});
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

/** Teacher marks a whole class in one request. */
export const markAttendanceSchema = z.object({
  sectionId: idSchema,
  date: dateSchema,
  periodId: z.uuid().nullable().optional(),
  records: z
    .array(
      z.object({
        studentId: idSchema,
        status: z.enum(ATTENDANCE_STATUSES),
        remarks: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const attendanceListQuerySchema = z.object({
  sectionId: z.uuid().optional(),
  classId: z.uuid().optional(),
  studentId: z.uuid().optional(),
  date: dateSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  month: monthSchema.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
});
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;

export const attendanceSummarySchema = z.object({
  studentId: idSchema,
  studentName: z.string(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  leave: z.number(),
  excused: z.number(),
  total: z.number(),
  percentage: z.number(),
});
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>;

/* ---------------- Leave ---------------- */

export const leaveRequestSchema = z.object({
  id: idSchema,
  applicantType: z.enum(LEAVE_APPLICANTS),
  studentId: z.uuid().nullable(),
  employeeId: z.uuid().nullable(),
  applicantName: z.string().optional(),
  type: z.enum(LEAVE_TYPES),
  customType: z.string().nullable(),
  reason: z.string(),
  fromDate: dateSchema,
  toDate: dateSchema,
  status: z.enum(LEAVE_STATUSES),
  reviewedBy: z.uuid().nullable(),
  reviewedAt: z.string().nullable(),
  reviewComment: z.string().nullable(),
  createdAt: z.string(),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const leaveInputSchema = z.object({
  applicantType: z.enum(LEAVE_APPLICANTS),
  studentId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
  type: z.enum(LEAVE_TYPES),
  customType: z.string().trim().max(60).nullable().optional(),
  reason: z.string().trim().min(3).max(500),
  fromDate: dateSchema,
  toDate: dateSchema,
});
export type LeaveInput = z.infer<typeof leaveInputSchema>;

export const leaveReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewComment: z.string().trim().max(300).nullable().optional(),
});

/* ---------------- Homework ---------------- */

export const homeworkSchema = z.object({
  id: idSchema,
  classId: idSchema,
  sectionId: idSchema,
  subjectId: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  assignedDate: dateSchema,
  submissionDate: dateSchema.nullable(),
  attachmentUrl: z.string().nullable(),
  attachmentUrls: z.array(z.string()).optional(),
  link: z.string().nullable(),
  maxMarks: z.number().nullable(),
  className: z.string().optional(),
  sectionName: z.string().optional(),
  subjectName: z.string().optional(),
  teacherName: z.string().nullable().optional(),
  submissionCount: z.number().optional(),
});
export type Homework = z.infer<typeof homeworkSchema>;

const homeworkInputFields = {
  classId: idSchema,
  sectionId: idSchema,
  subjectId: idSchema,
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  assignedDate: dateSchema,
  submissionDate: dateSchema.nullable().optional(),
  attachmentUrl: z.string().max(500).nullable().optional(),
  attachmentUrls: z.array(z.string().max(500)).max(20).optional(),
  link: z.string().max(300).nullable().optional(),
  maxMarks: z.number().min(0).max(1000).nullable().optional(),
};
export const homeworkInputSchema = z.object(homeworkInputFields).superRefine((value, context) => {
  if (value.submissionDate && value.submissionDate < value.assignedDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['submissionDate'], message: 'Due date cannot be before the assigned date' });
  }
});
export const homeworkUpdateSchema = z.object(homeworkInputFields).partial();
export type HomeworkInput = z.infer<typeof homeworkInputSchema>;

export const homeworkSubmissionSchema = z.object({
  id: idSchema,
  homeworkId: idSchema,
  studentId: idSchema,
  studentName: z.string().optional(),
  content: z.string().nullable(),
  fileUrl: z.string().nullable(),
  status: z.enum(HOMEWORK_STATUSES),
  marks: z.number().nullable(),
  feedback: z.string().nullable(),
  submittedAt: z.string().nullable(),
});
export type HomeworkSubmission = z.infer<typeof homeworkSubmissionSchema>;

export const homeworkSubmitInputSchema = z.object({
  content: z.string().trim().max(3000).nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
});

export const gradeSubmissionSchema = z.object({
  marks: z.number().min(0),
  feedback: z.string().trim().max(500).nullable().optional(),
  status: z.enum(HOMEWORK_STATUSES).default("reviewed"),
});

/* ---------------- Notices ---------------- */

export const noticeSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  attachmentUrl: z.string().nullable(),
  priority: z.enum(NOTICE_PRIORITIES),
  publishAt: z.string(),
  expireAt: z.string().nullable(),
  authorName: z.string().nullable(),
  audiences: z.array(z.string()),
  readByMe: z.boolean().optional(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeInputSchema = z.object({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(3).max(5000),
  imageUrl: z.string().max(500).nullable().optional(),
  attachmentUrl: z.string().max(500).nullable().optional(),
  priority: z.enum(NOTICE_PRIORITIES).default("normal"),
  publishAt: z.string().optional(),
  expireAt: z.string().nullable().optional(),
  /** e.g. ["everyone"], ["parents"], ["class:uuid"], ["section:uuid"] */
  audiences: z.array(z.string()).min(1),
});
export type NoticeInput = z.infer<typeof noticeInputSchema>;

/* ---------------- Events / calendar ---------------- */

export const eventSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  venue: z.string().nullable(),
  imageUrl: z.string().nullable(),
  audiences: z.array(z.string()),
});
export type CalendarEvent = z.infer<typeof eventSchema>;

export const eventInputSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  venue: z.string().trim().max(150).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  audiences: z.array(z.string()).min(1).default(["everyone"]),
});
