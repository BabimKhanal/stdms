/**
 * Maps an enrolment record to the field catalog used by document templates.
 * Keeping this in one place means every generated document resolves fields
 * consistently, including previews.
 */

export type DocumentStudent = {
  fullName: string;
  studentId: string;
  admissionNumber?: string | null;
  rollNumber?: number | string | null;
  className?: string | null;
  sectionName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  academicYearId?: string | null;
  history?: { yearName?: string | null }[];
  guardians?: {
    fullName: string;
    relationship: string;
    phone?: string | null;
    email?: string | null;
    isPrimary?: boolean | null;
  }[];
};

export type DocumentOrganisation = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

export type DocumentAcademicSummary = {
  examName?: string;
  result?: string;
  totalMarks?: string;
  obtainedMarks?: string;
  grade?: string;
  gpa?: string;
  percentage?: string;
  rank?: string;
  attendance?: string;
  remarks?: string;
};

function verificationBase() {
  return (process.env.PUBLIC_WEB_URL ?? "https://stdms.onrender.com").replace(/\/$/, "");
}

function today() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function displayDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function buildDocumentData(
  student: DocumentStudent,
  organisation: DocumentOrganisation | undefined,
  academic?: DocumentAcademicSummary,
): Record<string, string> {
  const guardians = student.guardians ?? [];
  const findGuardian = (pattern: RegExp) => guardians.find((guardian) => pattern.test(guardian.relationship));
  const father = findGuardian(/father|papa|dad/i);
  const mother = findGuardian(/mother|mama|mom/i);
  const primary = guardians.find((guardian) => guardian.isPrimary) ?? guardians[0];
  const session = student.history?.[0]?.yearName ?? "";
  return {
    fullName: student.fullName,
    studentId: student.studentId,
    admissionNumber: student.admissionNumber ?? "",
    rollNumber: student.rollNumber == null ? "" : String(student.rollNumber),
    className: student.className ?? "",
    sectionName: student.sectionName ?? "",
    dateOfBirth: displayDate(student.dateOfBirth),
    gender: student.gender ?? "",
    bloodGroup: student.bloodGroup ?? "",
    nationality: student.nationality ?? "",
    address: student.address ?? organisation?.address ?? "",
    phone: student.phone ?? primary?.phone ?? "",
    email: student.email ?? organisation?.email ?? "",
    guardianName: primary?.fullName ?? "",
    fatherName: father?.fullName ?? "",
    motherName: mother?.fullName ?? "",
    academicYear: session,
    session,
    issueDate: today(),
    grade: academic?.grade ?? "",
    gpa: academic?.gpa ?? "",
    percentage: academic?.percentage ?? "",
    rank: academic?.rank ?? "",
    attendance: academic?.attendance ?? "",
    examName: academic?.examName ?? "",
    result: academic?.result ?? "",
    totalMarks: academic?.totalMarks ?? "",
    obtainedMarks: academic?.obtainedMarks ?? "",
    remarks: academic?.remarks ?? "",
    principal: "Principal",
    schoolName: organisation?.name ?? "",
    schoolAddress: organisation?.address ?? "",
    schoolPhone: organisation?.phone ?? "",
    schoolEmail: organisation?.email ?? "",
    photoUrl: student.photoUrl ?? "",
    qrCode: `${verificationBase()}/verify/${encodeURIComponent(student.studentId)}`,
  };
}
