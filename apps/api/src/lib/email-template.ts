export type EmailTemplateSeed = {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
};

export const EMAIL_TEMPLATE_KEYS = [
  "bulk_message",
  "notice",
  "password_reset",
  "invoice",
  "attendance_alert",
  "low_attendance",
  "assignment_submitted",
  "assignment_graded",
  "exam_published",
  "leave_status",
  "account_created",
  "default",
] as const;

export const EMAIL_TEMPLATE_VARIABLES = [
  "title",
  "body",
  "schoolName",
  "recipientName",
  "appUrl",
  "date",
] as const;

function shell(title: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0"><p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px">{{schoolName}}</p><h1 style="margin:0 0 16px;color:#0f172a;font-size:22px">${title}</h1><div style="color:#334155;font-size:14px;line-height:1.6">${body}</div><p style="margin:32px 0 0;color:#94a3b8;font-size:12px">This message was sent by {{schoolName}}.</p></div></div>`;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    key: "bulk_message",
    name: "Bulk broadcast",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "notice",
    name: "Notice published",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "password_reset",
    name: "Password reset",
    subject: "Reset your {{schoolName}} password",
    htmlBody: shell("Reset your password", '<p>Hello {{recipientName}},</p><p>Use the link below to choose a new password. It expires in 15 minutes.</p><p><a href="{{body}}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p><p style="color:#64748b;font-size:12px">If you did not request this, you can ignore this email.</p>'),
    textBody: "Hello {{recipientName}},\n\nReset your password: {{body}}\n\nThis link expires in 15 minutes.",
  },
  {
    key: "invoice",
    name: "Invoice issued",
    subject: "New invoice from {{schoolName}}",
    htmlBody: shell("New invoice", "<p>Hello {{recipientName}},</p><p>{{body}}</p>"),
    textBody: "Hello {{recipientName}},\n\n{{body}}",
  },
  {
    key: "attendance_alert",
    name: "Attendance alert",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "low_attendance",
    name: "Low attendance warning",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "assignment_submitted",
    name: "Assignment submitted",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "assignment_graded",
    name: "Assignment graded",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "exam_published",
    name: "Exam results published",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "leave_status",
    name: "Leave request update",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
  {
    key: "account_created",
    name: "Account provisioned",
    subject: "Your {{schoolName}} account",
    htmlBody: shell("Your account is ready", "<p>Hello {{recipientName}},</p><p>{{body}}</p>"),
    textBody: "Hello {{recipientName}},\n\n{{body}}",
  },
  {
    key: "default",
    name: "Default notification",
    subject: "{{title}}",
    htmlBody: shell("{{title}}", "<p>{{body}}</p>"),
    textBody: "{{title}}\n\n{{body}}",
  },
];

export type EmailVariables = Record<string, string | number | null | undefined>;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function valueFor(key: string, vars: EmailVariables) {
  return vars[key] === null || vars[key] === undefined ? "" : String(vars[key]);
}

export function renderEmailSubject(template: string, vars: EmailVariables) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => valueFor(key, vars));
}

export function renderEmailHtml(template: string, vars: EmailVariables) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => escapeHtml(valueFor(key, vars)).replace(/\r?\n/g, "<br />"));
}

export function renderEmailText(template: string, vars: EmailVariables) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => valueFor(key, vars));
}
