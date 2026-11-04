import assert from "node:assert/strict";
import test from "node:test";
import { examSubjectInputSchema, markEntrySchema } from "@edu/shared";

test("exam subject validation keeps pass marks within full marks", () => {
  const result = examSubjectInputSchema.safeParse({
    classId: "00000000-0000-4000-8000-000000000001",
    subjectId: "00000000-0000-4000-8000-000000000002",
    fullMarks: 100,
    passMarks: 101,
  });
  assert.equal(result.success, false);
});

test("exam subject validation keeps component marks within full marks", () => {
  const result = examSubjectInputSchema.safeParse({
    classId: "00000000-0000-4000-8000-000000000001",
    subjectId: "00000000-0000-4000-8000-000000000002",
    fullMarks: 100,
    passMarks: 35,
    theoryMarks: 70,
    practicalMarks: 20,
    internalMarks: 20,
  });
  assert.equal(result.success, false);
});

test("mark entry validation supports absent students without accepting negative marks", () => {
  const absent = markEntrySchema.safeParse({
    examSubjectId: "00000000-0000-4000-8000-000000000003",
    marks: [{ studentId: "00000000-0000-4000-8000-000000000004", marksObtained: null }],
  });
  const negative = markEntrySchema.safeParse({
    examSubjectId: "00000000-0000-4000-8000-000000000003",
    marks: [{ studentId: "00000000-0000-4000-8000-000000000004", marksObtained: -1 }],
  });
  assert.equal(absent.success, true);
  assert.equal(negative.success, false);
});
