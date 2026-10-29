import test from "node:test";
import assert from "node:assert/strict";
import type { TemplateDesign } from "@edu/shared";
import { buildDocumentData } from "../src/lib/document-data";
import { renderTemplateHtml } from "../src/lib/document-template-renderer";

const student = {
  fullName: "Aarav Sharma",
  studentId: "ST-1006",
  admissionNumber: "ADM-2026-0042",
  rollNumber: 12,
  className: "Grade 9",
  sectionName: "A",
  dateOfBirth: "2011-04-18",
  gender: "Male",
  bloodGroup: "O+",
  address: "Lakeside-6, Pokhara",
  phone: "9800000000",
  email: "aarav@example.com",
  academicYearId: "year-1",
  history: [{ yearName: "2082/83" }],
  guardians: [
    { fullName: "Ram Sharma", relationship: "Father", phone: "9811111111", isPrimary: true },
    { fullName: "Sita Sharma", relationship: "Mother", phone: "9822222222", isPrimary: false },
  ],
};

const organisation = {
  name: "Shree Sunshine School",
  address: "Pokhara, Kaski",
  phone: "+977-61-456789",
  email: "info@school.edu.np",
  logoUrl: "https://cdn.example.com/logo.png",
};

test("document data resolves student, guardians, session and school branding", () => {
  const data = buildDocumentData(student, organisation);
  assert.equal(data.fullName, "Aarav Sharma");
  assert.equal(data.rollNumber, "12");
  assert.equal(data.fatherName, "Ram Sharma");
  assert.equal(data.motherName, "Sita Sharma");
  assert.equal(data.guardianName, "Ram Sharma");
  assert.equal(data.session, "2082/83");
  assert.equal(data.academicYear, "2082/83");
  assert.equal(data.schoolName, "Shree Sunshine School");
  assert.equal(data.schoolPhone, "+977-61-456789");
  assert.ok(data.qrCode.includes("/verify/ST-1006"));
  assert.ok(data.issueDate.length > 0);
});

test("template renderer resolves fields, tables and QR marks", async () => {
  const design: TemplateDesign = {
    version: 2,
    page: { width: 600, height: 400, background: "#ffffff" },
    elements: [
      { id: "name", type: "field", field: "fullName", x: 20, y: 20, width: 300, height: 40, style: { fontSize: 20 } },
      {
        id: "subjects",
        type: "table",
        x: 20,
        y: 80,
        width: 320,
        height: 120,
        table: {
          columns: [
            { key: "subject", label: "Subject", width: 2 },
            { key: "grade", label: "Grade", width: 1 },
          ],
          rows: [["Mathematics", "A+"]],
        },
      },
      { id: "qr", type: "qr", field: "qrCode", x: 440, y: 20, width: 120, height: 120 },
      { id: "hidden", type: "field", field: "fullName", x: 0, y: 0, width: 10, height: 10, hidden: true },
    ],
  };
  const html = await renderTemplateHtml(design, buildDocumentData(student, organisation), {
    title: "Identity card",
    showPrintButton: false,
  });
  assert.match(html, /Aarav Sharma/);
  assert.match(html, /Mathematics/);
  assert.match(html, /<table/);
  assert.match(html, /<svg/);
  assert.match(html, /@page/);
  assert.ok(!html.includes("Print document"));
  assert.equal(html.match(/Aarav Sharma/g)?.length, 1);
});
