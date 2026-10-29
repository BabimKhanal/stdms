import {
  DOCUMENT_FIELD_LABELS,
  PAGE_PRESETS,
  isTemplateDesign,
  type DocumentType,
  type PagePresetKey,
  type TemplateDesign,
  type TemplateElement,
  type TemplateElementStyle,
  type TemplateTableConfig,
} from "@edu/shared";

let counter = 0;
const nextId = (type: string) => `el-${type}-${++counter}`;

type ElementInput = Omit<TemplateElement, "id">;

function el(input: ElementInput): TemplateElement {
  return { id: nextId(input.type), rotation: 0, opacity: 1, ...input };
}

function text(
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  style: TemplateElementStyle = {},
  extra: Partial<TemplateElement> = {},
): TemplateElement {
  return el({ type: "text", x, y, width, height, text: value, style, ...extra });
}

function field(
  x: number,
  y: number,
  width: number,
  height: number,
  key: string,
  style: TemplateElementStyle = {},
  extra: Partial<TemplateElement> = {},
): TemplateElement {
  return el({ type: "field", x, y, width, height, field: key, style, ...extra });
}

function box(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  extra: Partial<TemplateElement> = {},
): TemplateElement {
  return el({ type: "shape", x, y, width, height, fill, ...extra });
}

function line(
  x: number,
  y: number,
  width: number,
  stroke: string,
  extra: Partial<TemplateElement> = {},
): TemplateElement {
  return el({ type: "line", x, y, width, height: 2, stroke, strokeWidth: 2, ...extra });
}

function photo(x: number, y: number, width: number, height: number, extra: Partial<TemplateElement> = {}): TemplateElement {
  return el({ type: "photo", x, y, width, height, field: "photoUrl", ...extra });
}

function qr(x: number, y: number, size: number, extra: Partial<TemplateElement> = {}): TemplateElement {
  return el({ type: "qr", x, y, width: size, height: size, ...extra });
}

function table(
  x: number,
  y: number,
  width: number,
  height: number,
  config: TemplateTableConfig,
  extra: Partial<TemplateElement> = {},
): TemplateElement {
  return el({ type: "table", x, y, width, height, table: config, ...extra });
}

function design(width: number, height: number, background: string, elements: TemplateElement[], meta?: TemplateDesign["meta"]): TemplateDesign {
  return { version: 2, page: { width, height, background }, elements, meta };
}

const A4P = PAGE_PRESETS["a4-portrait"];
const A4L = PAGE_PRESETS["a4-landscape"];
const IDL = PAGE_PRESETS["id-landscape"];
const IDP = PAGE_PRESETS["id-portrait"];

export const SUBJECT_TABLE: TemplateTableConfig = {
  source: "subjects",
  columns: [
    { key: "subject", label: "Subject", width: 40 },
    { key: "credit", label: "Credit", width: 12, align: "center" },
    { key: "theory", label: "Theory", width: 16, align: "center" },
    { key: "practical", label: "Practical", width: 16, align: "center" },
    { key: "total", label: "Total", width: 16, align: "center" },
    { key: "grade", label: "Grade", width: 12, align: "center" },
  ],
  rows: [
    ["Mathematics", "4", "78", "18", "96", "A+"],
    ["English", "4", "72", "20", "92", "A"],
    ["Science", "4", "68", "22", "90", "A"],
    ["Social Studies", "3", "70", "—", "70", "B+"],
    ["Computer Science", "3", "84", "18", "102", "A+"],
    ["Nepali", "3", "66", "—", "66", "B+"],
  ],
  headerBackground: "#0f766e",
  headerColor: "#ffffff",
  zebra: true,
  rowHeight: 38,
  fontSize: 14,
};

function certificateBase(options: {
  background: string;
  border: string;
  accent: string;
  titleColor: string;
  bodyColor: string;
  font: string;
  title: string;
  subtitle: string;
  body: string;
  signatures: [string, string];
  watermark?: string;
  logo?: boolean;
}): TemplateDesign {
  const W = A4L.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 18, options.accent));
  elements.push(box(0, A4L.height - 18, W, 18, options.accent));
  elements.push(box(46, 46, W - 92, A4L.height - 92, "transparent", { stroke: options.border, strokeWidth: 4, radius: 6 }));
  elements.push(box(60, 60, W - 120, A4L.height - 120, "transparent", { stroke: options.border, strokeWidth: 1, radius: 4 }));
  if (options.watermark) {
    elements.push(
      text(110, 300, W - 220, 150, options.watermark, {
        fontFamily: options.font,
        fontSize: 96,
        fontWeight: 800,
        color: options.accent,
        align: "center",
        letterSpacing: 4,
      }, { opacity: 0.07 }),
    );
  }
  if (options.logo) {
    elements.push(box(W / 2 - 34, 92, 68, 68, options.accent, { radius: 34 }));
    elements.push(
      text(W / 2 - 34, 108, 68, 40, "LOGO", {
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 800,
        color: "#ffffff",
        align: "center",
      }),
    );
  }
  elements.push(
    text(90, options.logo ? 176 : 130, W - 180, 40, options.subtitle, {
      fontFamily: options.font,
      fontSize: 22,
      fontWeight: 700,
      color: options.accent,
      align: "center",
      letterSpacing: 2,
      textTransform: "uppercase",
    }),
  );
  elements.push(
    text(90, options.logo ? 222 : 180, W - 180, 60, options.title, {
      fontFamily: options.font,
      fontSize: 44,
      fontWeight: 800,
      color: options.titleColor,
      align: "center",
      letterSpacing: 1,
    }),
  );
  elements.push(line(W / 2 - 90, options.logo ? 292 : 250, 180, options.accent));
  elements.push(
    text(120, options.logo ? 316 : 276, W - 240, 30, "This certificate is proudly presented to", {
      fontFamily: options.font,
      fontSize: 17,
      fontStyle: "italic",
      color: options.bodyColor,
      align: "center",
    }),
  );
  elements.push(
    field(120, options.logo ? 352 : 312, W - 240, 62, "fullName", {
      fontFamily: options.font,
      fontSize: 46,
      fontWeight: 800,
      color: options.accent,
      align: "center",
    }),
  );
  elements.push(line(W / 2 - 160, options.logo ? 420 : 380, 320, options.border));
  elements.push(
    text(150, options.logo ? 442 : 402, W - 300, 76, options.body, {
      fontFamily: options.font,
      fontSize: 17,
      color: options.bodyColor,
      align: "center",
      lineHeight: 1.6,
    }),
  );
  elements.push(
    text(150, options.logo ? 528 : 488, W - 300, 28, "Session", {
      fontFamily: "Inter",
      fontSize: 13,
      fontWeight: 600,
      color: options.bodyColor,
      align: "center",
      textTransform: "uppercase",
      letterSpacing: 2,
    }),
  );
  elements.push(
    field(150, options.logo ? 556 : 516, W - 300, 28, "session", {
      fontFamily: options.font,
      fontSize: 18,
      fontWeight: 700,
      color: options.titleColor,
      align: "center",
    }),
  );
  const signatureY = A4L.height - 160;
  elements.push(line(140, signatureY, 240, options.bodyColor));
  elements.push(line(W - 380, signatureY, 240, options.bodyColor));
  elements.push(
    text(140, signatureY + 10, 240, 24, options.signatures[0], {
      fontFamily: options.font,
      fontSize: 14,
      fontWeight: 600,
      color: options.bodyColor,
      align: "center",
    }),
  );
  elements.push(
    text(W - 380, signatureY + 10, 240, 24, options.signatures[1], {
      fontFamily: options.font,
      fontSize: 14,
      fontWeight: 600,
      color: options.bodyColor,
      align: "center",
    }),
  );
  elements.push(
    text(W - 170, A4L.height - 118, 110, 22, "Scan to verify", {
      fontFamily: "Inter",
      fontSize: 10,
      color: options.bodyColor,
      align: "center",
    }),
  );
  elements.push(qr(W - 150, A4L.height - 96, 70));
  return design(A4L.width, A4L.height, options.background, elements);
}

