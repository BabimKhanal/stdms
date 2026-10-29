/**
 * Document designer model.
 *
 * A template is a fixed-size page plus absolutely positioned elements. The same
 * model is consumed by the visual builder (web) and the print renderer (api), so
 * stored templates always render the way they were designed.
 */

export const DOCUMENT_TYPES = [
  "identity_card",
  "transcript",
  "marksheet",
  "certificate",
  "custom",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  identity_card: "Identity card",
  transcript: "Transcript",
  marksheet: "Marksheet",
  certificate: "Certificate",
  custom: "Other document",
};

export const TEMPLATE_ELEMENT_TYPES = [
  "text",
  "field",
  "image",
  "photo",
  "qr",
  "shape",
  "line",
  "table",
] as const;

export type TemplateElementType = (typeof TEMPLATE_ELEMENT_TYPES)[number];

export type TemplateTextAlign = "left" | "center" | "right";
export type TemplateVerticalAlign = "top" | "middle" | "bottom";

export type TemplateElementStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  color?: string;
  align?: TemplateTextAlign;
  verticalAlign?: TemplateVerticalAlign;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
  underline?: boolean;
};

export type TemplateTableColumn = {
  key: string;
  label: string;
  width: number;
  align?: TemplateTextAlign;
};

export type TemplateTableConfig = {
  columns: TemplateTableColumn[];
  source?: "subjects" | "static";
  rows?: string[][];
  headerBackground?: string;
  headerColor?: string;
  zebra?: boolean;
  rowHeight?: number;
  fontSize?: number;
};

export type TemplateElement = {
  id: string;
  type: TemplateElementType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  hidden?: boolean;
  locked?: boolean;
  text?: string;
  field?: string;
  src?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "double" | "none";
  table?: TemplateTableConfig;
  style?: TemplateElementStyle;
};

export type TemplatePage = {
  width: number;
  height: number;
  background: string;
};

export type TemplateDesignMeta = {
  category?: string;
  tags?: string[];
  description?: string;
};

/** Version 2 is the canvas model. Version 1 (flat theme object) is legacy. */
export type TemplateDesign = {
  version: 2;
  page: TemplatePage;
  elements: TemplateElement[];
  meta?: TemplateDesignMeta;
};

export type DocumentTemplateRecord = {
  id: string;
  name: string;
  documentType: DocumentType;
  design: TemplateDesign | Record<string, unknown>;
  isDefault: number;
};

/** Page presets in CSS pixels at 96dpi. */
export const PAGE_PRESETS = {
  "a4-portrait": { label: "A4 portrait", width: 794, height: 1123 },
  "a4-landscape": { label: "A4 landscape", width: 1123, height: 794 },
  "letter-portrait": { label: "Letter portrait", width: 816, height: 1056 },
  "id-landscape": { label: "ID card landscape", width: 1012, height: 638 },
  "id-portrait": { label: "ID card portrait", width: 638, height: 1012 },
  "square": { label: "Square", width: 900, height: 900 },
} as const;

export type PagePresetKey = keyof typeof PAGE_PRESETS;

export const PAGE_PRESET_KEYS = Object.keys(PAGE_PRESETS) as PagePresetKey[];

export type DocumentFieldKey =
  | "fullName"
  | "studentId"
  | "admissionNumber"
  | "rollNumber"
  | "className"
  | "sectionName"
  | "dateOfBirth"
  | "gender"
  | "bloodGroup"
  | "nationality"
  | "address"
  | "phone"
  | "email"
  | "guardianName"
  | "fatherName"
  | "motherName"
  | "academicYear"
  | "session"
  | "issueDate"
  | "grade"
  | "gpa"
  | "percentage"
  | "rank"
  | "attendance"
  | "examName"
  | "result"
  | "totalMarks"
  | "obtainedMarks"
  | "remarks"
  | "principal"
  | "schoolName"
  | "schoolAddress"
  | "schoolPhone"
  | "schoolEmail"
  | "photoUrl"
  | "qrCode";

