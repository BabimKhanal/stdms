import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EMAIL_TEMPLATES, renderEmailHtml, renderEmailSubject, renderEmailText } from "../src/lib/email-template";

test("email templates render and escape variables", () => {
  const vars = {
    title: "Hello <Admin>",
    body: "Line 1\nLine 2",
    schoolName: "Springfield",
    recipientName: "Aarav",
    appUrl: "https://example.com",
    date: "2026-11-02",
  };
  assert.equal(renderEmailSubject("{{title}}", vars), "Hello <Admin>");
  assert.equal(renderEmailHtml("{{title}}", vars), "Hello &lt;Admin&gt;");
  assert.equal(renderEmailHtml("<p>{{body}}</p>", vars), "<p>Line 1<br />Line 2</p>");
  assert.equal(renderEmailText("{{title}}\n\n{{body}}", vars), "Hello <Admin>\n\nLine 1\nLine 2");
});

test("email template seed includes defaults used by notifications", () => {
  const keys = new Set(DEFAULT_EMAIL_TEMPLATES.map((template) => template.key));
  for (const key of ["bulk_message", "notice", "password_reset", "default"]) assert.ok(keys.has(key));
});