function marksheetBase(options: {
  background: string;
  header: string;
  accent: string;
  title: string;
  tableHeader: string;
  tableHeaderText: string;
  zebra: boolean;
  compact?: boolean;
}): TemplateDesign {
  const W = A4P.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 132, options.header));
  elements.push(box(48, 30, 64, 64, "#ffffff", { radius: 32 }));
  elements.push(
    text(48, 46, 64, 32, "LOGO", {
      fontFamily: "Inter",
      fontSize: 11,
      fontWeight: 800,
      color: options.header,
      align: "center",
    }),
  );
  elements.push(
    text(128, 34, 520, 32, "Institution name", {
      fontFamily: "Inter",
      fontSize: 24,
      fontWeight: 800,
      color: "#ffffff",
    }),
  );
  elements.push(
    text(128, 70, 520, 24, options.title, {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 600,
      color: "#ffffff",
      letterSpacing: 2,
    }),
  );
  elements.push(
    text(W - 250, 34, 200, 22, "Session", {
      fontFamily: "Inter",
      fontSize: 11,
      fontWeight: 600,
      color: "#ffffff",
      align: "right",
      textTransform: "uppercase",
      letterSpacing: 1,
    }),
  );
  elements.push(
    field(W - 250, 58, 200, 26, "session", {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 700,
      color: "#ffffff",
      align: "right",
    }),
  );
  const infoY = 168;
  const labelStyle: TemplateElementStyle = { fontFamily: "Inter", fontSize: 12, color: "#64748b" };
  const valueStyle: TemplateElementStyle = { fontFamily: "Inter", fontSize: 15, fontWeight: 700, color: "#0f172a" };
  const info: [string, string, number, number][] = [
    ["Student name", "fullName", 48, 0],
    ["Student ID", "studentId", 420, 0],
    ["Class", "className", 48, 1],
    ["Section", "sectionName", 420, 1],
    ["Roll no.", "rollNumber", 48, 2],
    ["Exam", "examName", 420, 2],
  ];
  for (const [label, key, x, row] of info) {
    const y = infoY + row * 56;
    elements.push(text(x, y, 300, 18, label, labelStyle));
    elements.push(field(x, y + 20, 300, 24, key, valueStyle));
  }
  elements.push(line(48, 322, W - 96, "#e2e8f0"));
  elements.push(
    text(48, 342, 300, 26, "Subject-wise performance", {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 700,
      color: options.accent,
    }),
  );
  elements.push(
    table(48, 380, W - 96, 320, {
      ...SUBJECT_TABLE,
      headerBackground: options.tableHeader,
      headerColor: options.tableHeaderText,
      zebra: options.zebra,
      rowHeight: options.compact ? 32 : 38,
      fontSize: options.compact ? 12 : 14,
    }),
  );
  const summaryY = 726;
  elements.push(box(48, summaryY, W - 96, 96, "#f8fafc", { radius: 10, stroke: "#e2e8f0", strokeWidth: 1 }));
  const summary: [string, string][] = [
    ["Obtained", "obtainedMarks"],
    ["Total", "totalMarks"],
    ["Percentage", "percentage"],
    ["GPA", "gpa"],
    ["Grade", "grade"],
    ["Rank", "rank"],
  ];
  summary.forEach(([label, key], index) => {
    const x = 64 + index * 118;
    elements.push(text(x, summaryY + 18, 100, 16, label, { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
    elements.push(field(x, summaryY + 40, 100, 34, key, { fontFamily: "Inter", fontSize: 20, fontWeight: 800, color: options.accent }));
  });
  elements.push(text(48, 850, 200, 18, "Remarks", { fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
  elements.push(field(48, 872, 520, 26, "remarks", { fontFamily: "Inter", fontSize: 14, color: "#0f172a" }));
  elements.push(line(48, 960, 220, "#94a3b8"));
  elements.push(text(48, 968, 220, 20, "Class teacher", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(line(430, 960, 220, "#94a3b8"));
  elements.push(text(430, 968, 220, 20, "Principal", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(qr(W - 150, 940, 78));
  elements.push(text(W - 160, 1024, 98, 16, "Verify result", { fontFamily: "Inter", fontSize: 9, color: "#64748b", align: "center" }));
  elements.push(line(48, 1058, W - 96, "#e2e8f0"));
  elements.push(
    text(48, 1070, W - 96, 18, "This statement is computer generated and valid with an institutional seal.", {
      fontFamily: "Inter",
      fontSize: 10,
      color: "#94a3b8",
      align: "center",
    }),
  );
  return design(W, A4P.height, options.background, elements);
}

function transcriptBase(options: {
  background: string;
  header: string;
  accent: string;
  title: string;
  tableHeader: string;
  tableHeaderText: string;
}): TemplateDesign {
  const W = A4P.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 8, options.accent));
  elements.push(
    text(48, 44, 500, 40, "Institution name", {
      fontFamily: "Inter",
      fontSize: 28,
      fontWeight: 800,
      color: options.header,
    }),
  );
  elements.push(
    text(48, 84, 500, 24, "Office of the Registrar · Academic Records", {
      fontFamily: "Inter",
      fontSize: 12,
      color: "#64748b",
      letterSpacing: 1,
      textTransform: "uppercase",
    }),
  );
  elements.push(
    text(W - 240, 44, 192, 22, "Issued", {
      fontFamily: "Inter",
      fontSize: 10,
      fontWeight: 600,
      color: "#64748b",
      align: "right",
      textTransform: "uppercase",
      letterSpacing: 1,
    }),
  );
  elements.push(field(W - 240, 66, 192, 24, "issueDate", { fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "#0f172a", align: "right" }));
  elements.push(qr(W - 128, 98, 80));
  elements.push(line(48, 128, W - 96, "#e2e8f0"));
  elements.push(
    text(48, 158, W - 96, 46, options.title, {
      fontFamily: "Georgia",
      fontSize: 30,
      fontWeight: 700,
      color: options.header,
      align: "center",
      letterSpacing: 1,
    }),
  );
  elements.push(
    text(48, 208, W - 96, 24, "This is to certify the following academic record", {
      fontFamily: "Inter",
      fontSize: 12,
      color: "#64748b",
      align: "center",
      fontStyle: "italic",
    }),
  );
  const infoY = 256;
  const pairs: [string, string, number][] = [
    ["Student name", "fullName", 48],
    ["Student ID", "studentId", 430],
    ["Program / class", "className", 48],
    ["Section", "sectionName", 430],
    ["Date of birth", "dateOfBirth", 48],
    ["Admission no.", "admissionNumber", 430],
  ];
  pairs.forEach(([label, key, x], index) => {
    const y = infoY + Math.floor(index / 2) * 56;
    elements.push(text(x, y, 180, 16, label, { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
    elements.push(field(x, y + 20, 320, 24, key, { fontFamily: "Inter", fontSize: 15, fontWeight: 700, color: "#0f172a" }));
  });
  elements.push(
    text(48, 438, W - 96, 26, "Academic record", {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 800,
      color: options.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
    }),
  );
  elements.push(
    table(48, 474, W - 96, 300, {
      ...SUBJECT_TABLE,
      headerBackground: options.tableHeader,
      headerColor: options.tableHeaderText,
    }),
  );
  elements.push(box(48, 800, W - 96, 110, options.background, { radius: 10, stroke: "#e2e8f0", strokeWidth: 1 }));
  elements.push(
    text(70, 820, 200, 22, "Cumulative result", {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 700,
      color: options.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    }),
  );
  const summary: [string, string][] = [
    ["GPA", "gpa"],
    ["Percentage", "percentage"],
    ["Rank", "rank"],
    ["Result", "result"],
  ];
  summary.forEach(([label, key], index) => {
    const x = 70 + index * 160;
    elements.push(text(x, 850, 140, 16, label, { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase" }));
    elements.push(field(x, 868, 140, 30, key, { fontFamily: "Inter", fontSize: 20, fontWeight: 800, color: "#0f172a" }));
  });
  elements.push(text(48, 940, 260, 18, "Registrar remarks", { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
  elements.push(field(48, 962, 560, 24, "remarks", { fontFamily: "Inter", fontSize: 13, color: "#0f172a" }));
  elements.push(line(48, 1022, 220, "#94a3b8"));
  elements.push(text(48, 1030, 220, 20, "Registrar", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(line(430, 1022, 220, "#94a3b8"));
  elements.push(text(430, 1030, 220, 20, "Principal", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(
    text(48, 1072, W - 96, 18, "Verify authenticity using the QR code or contact the registrar's office.", {
      fontFamily: "Inter",
      fontSize: 10,
      color: "#94a3b8",
      align: "center",
    }),
  );
  return design(W, A4P.height, options.background, elements);
}

function idClassic(options: {
  background: string;
  header: string;
  accent: string;
  title: string;
  sessionColor: string;
  photoOnRight: boolean;
}): TemplateDesign {
  const W = IDL.width;
  const H = IDL.height;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, H, options.background));
  elements.push(box(0, 0, W, 128, options.header));
  elements.push(box(0, 128, W, 7, options.accent));
  elements.push(box(30, 28, 72, 72, "#ffffff", { radius: 8 }));
  elements.push(
    text(30, 48, 72, 30, "LOGO", {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 800,
      color: options.header,
      align: "center",
    }),
  );
  elements.push(field(122, 30, 520, 42, "schoolName", {
    fontFamily: "Inter",
    fontSize: 30,
    fontWeight: 800,
    color: "#ffffff",
    textTransform: "uppercase",
  }));
  elements.push(
    text(122, 76, 520, 24, options.title, {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 700,
      color: "#ffffff",
      letterSpacing: 3,
      textTransform: "uppercase",
    }),
  );
  elements.push(box(36, 156, 290, 42, options.sessionColor, { radius: 6 }));
  elements.push(
    text(52, 166, 260, 22, "SESSION", {
      fontFamily: "Inter",
      fontSize: 13,
      fontWeight: 700,
      color: "#1f2937",
      letterSpacing: 2,
    }),
  );
  elements.push(field(150, 166, 160, 22, "session", {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 800,
    color: "#1f2937",
  }));
  const photoX = options.photoOnRight ? W - 300 : 700;
  elements.push(photo(photoX, 156, 268, 330, { stroke: options.header, strokeWidth: 5, radius: 4 }));
  const detailX = options.photoOnRight ? 36 : 36;
  const detailWidth = options.photoOnRight ? 640 : 640;
  const rows: [string, string][] = [
    ["NAME", "fullName"],
    ["F. NAME", "fatherName"],
    ["M. NAME", "motherName"],
    ["CLASS", "className"],
    ["PH. NO.", "phone"],
    ["D.O.B.", "dateOfBirth"],
    ["ADM.", "admissionNumber"],
    ["ADDRESS", "address"],
  ];
  rows.forEach(([label, key], index) => {
    const y = 220 + index * 40;
    elements.push(
      text(detailX, y, 92, 22, `${label} :`, {
        fontFamily: "Inter",
        fontSize: 13,
        fontWeight: 800,
        color: options.accent,
      }),
    );
    elements.push(
      field(detailX + 96, y, detailWidth - 96, 24, key, {
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 600,
        color: "#111827",
        textTransform: key === "fullName" || key === "address" ? "uppercase" : "none",
      }),
    );
  });
  elements.push(box(0, H - 86, W, 86, options.accent));
  elements.push(field(36, H - 62, 520, 24, "schoolEmail", {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 700,
    color: options.header,
  }));
  elements.push(line(760, H - 58, 180, "#ffffff"));
  elements.push(text(760, H - 48, 180, 22, "PRINCIPAL", {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 800,
    color: "#ffffff",
    align: "center",
    letterSpacing: 1,
  }));
  return design(W, H, options.background, elements);
}

function idVertical(options: {
  background: string;
  header: string;
  accent: string;
  title: string;
}): TemplateDesign {
  const W = IDP.width;
  const H = IDP.height;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, H, options.background));
  elements.push(box(0, 0, W, 190, options.header));
  elements.push(box(0, 190, W, 8, options.accent));
  elements.push(box(W / 2 - 46, 26, 92, 92, "#ffffff", { radius: 46 }));
  elements.push(
    text(W / 2 - 46, 60, 92, 26, "LOGO", {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 800,
      color: options.header,
      align: "center",
    }),
  );
  elements.push(field(24, 124, W - 48, 34, "schoolName", {
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: 800,
    color: "#ffffff",
    align: "center",
    textTransform: "uppercase",
  }));
  elements.push(
    text(24, 160, W - 48, 22, options.title, {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 600,
      color: "#ffffff",
      align: "center",
      letterSpacing: 2,
      textTransform: "uppercase",
    }),
  );
  elements.push(photo(W / 2 - 108, 232, 216, 250, { stroke: options.header, strokeWidth: 4, radius: 8 }));
  elements.push(field(40, 502, W - 80, 40, "fullName", {
    fontFamily: "Inter",
    fontSize: 27,
    fontWeight: 800,
    color: "#0f172a",
    align: "center",
    textTransform: "uppercase",
  }));
  elements.push(
    text(40, 548, W - 80, 22, "STUDENT", {
      fontFamily: "Inter",
      fontSize: 11,
      fontWeight: 700,
      color: options.accent,
      align: "center",
      letterSpacing: 4,
    }),
  );
  const rows: [string, string][] = [
    ["Student ID", "studentId"],
    ["Class", "className"],
    ["Section", "sectionName"],
    ["Roll no.", "rollNumber"],
    ["Date of birth", "dateOfBirth"],
    ["Session", "session"],
  ];
  rows.forEach(([label, key], index) => {
    const y = 600 + index * 52;
    elements.push(text(48, y, 190, 18, label, { fontFamily: "Inter", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
    elements.push(field(48, y + 18, W - 96, 26, key, { fontFamily: "Inter", fontSize: 16, fontWeight: 700, color: "#0f172a" }));
    elements.push(line(48, y + 46, W - 96, "#e2e8f0"));
  });
  elements.push(box(0, H - 66, W, 66, options.header));
  elements.push(field(24, H - 44, W - 48, 22, "schoolAddress", {
    fontFamily: "Inter",
    fontSize: 11,
    color: "#ffffff",
    align: "center",
  }));
  elements.push(qr(W - 92, 232, 70, { stroke: options.header, strokeWidth: 2 }));
  return design(W, H, options.background, elements);
}

function idModern(options: {
  background: string;
  header: string;
  accent: string;
  title: string;
  photoOnRight: boolean;
  dark?: boolean;
}): TemplateDesign {
  const W = IDL.width;
  const H = IDL.height;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, H, options.background));
  elements.push(box(0, 0, 250, H, options.header));
  elements.push(box(250, 0, 6, H, options.accent));
  elements.push(box(280, 0, W - 280, 92, options.header));
  elements.push(box(280, 92, W - 280, 5, options.accent));
  elements.push(box(52, 40, 146, 146, "#ffffff", { radius: 12 }));
  elements.push(
    text(52, 88, 146, 40, "LOGO", {
      fontFamily: "Inter",
      fontSize: 18,
      fontWeight: 800,
      color: options.header,
      align: "center",
    }),
  );
  elements.push(
    text(24, 220, 202, 90, "STUDENT", {
      fontFamily: "Inter",
      fontSize: 26,
      fontWeight: 800,
      color: "#ffffff",
      align: "center",
      letterSpacing: 3,
    }),
  );
  elements.push(
    text(24, 262, 202, 50, "IDENTITY", {
      fontFamily: "Inter",
      fontSize: 26,
      fontWeight: 800,
      color: options.accent,
      align: "center",
      letterSpacing: 3,
    }),
  );
  elements.push(qr(49, H - 150, 152, { stroke: "#ffffff", strokeWidth: 2 }));
  elements.push(
    text(24, H - 74, 202, 20, "SCAN TO VERIFY", {
      fontFamily: "Inter",
      fontSize: 9,
      fontWeight: 700,
      color: "#ffffff",
      align: "center",
      letterSpacing: 2,
    }),
  );
  elements.push(field(304, 30, 400, 34, "schoolName", {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: 800,
    color: "#ffffff",
    textTransform: "uppercase",
  }));
  elements.push(
    text(304, 62, 400, 20, options.title, {
      fontFamily: "Inter",
      fontSize: 11,
      fontWeight: 600,
      color: "#ffffff",
      letterSpacing: 2,
      textTransform: "uppercase",
    }),
  );
  const photoX = options.photoOnRight ? W - 290 : 660;
  elements.push(photo(photoX, 122, 258, 330, { radius: 12 }));
  elements.push(field(304, 132, 380, 40, "fullName", {
    fontFamily: "Inter",
    fontSize: 30,
    fontWeight: 800,
    color: options.dark ? "#ffffff" : "#0f172a",
  }));
  elements.push(line(304, 182, 320, options.accent));
  const rows: [string, string][] = [
    ["Student ID", "studentId"],
    ["Class", "className"],
    ["Section", "sectionName"],
    ["Roll no.", "rollNumber"],
    ["Date of birth", "dateOfBirth"],
    ["Phone", "phone"],
    ["Address", "address"],
  ];
  rows.forEach(([label, key], index) => {
    const y = 204 + index * 46;
    elements.push(text(304, y, 150, 16, label, { fontFamily: "Inter", fontSize: 10, color: options.dark ? "#cbd5e1" : "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
    elements.push(field(304, y + 18, 330, 24, key, { fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: options.dark ? "#ffffff" : "#0f172a" }));
  });
  elements.push(box(280, H - 72, W - 280, 72, options.accent));
  elements.push(field(304, H - 48, 420, 20, "schoolEmail", {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: 600,
    color: "#ffffff",
  }));
  elements.push(field(304, H - 28, 420, 18, "schoolPhone", {
    fontFamily: "Inter",
    fontSize: 11,
    color: "#ffffff",
  }));
  return design(W, H, options.background, elements);
}

export type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  documentType: DocumentType;
  design: TemplateDesign;
};

const idPresets: TemplatePreset[] = [
  {
    id: "schoolhouse-red-id",
    name: "Schoolhouse Red",
    description: "Bold red header, session ribbon, family details, portrait, and principal footer.",
    documentType: "identity_card",
    design: idClassic({ background: "#e7f5f6", header: "#c62828", accent: "#b71c1c", title: "Student identity card", sessionColor: "#facc15", photoOnRight: true }),
  },
  {
    id: "crimson-campus-id",
    name: "Crimson Campus",
    description: "Formal crimson card with portrait and compact identity block.",
    documentType: "identity_card",
    design: idClassic({ background: "#fff7ed", header: "#b91c1c", accent: "#7f1d1d", title: "Student card", sessionColor: "#fed7aa", photoOnRight: true }),
  },
  {
    id: "royal-blue-id",
    name: "Royal Blue",
    description: "Navy and gold school card with a classic institution header.",
    documentType: "identity_card",
    design: idClassic({ background: "#eff6ff", header: "#1e3a8a", accent: "#b45309", title: "Student identity card", sessionColor: "#fde68a", photoOnRight: true }),
  },
  {
    id: "emerald-campus-id",
    name: "Emerald Campus",
    description: "Fresh green identity card with a clean information hierarchy.",
    documentType: "identity_card",
    design: idClassic({ background: "#ecfdf5", header: "#047857", accent: "#065f46", title: "Student identity card", sessionColor: "#a7f3d0", photoOnRight: true }),
  },
  {
    id: "midnight-id",
    name: "Midnight Contemporary",
    description: "Dark side panel with dominant photo and QR verification.",
    documentType: "identity_card",
    design: idModern({ background: "#0f172a", header: "#1e293b", accent: "#38bdf8", title: "Student identity card", photoOnRight: true, dark: true }),
  },
  {
    id: "campus-teal-id",
    name: "Campus Teal",
    description: "Modern teal split layout that works well in plastic card printing.",
    documentType: "identity_card",
    design: idModern({ background: "#ffffff", header: "#0f766e", accent: "#f59e0b", title: "Student identity card", photoOnRight: true }),
  },
  {
    id: "vertical-ivory-id",
    name: "Vertical Ivory",
    description: "Portrait orientation badge with a large portrait and stacked details.",
    documentType: "identity_card",
    design: idVertical({ background: "#fffdf7", header: "#1f2937", accent: "#b45309", title: "Student identity card" }),
  },
  {
    id: "vertical-sky-id",
    name: "Vertical Sky",
    description: "Portrait badge in sky blue with a soft institutional header.",
    documentType: "identity_card",
    design: idVertical({ background: "#f0f9ff", header: "#0369a1", accent: "#0ea5e9", title: "Student identity card" }),
  },
  {
    id: "scholar-purple-id",
    name: "Scholar Purple",
    description: "Academic purple card with a refined gold accent.",
    documentType: "identity_card",
    design: idClassic({ background: "#faf5ff", header: "#6b21a8", accent: "#ca8a04", title: "Student identity card", sessionColor: "#fde68a", photoOnRight: true }),
  },
  {
    id: "elementary-sun-id",
    name: "Elementary Sun",
    description: "Warm and friendly card designed for primary school students.",
    documentType: "identity_card",
    design: idClassic({ background: "#fffbeb", header: "#ea580c", accent: "#c2410c", title: "Student identity card", sessionColor: "#fde68a", photoOnRight: true }),
  },
];

const certificatePresets: TemplatePreset[] = [
  {
    id: "heritage-gold-certificate",
    name: "Heritage Gold",
    description: "Double-ruled gold certificate with centered recognition and signatures.",
    documentType: "certificate",
    design: certificateBase({
      background: "#fffaf0",
      border: "#b88728",
      accent: "#b88728",
      titleColor: "#263238",
      bodyColor: "#4b5563",
      font: "Georgia",
      title: "Certificate of Achievement",
      subtitle: "Institution name",
      body: "for outstanding academic performance and dedication to learning during the academic session.",
      signatures: ["Principal", "Class teacher"],
      watermark: "ACHIEVEMENT",
      logo: true,
    }),
  },
  {
    id: "modern-merit-certificate",
    name: "Modern Merit",
    description: "Contemporary navy certificate for excellence and completion awards.",
    documentType: "certificate",
    design: certificateBase({
      background: "#f4f7fb",
      border: "#1d4ed8",
      accent: "#1d4ed8",
      titleColor: "#0f172a",
      bodyColor: "#475569",
      font: "Inter",
      title: "Certificate of Excellence",
      subtitle: "Institution name",
      body: "in recognition of exceptional achievement, consistent effort, and exemplary conduct.",
      signatures: ["Principal", "Academic coordinator"],
      watermark: "EXCELLENCE",
      logo: true,
    }),
  },
  {
    id: "ivory-serif-certificate",
    name: "Ivory Serif",
    description: "Minimal serif certificate with generous whitespace and a quiet tone.",
    documentType: "certificate",
    design: certificateBase({
      background: "#ffffff",
      border: "#cbd5e1",
      accent: "#334155",
      titleColor: "#111827",
      bodyColor: "#57534e",
      font: "Georgia",
      title: "Certificate of Completion",
      subtitle: "Institution name",
      body: "has successfully completed all requirements prescribed for the programme.",
      signatures: ["Registrar", "Principal"],
      watermark: "COMPLETION",
      logo: false,
    }),
  },
  {
    id: "emerald-honors-certificate",
    name: "Emerald Honors",
    description: "Deep green border with a gold seal treatment for top achievers.",
    documentType: "certificate",
    design: certificateBase({
      background: "#f0fdf4",
      border: "#047857",
      accent: "#047857",
      titleColor: "#064e3b",
      bodyColor: "#3f6212",
      font: "Georgia",
      title: "Certificate of Honor",
      subtitle: "Institution name",
      body: "presented in recognition of academic distinction and leadership among peers.",
      signatures: ["Principal", "Head of academics"],
      watermark: "HONORS",
      logo: true,
    }),
  },
  {
    id: "burgundy-formal-certificate",
    name: "Burgundy Formal",
    description: "Traditional burgundy and cream certificate for convocation ceremonies.",
    documentType: "certificate",
    design: certificateBase({
      background: "#fffbf5",
      border: "#7f1d1d",
      accent: "#7f1d1d",
      titleColor: "#431407",
      bodyColor: "#57534e",
      font: "Georgia",
      title: "Certificate of Graduation",
      subtitle: "Institution name",
      body: "has satisfactorily completed the prescribed course of study and is awarded this certificate.",
      signatures: ["Registrar", "Chairperson"],
      watermark: "GRADUATION",
      logo: true,
    }),
  },
  {
    id: "tech-blue-certificate",
    name: "Tech Blue",
    description: "Sharp blue certificate for coding, STEM, and innovation awards.",
    documentType: "certificate",
    design: certificateBase({
      background: "#f8fafc",
      border: "#0284c7",
      accent: "#0284c7",
      titleColor: "#0c4a6e",
      bodyColor: "#475569",
      font: "Inter",
      title: "Certificate of Participation",
      subtitle: "Institution name",
      body: "for active participation, creativity, and teamwork during the programme.",
      signatures: ["Programme lead", "Principal"],
      watermark: "PARTICIPATION",
      logo: false,
    }),
  },
  {
    id: "royal-navy-certificate",
    name: "Royal Navy",
    description: "Navy and gold formal award with a prominent seal and signature block.",
    documentType: "certificate",
    design: certificateBase({
      background: "#f8fafc",
      border: "#1e3a8a",
      accent: "#1e3a8a",
      titleColor: "#172554",
      bodyColor: "#334155",
      font: "Georgia",
      title: "Certificate of Merit",
      subtitle: "Institution name",
      body: "awarded for sustained academic excellence and contribution to the school community.",
      signatures: ["Principal", "Vice principal"],
      watermark: "MERIT",
      logo: true,
    }),
  },
  {
    id: "sunrise-primary-certificate",
    name: "Sunrise Primary",
    description: "Warm, friendly certificate suited to primary and middle school events.",
    documentType: "certificate",
    design: certificateBase({
      background: "#fffbeb",
      border: "#ea580c",
      accent: "#ea580c",
      titleColor: "#7c2d12",
      bodyColor: "#57534e",
      font: "Inter",
      title: "Certificate of Appreciation",
      subtitle: "Institution name",
      body: "with thanks for enthusiasm, kindness, and a wonderful contribution to our school.",
      signatures: ["Class teacher", "Principal"],
      watermark: "THANK YOU",
      logo: false,
    }),
  },
];

const marksheetPresets: TemplatePreset[] = [
  {
    id: "classic-marksheet",
    name: "Classic Marksheet",
    description: "Teal header, subject table, result summary, and signature block.",
    documentType: "marksheet",
    design: marksheetBase({ background: "#ffffff", header: "#0f766e", accent: "#0f766e", title: "Statement of marks", tableHeader: "#0f766e", tableHeaderText: "#ffffff", zebra: true }),
  },
  {
    id: "navy-marksheet",
    name: "Navy Marksheet",
    description: "Institutional navy header with a high-contrast results summary.",
    documentType: "marksheet",
    design: marksheetBase({ background: "#ffffff", header: "#1e3a8a", accent: "#1d4ed8", title: "Statement of marks", tableHeader: "#1e3a8a", tableHeaderText: "#ffffff", zebra: true }),
  },
  {
    id: "crimson-marksheet",
    name: "Crimson Marksheet",
    description: "Bold crimson result sheet for term and annual examinations.",
    documentType: "marksheet",
    design: marksheetBase({ background: "#fffafa", header: "#b91c1c", accent: "#b91c1c", title: "Statement of marks", tableHeader: "#b91c1c", tableHeaderText: "#ffffff", zebra: false }),
  },
  {
    id: "emerald-marksheet",
    name: "Emerald Marksheet",
    description: "Calm green academic report with a compact table setting.",
    documentType: "marksheet",
    design: marksheetBase({ background: "#f7fdfa", header: "#047857", accent: "#047857", title: "Annual examination result", tableHeader: "#065f46", tableHeaderText: "#ffffff", zebra: true, compact: true }),
  },
  {
    id: "slate-marksheet",
    name: "Slate Minimal",
    description: "Neutral slate marksheet for a clean, formal presentation.",
    documentType: "marksheet",
    design: marksheetBase({ background: "#ffffff", header: "#334155", accent: "#0f172a", title: "Academic result", tableHeader: "#334155", tableHeaderText: "#ffffff", zebra: false }),
  },
];

const transcriptPresets: TemplatePreset[] = [
  {
    id: "academic-transcript",
    name: "Academic Transcript",
    description: "Teal academic record with subject table and cumulative result.",
    documentType: "transcript",
    design: transcriptBase({ background: "#ffffff", header: "#0f766e", accent: "#0f766e", title: "Official Academic Transcript", tableHeader: "#0f766e", tableHeaderText: "#ffffff" }),
  },
  {
    id: "navy-transcript",
    name: "Navy Transcript",
    description: "Formal navy transcript for college and university records.",
    documentType: "transcript",
    design: transcriptBase({ background: "#ffffff", header: "#1e3a8a", accent: "#b45309", title: "Official Transcript of Records", tableHeader: "#1e3a8a", tableHeaderText: "#ffffff" }),
  },
  {
    id: "ivory-transcript",
    name: "Ivory Registrar",
    description: "Serif registrar-style transcript with a restrained palette.",
    documentType: "transcript",
    design: transcriptBase({ background: "#fffdf8", header: "#3f3f46", accent: "#92400e", title: "Transcript of Academic Record", tableHeader: "#3f3f46", tableHeaderText: "#ffffff" }),
  },
  {
    id: "emerald-transcript",
    name: "Emerald Transcript",
    description: "Green transcript suited to secondary and higher secondary schools.",
    documentType: "transcript",
    design: transcriptBase({ background: "#f8fdfa", header: "#065f46", accent: "#047857", title: "Academic Transcript", tableHeader: "#065f46", tableHeaderText: "#ffffff" }),
  },
];

function characterCertificate(): TemplateDesign {
  const W = A4P.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 10, "#1e3a8a"));
  elements.push(field(48, 56, 480, 36, "schoolName", { fontFamily: "Georgia", fontSize: 26, fontWeight: 700, color: "#1e3a8a" }));
  elements.push(field(48, 94, 480, 22, "schoolAddress", { fontFamily: "Inter", fontSize: 11, color: "#64748b" }));
  elements.push(line(48, 132, W - 96, "#1e3a8a"));
  elements.push(text(48, 162, W - 96, 40, "CHARACTER CERTIFICATE", { fontFamily: "Georgia", fontSize: 28, fontWeight: 700, color: "#1e3a8a", align: "center", letterSpacing: 1 }));
  elements.push(text(48, 218, W - 96, 24, "To whom it may concern", { fontFamily: "Georgia", fontSize: 14, fontStyle: "italic", color: "#64748b", align: "center" }));
  elements.push(
    text(72, 280, W - 144, 120, "This is to certify that", {
      fontFamily: "Georgia",
      fontSize: 16,
      color: "#334155",
      align: "center",
    }),
  );
  elements.push(field(120, 336, W - 240, 48, "fullName", { fontFamily: "Georgia", fontSize: 34, fontWeight: 700, color: "#111827", align: "center" }));
  elements.push(
    text(72, 398, W - 144, 110, "son/daughter of", {
      fontFamily: "Georgia",
      fontSize: 16,
      color: "#334155",
      align: "center",
      lineHeight: 1.7,
    }),
  );
  elements.push(field(120, 426, 260, 28, "fatherName", { fontFamily: "Georgia", fontSize: 20, fontWeight: 700, color: "#111827", align: "center" }));
  elements.push(
    text(72, 470, W - 144, 150,
      "is a bona fide student of this institution. To the best of our knowledge, the student bears a good moral character, is disciplined, and has not been involved in any activity contrary to institutional rules.",
      { fontFamily: "Georgia", fontSize: 15, color: "#334155", align: "center", lineHeight: 1.8 }),
  );
  elements.push(
    text(72, 640, W - 144, 60, "We wish the student continued success in all future endeavours.",
      { fontFamily: "Georgia", fontSize: 15, color: "#334155", align: "center", lineHeight: 1.8 }),
  );
  elements.push(line(72, 900, 220, "#94a3b8"));
  elements.push(text(72, 908, 220, 20, "Class teacher", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(line(480, 900, 220, "#94a3b8"));
  elements.push(text(480, 908, 220, 20, "Principal", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(text(48, 980, 240, 18, "Issue date", { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
  elements.push(field(48, 1000, 240, 24, "issueDate", { fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: "#0f172a" }));
  elements.push(qr(W - 150, 968, 78));
  return design(W, A4P.height, "#ffffff", elements);
}

function transferCertificate(): TemplateDesign {
  const W = A4P.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 120, "#7f1d1d"));
  elements.push(field(48, 32, 520, 34, "schoolName", { fontFamily: "Georgia", fontSize: 24, fontWeight: 700, color: "#ffffff" }));
  elements.push(field(48, 70, 520, 22, "schoolAddress", { fontFamily: "Inter", fontSize: 11, color: "#fecaca" }));
  elements.push(text(48, 156, W - 96, 40, "TRANSFER CERTIFICATE", { fontFamily: "Georgia", fontSize: 26, fontWeight: 700, color: "#7f1d1d", align: "center", letterSpacing: 2 }));
  elements.push(text(48, 196, W - 96, 22, "Issued on request for school transfer", { fontFamily: "Inter", fontSize: 11, color: "#64748b", align: "center" }));
  const rows: [string, string][] = [
    ["Student name", "fullName"],
    ["Student ID", "studentId"],
    ["Admission number", "admissionNumber"],
    ["Class", "className"],
    ["Section", "sectionName"],
    ["Date of birth", "dateOfBirth"],
    ["Father name", "fatherName"],
    ["Mother name", "motherName"],
    ["Address", "address"],
    ["Session", "session"],
    ["Result", "result"],
    ["Issue date", "issueDate"],
  ];
  rows.forEach(([label, key], index) => {
    const y = 260 + index * 52;
    elements.push(box(48, y, W - 96, 42, index % 2 === 0 ? "#f8fafc" : "#ffffff"));
    elements.push(text(64, y + 11, 220, 20, label, { fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "#64748b" }));
    elements.push(field(300, y + 9, W - 360, 24, key, { fontFamily: "Inter", fontSize: 14, fontWeight: 700, color: "#0f172a" }));
  });
  elements.push(text(48, 920, 200, 18, "Remarks", { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
  elements.push(field(48, 942, 620, 24, "remarks", { fontFamily: "Inter", fontSize: 13, color: "#0f172a" }));
  elements.push(line(48, 1010, 220, "#94a3b8"));
  elements.push(text(48, 1018, 220, 20, "Registrar", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(line(470, 1010, 220, "#94a3b8"));
  elements.push(text(470, 1018, 220, 20, "Principal", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(qr(W - 150, 960, 78));
  return design(W, A4P.height, "#ffffff", elements);
}

function admissionLetter(): TemplateDesign {
  const W = A4P.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 96, "#0f172a"));
  elements.push(box(0, 96, W, 6, "#f59e0b"));
  elements.push(field(48, 26, 520, 32, "schoolName", { fontFamily: "Inter", fontSize: 24, fontWeight: 800, color: "#ffffff" }));
  elements.push(field(48, 60, 520, 20, "schoolAddress", { fontFamily: "Inter", fontSize: 11, color: "#94a3b8" }));
  elements.push(field(W - 250, 26, 200, 20, "schoolEmail", { fontFamily: "Inter", fontSize: 11, color: "#94a3b8", align: "right" }));
  elements.push(field(W - 250, 48, 200, 20, "schoolPhone", { fontFamily: "Inter", fontSize: 11, color: "#94a3b8", align: "right" }));
  elements.push(text(48, 150, 300, 20, "ADMISSION OFFER", { fontFamily: "Inter", fontSize: 12, fontWeight: 800, color: "#f59e0b", letterSpacing: 3 }));
  elements.push(field(48, 182, W - 96, 40, "issueDate", { fontFamily: "Inter", fontSize: 13, color: "#64748b" }));
  elements.push(text(48, 240, W - 96, 28, "Dear", { fontFamily: "Inter", fontSize: 15, color: "#334155" }));
  elements.push(field(100, 236, 480, 30, "fullName", { fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: "#0f172a" }));
  elements.push(
    text(48, 300, W - 96, 160,
      "Congratulations. Following a review of your application, we are pleased to offer you admission to our institution for the academic session shown below. This offer is subject to verification of your academic documents and completion of the enrolment formalities.",
      { fontFamily: "Inter", fontSize: 15, color: "#334155", lineHeight: 1.8 }),
  );
  elements.push(box(48, 480, W - 96, 130, "#f8fafc", { radius: 10, stroke: "#e2e8f0", strokeWidth: 1 }));
  const details: [string, string, number][] = [
    ["Programme / class", "className", 72],
    ["Section", "sectionName", 420],
    ["Student ID", "studentId", 72],
    ["Session", "session", 420],
  ];
  details.forEach(([label, key, x], index) => {
    const y = 502 + Math.floor(index / 2) * 54;
    elements.push(text(x, y, 200, 16, label, { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }));
    elements.push(field(x, y + 20, 300, 26, key, { fontFamily: "Inter", fontSize: 17, fontWeight: 700, color: "#0f172a" }));
  });
  elements.push(
    text(48, 640, W - 96, 90,
      "Please confirm your acceptance by signing and returning a copy of this letter before the deadline communicated by the admissions office.",
      { fontFamily: "Inter", fontSize: 15, color: "#334155", lineHeight: 1.8 }),
  );
  elements.push(text(48, 780, 300, 24, "Sincerely,", { fontFamily: "Inter", fontSize: 15, color: "#334155" }));
  elements.push(line(48, 880, 220, "#94a3b8"));
  elements.push(text(48, 888, 220, 20, "Admissions officer", { fontFamily: "Inter", fontSize: 12, color: "#64748b" }));
  elements.push(box(48, 950, W - 96, 1, "#e2e8f0"));
  elements.push(
    text(48, 970, W - 96, 40, "Acceptance: I accept the offer of admission and agree to abide by institutional policies.",
      { fontFamily: "Inter", fontSize: 11, color: "#64748b" }),
  );
  return design(W, A4P.height, "#ffffff", elements);
}

function completionLetter(): TemplateDesign {
  const W = A4L.width;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, 14, "#0f766e"));
  elements.push(field(48, 48, 560, 32, "schoolName", { fontFamily: "Georgia", fontSize: 24, fontWeight: 700, color: "#0f766e" }));
  elements.push(field(48, 80, 560, 20, "schoolAddress", { fontFamily: "Inter", fontSize: 11, color: "#64748b" }));
  elements.push(line(48, 116, W - 96, "#0f766e"));
  elements.push(text(48, 148, W - 96, 46, "COURSE COMPLETION LETTER", { fontFamily: "Georgia", fontSize: 32, fontWeight: 700, color: "#134e4a", align: "center" }));
  elements.push(text(48, 206, W - 96, 24, "This letter confirms the successful completion of the programme below", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center", fontStyle: "italic" }));
  elements.push(field(120, 268, W - 240, 50, "fullName", { fontFamily: "Georgia", fontSize: 38, fontWeight: 700, color: "#111827", align: "center" }));
  elements.push(line(W / 2 - 200, 330, 400, "#cbd5e1"));
  elements.push(text(120, 348, W - 240, 40, "has fulfilled all academic requirements for", { fontFamily: "Inter", fontSize: 16, color: "#334155", align: "center" }));
  elements.push(field(120, 390, W - 240, 40, "className", { fontFamily: "Inter", fontSize: 24, fontWeight: 800, color: "#0f766e", align: "center" }));
  elements.push(
    text(160, 448, W - 320, 90,
      "during the academic session shown below. The student has demonstrated satisfactory attendance, discipline, and participation in the academic programme.",
      { fontFamily: "Inter", fontSize: 15, color: "#475569", align: "center", lineHeight: 1.8 }),
  );
  elements.push(text(120, 552, 260, 20, "Session", { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 2 }));
  elements.push(field(120, 574, 260, 30, "session", { fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: "#0f172a" }));
  elements.push(text(W - 380, 552, 260, 20, "Result", { fontFamily: "Inter", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 2 }));
  elements.push(field(W - 380, 574, 260, 30, "result", { fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: "#0f172a" }));
  elements.push(line(120, 680, 240, "#94a3b8"));
  elements.push(text(120, 688, 240, 20, "Programme coordinator", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(line(W - 360, 680, 240, "#94a3b8"));
  elements.push(text(W - 360, 688, 240, 20, "Principal", { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
  elements.push(qr(W - 140, 620, 76));
  return design(W, A4L.height, "#ffffff", elements);
}

const customPresets: TemplatePreset[] = [
  {
    id: "character-certificate",
    name: "Character Certificate",
    description: "Formal character reference letter with signature and verification block.",
    documentType: "custom",
    design: characterCertificate(),
  },
  {
    id: "transfer-certificate",
    name: "Transfer Certificate",
    description: "Structured transfer record with student details and dual signatures.",
    documentType: "custom",
    design: transferCertificate(),
  },
  {
    id: "admission-offer-letter",
    name: "Admission Offer",
    description: "Modern offer letter with programme details and acceptance section.",
    documentType: "custom",
    design: admissionLetter(),
  },
  {
    id: "course-completion-letter",
    name: "Course Completion",
    description: "Landscape completion letter for programme or training certificates.",
    documentType: "custom",
    design: completionLetter(),
  },
];

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  ...idPresets,
  ...certificatePresets,
  ...marksheetPresets,
  ...transcriptPresets,
  ...customPresets,
];

export const PRESET_CATEGORIES: { key: DocumentType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "identity_card", label: "Identity cards" },
  { key: "certificate", label: "Certificates" },
  { key: "marksheet", label: "Marksheets" },
  { key: "transcript", label: "Transcripts" },
  { key: "custom", label: "Other" },
];

export function blankDesign(preset: PagePresetKey = "a4-portrait"): TemplateDesign {
  const page = PAGE_PRESETS[preset];
  return {
    version: 2,
    page: { width: page.width, height: page.height, background: "#ffffff" },
    elements: [
      text(48, 48, page.width - 96, 56, "Document title", {
        fontFamily: "Georgia",
        fontSize: 34,
        fontWeight: 700,
        color: "#0f172a",
        align: "center",
      }),
      line(48, 118, page.width - 96, "#cbd5e1"),
      field(48, 150, page.width - 96, 32, "schoolName", {
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: 600,
        color: "#334155",
        align: "center",
      }),
    ],
  };
}

/**
 * Converts legacy flat theme templates (version 1) into the canvas model so
 * older saved templates can be opened and edited in the builder.
 */
export function normalizeDesign(value: unknown): TemplateDesign {
  if (isTemplateDesign(value)) return value;
  const flat = (value ?? {}) as Record<string, unknown>;
  const string = (key: string, fallback: string) => (typeof flat[key] === "string" && flat[key] ? (flat[key] as string) : fallback);
  const bool = (key: string) => flat[key] === true || flat[key] === 1;
  const layout = string("layout", "a4-portrait");
  const background = string("background", "#ffffff");
  const primary = string("primary", "#2563eb");
  const accent = string("accent", "#0f172a");
  const font = string("fontFamily", "Inter");
  const title = string("title", "Document");
  const subtitle = string("subtitle", "Institution name");
  const fields = Array.isArray(flat.fields) ? flat.fields.filter((item): item is string => typeof item === "string") : [];
  const signatures = Array.isArray(flat.signatureLabels) ? flat.signatureLabels.filter((item): item is string => typeof item === "string") : [];
  const isIdentity = layout.startsWith("id");
  const isLandscape = layout === "a4-landscape";
  const page = isIdentity
    ? layout === "id-portrait" ? PAGE_PRESETS["id-portrait"] : PAGE_PRESETS["id-landscape"]
    : isLandscape ? PAGE_PRESETS["a4-landscape"] : PAGE_PRESETS["a4-portrait"];
  const W = page.width;
  const H = page.height;
  const elements: TemplateElement[] = [];
  elements.push(box(0, 0, W, isIdentity ? 120 : 110, primary));
  elements.push(box(isIdentity ? 24 : 48, isIdentity ? 24 : 32, isIdentity ? 72 : 56, isIdentity ? 72 : 46, "#ffffff", { radius: 8 }));
  elements.push(text(isIdentity ? 24 : 48, isIdentity ? 46 : 44, isIdentity ? 72 : 56, 24, "LOGO", { fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: primary, align: "center" }));
  elements.push(text(isIdentity ? 116 : 120, isIdentity ? 30 : 26, W - 160, 40, subtitle, { fontFamily: font, fontSize: isIdentity ? 26 : 24, fontWeight: 800, color: "#ffffff", textTransform: "uppercase" }));
  elements.push(text(isIdentity ? 116 : 120, isIdentity ? 76 : 64, W - 160, 24, title, { fontFamily: font, fontSize: isIdentity ? 13 : 14, fontWeight: 700, color: "#ffffff", letterSpacing: 2, textTransform: "uppercase" }));

  if (isIdentity) {
    const showPhoto = fields.includes("photoUrl");
    const photoX = W - 300;
    if (showPhoto) elements.push(photo(photoX, 152, 260, 320, { stroke: primary, strokeWidth: 4, radius: 8 }));
    const rows = fields.filter((item) => item !== "photoUrl" && item !== "qrCode" && item !== "principal");
    rows.forEach((key, index) => {
      const y = 160 + index * 42;
      elements.push(text(36, y, 160, 22, DOCUMENT_FIELD_LABELS[key as keyof typeof DOCUMENT_FIELD_LABELS] ?? key, { fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase" }));
      elements.push(field(190, y, showPhoto ? 430 : W - 230, 24, key, { fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: "#111827" }));
    });
    if (fields.includes("qrCode") || bool("showQr")) elements.push(qr(W - 120, 152, 88));
    if (fields.includes("principal")) {
      elements.push(box(0, H - 70, W, 70, primary));
      elements.push(text(36, H - 46, W - 220, 24, "PRINCIPAL", { fontFamily: "Inter", fontSize: 14, fontWeight: 800, color: "#ffffff" }));
    }
  } else {
    elements.push(text(48, 150, W - 96, 54, title, { fontFamily: font, fontSize: 34, fontWeight: 800, color: accent, align: "center" }));
    elements.push(line(48, 216, W - 96, primary));
    const rows = fields.filter((item) => item !== "photoUrl" && item !== "qrCode");
    rows.forEach((key, index) => {
      const y = 248 + index * 46;
      elements.push(text(64, y, 260, 24, DOCUMENT_FIELD_LABELS[key as keyof typeof DOCUMENT_FIELD_LABELS] ?? key, { fontFamily: "Inter", fontSize: 12, color: "#64748b" }));
      elements.push(field(320, y, W - 400, 26, key, { fontFamily: font, fontSize: 16, fontWeight: 600, color: "#0f172a" }));
      elements.push(line(64, y + 34, W - 128, "#e2e8f0"));
    });
    if (bool("showWatermark")) elements.push(text(80, Math.round(H / 2) - 60, W - 160, 120, "OFFICIAL", { fontFamily: font, fontSize: 90, fontWeight: 800, color: primary, align: "center" }, { opacity: 0.06 }));
    if (bool("showQr") || fields.includes("qrCode")) elements.push(qr(W - 150, H - 160, 80));
    signatures.forEach((label, index) => {
      const x = 80 + index * 260;
      elements.push(line(x, H - 170, 200, "#94a3b8"));
      elements.push(text(x, H - 160, 200, 20, label, { fontFamily: "Inter", fontSize: 12, color: "#64748b", align: "center" }));
    });
  }
  return design(W, H, background, elements);
}