export const DOCUMENT_FIELD_LABELS: Record<DocumentFieldKey, string> = {
  fullName: "Student name",
  studentId: "Student ID",
  admissionNumber: "Admission number",
  rollNumber: "Roll number",
  className: "Class / program",
  sectionName: "Section",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  bloodGroup: "Blood group",
  nationality: "Nationality",
  address: "Address",
  phone: "Phone",
  email: "Email",
  guardianName: "Guardian name",
  fatherName: "Father name",
  motherName: "Mother name",
  academicYear: "Academic year",
  session: "Session",
  issueDate: "Issue date",
  grade: "Grade",
  gpa: "GPA",
  percentage: "Percentage",
  rank: "Rank",
  attendance: "Attendance",
  examName: "Exam name",
  result: "Result",
  totalMarks: "Total marks",
  obtainedMarks: "Obtained marks",
  remarks: "Remarks",
  principal: "Principal",
  schoolName: "Institution name",
  schoolAddress: "Institution address",
  schoolPhone: "Institution phone",
  schoolEmail: "Institution email",
  photoUrl: "Student photo",
  qrCode: "Verification QR",
};

export const DOCUMENT_FIELD_GROUPS: {
  label: string;
  fields: DocumentFieldKey[];
}[] = [
  {
    label: "Student",
    fields: [
      "fullName",
      "studentId",
      "admissionNumber",
      "rollNumber",
      "className",
      "sectionName",
      "dateOfBirth",
      "gender",
      "bloodGroup",
      "nationality",
      "address",
      "phone",
      "email",
    ],
  },
  {
    label: "Family",
    fields: ["guardianName", "fatherName", "motherName"],
  },
  {
    label: "Academics",
    fields: [
      "academicYear",
      "session",
      "examName",
      "grade",
      "gpa",
      "percentage",
      "rank",
      "attendance",
      "totalMarks",
      "obtainedMarks",
      "result",
      "remarks",
    ],
  },
  {
    label: "Institution",
    fields: ["schoolName", "schoolAddress", "schoolPhone", "schoolEmail", "principal"],
  },
  {
    label: "Media",
    fields: ["photoUrl", "qrCode", "issueDate"],
  },
];

export const DOCUMENT_FIELDS = DOCUMENT_FIELD_GROUPS.flatMap((group) => group.fields);

/** Sample values used by the visual builder and template preview. */
export const DOCUMENT_SAMPLE_VALUES: Record<DocumentFieldKey, string> = {
  fullName: "Aarav Sharma",
  studentId: "ST-1001",
  admissionNumber: "ADM-173/16",
  rollNumber: "12",
  className: "Grade 6",
  sectionName: "A",
  dateOfBirth: "20 Jun 2014",
  gender: "Male",
  bloodGroup: "O+",
  nationality: "Nepali",
  address: "Lakeside-6, Pokhara, Kaski, Nepal",
  phone: "+977 98123 45678",
  email: "aarav.sharma@example.edu.np",
  guardianName: "Rafael Sharma",
  fatherName: "Rafael Sharma",
  motherName: "Maria Sharma",
  academicYear: "2026-2027",
  session: "2026-27",
  issueDate: "28 Oct 2026",
  grade: "A",
  gpa: "3.80",
  percentage: "86.5%",
  rank: "04",
  attendance: "94%",
  examName: "Second Term Examination",
  result: "Passed",
  totalMarks: "650",
  obtainedMarks: "562",
  remarks: "Promoted with distinction",
  principal: "Dr. Meera Karki",
  schoolName: "Shree Sunshine School",
  schoolAddress: "Lakeside-6, Pokhara, Kaski, Nepal",
  schoolPhone: "+977-61-456789",
  schoolEmail: "info@shreesunshine.edu.np",
  photoUrl: "",
  qrCode: "https://stdms.onrender.com/verify/ST-1001",
};

export const HEALTHY_TEMPLATE_NAME = /^[\p{L}\p{N} .,'&()\/_-]+$/u;

export function isTemplateDesign(value: unknown): value is TemplateDesign {
  if (!value || typeof value !== "object") return false;
  const design = value as Partial<TemplateDesign>;
  return (
    design.version === 2 &&
    !!design.page &&
    typeof design.page.width === "number" &&
    typeof design.page.height === "number" &&
    Array.isArray(design.elements)
  );
}
