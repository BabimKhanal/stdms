type ReportCardRow = {
  studentName: string;
  rollNumber: number | null;
  className: string | null;
  sectionName: string | null;
  subjects: Array<{
    subjectName: string;
    fullMarks: number;
    passMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    grade: string | null;
    gpa: number | null;
    passed: boolean;
  }>;
  totalObtained: number;
  totalFull: number;
  percentage: number;
  gpa: number | null;
  grade: string | null;
  rank: number | null;
  sectionRank?: number | null;
  passed: boolean;
};

type ReportCardInput = {
  exam: { name: string; type: string; startDate: string | null; endDate: string | null };
  organisation: { name: string; address: string | null; phone: string | null; email: string | null; website: string | null; primaryColor: string | null } | null;
  row: ReportCardRow;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function buildReportCardHtml({ exam, organisation, row }: ReportCardInput) {
  const accent = /^#[0-9a-f]{6}$/i.test(organisation?.primaryColor ?? "") ? organisation!.primaryColor! : "#2563eb";
  const schoolName = organisation?.name ?? "Nucleus Education";
  const contact = [organisation?.address, organisation?.phone, organisation?.email, organisation?.website].filter(Boolean).join(" · ");
  const rankLabel = row.rank === null ? "—" : String(row.rank);

  const subjectRows = row.subjects
    .map((subject) => {
      const marks = subject.isAbsent || subject.marksObtained === null ? "Absent" : String(subject.marksObtained);
      return `<tr>
        <td>${escapeHtml(subject.subjectName)}</td>
        <td class="num">${subject.fullMarks}</td>
        <td class="num">${subject.passMarks}</td>
        <td class="num strong">${marks}</td>
        <td class="num">${subject.grade ?? "—"}</td>
        <td class="num">${subject.gpa === null ? "—" : subject.gpa.toFixed(2)}</td>
        <td class="num ${subject.passed ? "pass" : "fail"}">${subject.isAbsent ? "Absent" : subject.passed ? "Pass" : "Fail"}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Report card · ${escapeHtml(row.studentName)}</title>
<style>
  :root { --accent: ${accent}; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; color: var(--ink); font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .sheet { width: 210mm; min-height: 297mm; margin: 18px auto; background: #fff; padding: 22mm 18mm; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.15); }
  .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid var(--accent); padding-bottom: 16px; }
  .school { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; }
  .contact { margin-top: 6px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  .doc { text-align: right; }
  .doc-title { font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); }
  .doc-exam { margin-top: 6px; font-size: 15px; font-weight: 700; }
  .doc-meta { margin-top: 4px; color: var(--muted); font-size: 11px; }
  .student { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 22px 0; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
  .label { font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); }
  .value { margin-top: 4px; font-size: 13px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: var(--accent); color: #fff; font-size: 9px; letter-spacing: 0.6px; text-transform: uppercase; padding: 9px 10px; text-align: left; }
  td { border-bottom: 1px solid var(--line); padding: 9px 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; }
  .strong { font-weight: 800; }
  .pass { color: #047857; font-weight: 700; }
  .fail { color: #be123c; font-weight: 700; }
  .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 20px; }
  .card { border: 1px solid var(--line); border-radius: 10px; padding: 12px; text-align: center; }
  .card .value { font-size: 18px; }
  .status { margin-top: 18px; border-radius: 10px; padding: 12px 14px; font-weight: 800; letter-spacing: 0.4px; background: ${row.passed ? "#ecfdf5" : "#fff1f2"}; color: ${row.passed ? "#047857" : "#be123c"}; }
  .foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 42px; font-size: 10px; color: var(--muted); }
  .sign { border-top: 1px solid #94a3b8; padding-top: 6px; width: 180px; text-align: center; }
  .actions { width: 210mm; margin: 0 auto 24px; display: flex; justify-content: flex-end; }
  .actions button { border: 0; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 700; padding: 10px 18px; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 14mm; }
    .actions { display: none; }
  }
</style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <main class="sheet">
    <header class="top">
      <div>
        <div class="school">${escapeHtml(schoolName)}</div>
        <div class="contact">${escapeHtml(contact || "Student report card")}</div>
      </div>
      <div class="doc">
        <div class="doc-title">Report card</div>
        <div class="doc-exam">${escapeHtml(exam.name)}</div>
        <div class="doc-meta">${escapeHtml(exam.type.replaceAll("_", " "))} · ${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}</div>
      </div>
    </header>

    <section class="student">
      <div><div class="label">Student</div><div class="value">${escapeHtml(row.studentName)}</div></div>
      <div><div class="label">Class</div><div class="value">${escapeHtml(row.className ?? "—")}${row.sectionName ? ` · ${escapeHtml(row.sectionName)}` : ""}</div></div>
      <div><div class="label">Roll no.</div><div class="value">${row.rollNumber ?? "—"}</div></div>
      <div><div class="label">Rank</div><div class="value">${escapeHtml(rankLabel)}</div></div>
    </section>

    <table>
      <thead>
        <tr><th>Subject</th><th class="num">Full</th><th class="num">Pass</th><th class="num">Obtained</th><th class="num">Grade</th><th class="num">GPA</th><th class="num">Result</th></tr>
      </thead>
      <tbody>${subjectRows || `<tr><td colspan="7">No marks recorded.</td></tr>`}</tbody>
    </table>

    <section class="summary">
      <div class="card"><div class="label">Total</div><div class="value">${row.totalObtained}<span style="font-size:11px;color:#64748b"> / ${row.totalFull}</span></div></div>
      <div class="card"><div class="label">Percentage</div><div class="value">${row.percentage.toFixed(2)}%</div></div>
      <div class="card"><div class="label">GPA</div><div class="value">${row.gpa === null ? "—" : row.gpa.toFixed(2)}</div></div>
      <div class="card"><div class="label">Grade</div><div class="value">${escapeHtml(row.grade ?? "—")}</div></div>
      <div class="card"><div class="label">Rank</div><div class="value">${escapeHtml(rankLabel)}</div></div>
    </section>

    <div class="status">${row.passed ? "PASSED" : "NOT PASSED"}</div>

    <footer class="foot">
      <div class="sign">Class teacher</div>
      <div class="sign">Principal</div>
      <div>Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
    </footer>
  </main>
</body>
</html>`;
}
