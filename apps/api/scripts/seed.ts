/**
 * Seeds the database with a complete demo institution so every screen in the
 * web app has realistic data on first run.
 *
 * Usage: npm run db:seed
 * Safe to re-run: it wipes and recreates the demo organisation.
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_ROLES, FEATURE_FLAGS, RESOURCES, ACTIONS } from "@edu/shared";
import { ownerPool, makeDb } from "../src/db/client";
import * as t from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const db = makeDb(ownerPool);

function must<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`Seed failed: ${what} not found`);
  return row;
}

async function main() {
  const email = (s: string) => `${s}@greenwood.edu.np`;
  const pw = (s: string) => hashPassword(s);

  console.log("→ wiping previous demo data...");
  // Order respects FK dependencies. Platform admin lives outside any org.
  await db.delete(t.auditLogs);
  await db.delete(t.featureFlags);
  await db.delete(t.pushTokens);
  await db.delete(t.notifications);
  await db.delete(t.files);
  await db.delete(t.marks);
  await db.delete(t.examSubjects);
  await db.delete(t.exams);
  await db.delete(t.gradingScaleBands);
  await db.delete(t.gradingScales);
  await db.delete(t.discounts);
  await db.delete(t.payments);
  await db.delete(t.invoiceItems);
  await db.delete(t.invoices);
  await db.delete(t.feeStructureItems);
  await db.delete(t.feeStructures);
  await db.delete(t.feeCategories);
  await db.delete(t.events);
  await db.delete(t.noticeAudiences);
  await db.delete(t.notices);
  await db.delete(t.homeworkSubmissions);
  await db.delete(t.homework);
  await db.delete(t.leaveRequests);
  await db.delete(t.attendanceRecords);
  await db.delete(t.timetableSlots);
  await db.delete(t.timetablePeriods);
  await db.delete(t.enrolments);
  await db.delete(t.classSubjects);
  await db.delete(t.subjects);
  await db.delete(t.sections);
  await db.delete(t.classes);
  await db.delete(t.terms);
  await db.delete(t.academicYears);
  await db.delete(t.userRoles);
  await db.delete(t.rolePermissions);
  await db.delete(t.users);
  await db.delete(t.studentGuardians);
  await db.delete(t.guardians);
  await db.delete(t.students);
  await db.delete(t.employees);
  await db.delete(t.roles);
  await db.delete(t.organisations);

  console.log("→ permission catalogue...");
  await db
    .insert(t.permissions)
    .values(
      RESOURCES.flatMap((resource) =>
        ACTIONS.map((action) => ({
          resource,
          action,
          name: `${resource} ${action}`,
        })),
      ),
    )
    .onConflictDoNothing();

  console.log("→ demo institution...");
  const [org] = await db
    .insert(t.organisations)
    .values({
      name: "Greenwood Academy",
      slug: "greenwood",
      registrationNumber: "SCH-2026-0451",
      address: "Lakeside-6, Pokhara, Kaski, Nepal",
      phone: "+977-61-456789",
      email: "info@greenwood.edu.np",
      website: "https://greenwood.edu.np",
      academicType: "school",
      country: "Nepal",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a",
      status: "active",
      plan: "growth",
      maxStudents: 2000,
      maxUsers: 300,
    })
    .returning();

  await db.insert(t.featureFlags).values(
    FEATURE_FLAGS.map((flag) => ({ organisationId: org.id, flag, enabled: true })),
  );

  console.log("→ roles + role permissions...");
  const allPerms = await db.select().from(t.permissions);
  const permId = (key: string) => {
    const [resource, action] = key.split(".");
    return must(
      allPerms.find((p) => p.resource === resource && p.action === action),
      `permission ${key}`,
    ).id;
  };

  const roleRows: (typeof t.roles.$inferInsert)[] = Object.entries(DEFAULT_ROLES).map(
    ([key, role]) => ({
      organisationId: org.id,
      key,
      name: role.name,
      description: role.description,
      isSystem: true,
    }),
  );
  const insertedRoles = await db.insert(t.roles).values(roleRows).returning();

  const roleByKey = new Map(insertedRoles.map((r) => [r.key, r]));
  await db.insert(t.rolePermissions).values(
    Object.entries(DEFAULT_ROLES).flatMap(([key, role]) =>
      [...new Set(role.permissions)].map((p) => ({
        roleId: must(roleByKey.get(key), `role ${key}`).id,
        permissionId: permId(p),
      })),
    ),
  );

  console.log("→ platform admin...");
  await db.insert(t.users).values({
    name: "Platform Super Admin",
    email: "admin@yourplatform.com",
    username: "superadmin",
    passwordHash: await pw("Platform@123"),
    organisationId: null,
    isPlatformAdmin: true,
  });

  console.log("→ academic year, terms, classes, sections, subjects...");
  const [year] = await db
    .insert(t.academicYears)
    .values({
      organisationId: org.id,
      name: "2026/27",
      startDate: "2026-04-14",
      endDate: "2027-04-13",
      isCurrent: true,
    })
    .returning();
  await db.update(t.organisations).set({ currentAcademicYearId: year.id }).where(eq(t.organisations.id, org.id));

  const [term1] = await db
    .insert(t.terms)
    .values([
      { organisationId: org.id, academicYearId: year.id, name: "Term 1", startDate: "2026-04-14", endDate: "2026-08-31" },
      { organisationId: org.id, academicYearId: year.id, name: "Term 2", startDate: "2026-09-01", endDate: "2026-12-31" },
      { organisationId: org.id, academicYearId: year.id, name: "Term 3", startDate: "2027-01-01", endDate: "2027-04-13" },
    ])
    .returning();

  const classRows = await db
    .insert(t.classes)
    .values([
      { organisationId: org.id, name: "Grade 6", numericLevel: 6 },
      { organisationId: org.id, name: "Grade 7", numericLevel: 7 },
      { organisationId: org.id, name: "Grade 8", numericLevel: 8 },
    ])
    .returning();
  const grade6 = must(classRows.find((c) => c.name === "Grade 6"), "Grade 6");
  const grade7 = must(classRows.find((c) => c.name === "Grade 7"), "Grade 7");
  const grade8 = must(classRows.find((c) => c.name === "Grade 8"), "Grade 8");

  const sectionRows = await db
    .insert(t.sections)
    .values(
      classRows.flatMap((cls) =>
        ["A", "B"].map((name) => ({ organisationId: org.id, classId: cls.id, name })),
      ),
    )
    .returning();
  const sec = (cls: string, name: string) =>
    must(
      sectionRows.find((s) => s.classId === cls && s.name === name),
      `section ${cls}-${name}`,
    );

  const subjectRows = await db
    .insert(t.subjects)
    .values([
      { organisationId: org.id, name: "Mathematics", code: "MATH", type: "theory", creditHours: 4 },
      { organisationId: org.id, name: "English", code: "ENG", type: "theory", creditHours: 4 },
      { organisationId: org.id, name: "Science", code: "SCI", type: "both", creditHours: 4 },
      { organisationId: org.id, name: "Nepali", code: "NEP", type: "theory", creditHours: 4 },
      { organisationId: org.id, name: "Social Studies", code: "SST", type: "theory", creditHours: 3 },
      { organisationId: org.id, name: "Computer Science", code: "CS", type: "practical", creditHours: 3 },
    ])
    .returning();
  const subj = (code: string) => must(subjectRows.find((s) => s.code === code), `subject ${code}`);

  console.log("→ employees...");
  const employeeRows = await db
    .insert(t.employees)
    .values([
      {
        organisationId: org.id, employeeId: "EMP-001", fullName: "Prakash Sharma",
        department: "Mathematics", designation: "Senior Teacher", joiningDate: "2019-04-01",
        qualification: "M.Sc. Mathematics", phone: "9841234567", email: email("prakash"),
        staffType: "teaching", employmentType: "full_time", salary: "55000.00",
      },
      {
        organisationId: org.id, employeeId: "EMP-002", fullName: "Sita Rai",
        department: "English", designation: "Teacher", joiningDate: "2021-04-01",
        qualification: "M.A. English", phone: "9841234568", email: email("sita"),
        staffType: "teaching", employmentType: "full_time", salary: "48000.00",
      },
      {
        organisationId: org.id, employeeId: "EMP-003", fullName: "Bikash Gurung",
        department: "Administration", designation: "Accountant", joiningDate: "2022-01-15",
        qualification: "BBS", phone: "9841234569", email: email("bikeash"),
        staffType: "administrative", employmentType: "full_time", salary: "42000.00",
      },
    ])
    .returning();
  const emp = (code: string) => must(employeeRows.find((e) => e.employeeId === code), `employee ${code}`);
  const prakash = emp("EMP-001");
  const sita = emp("EMP-002");

  await db.update(t.classes).set({ classTeacherId: prakash.id }).where(eq(t.classes.id, grade7.id));
  await db.update(t.sections).set({ classTeacherId: prakash.id }).where(eq(t.sections.id, sec(grade7.id, "A").id));

  console.log("→ class-subject allocations...");
  const allocations: (typeof t.classSubjects.$inferInsert)[] = [];
  for (const cls of classRows) {
    const teacherFor: Record<string, string | null> = {
      MATH: prakash.id, ENG: sita.id, SCI: sita.id, NEP: prakash.id, SST: sita.id, CS: prakash.id,
    };
    for (const s of subjectRows) {
      allocations.push({
        organisationId: org.id, classId: cls.id, subjectId: s.id,
        teacherId: teacherFor[s.code ?? ""] ?? null,
      });
    }
  }
  await db.insert(t.classSubjects).values(allocations);

  console.log("→ students, guardians, enrolments...");
  type SeedStudent = { code: string; first: string; last: string; gender: "male" | "female"; cls: string; roll: number };
  const seedStudents: SeedStudent[] = [
    { code: "ST-1001", first: "Aarav", last: "Sharma", gender: "male", cls: grade6.id, roll: 1 },
    { code: "ST-1002", first: "Anisha", last: "Sharma", gender: "female", cls: grade7.id, roll: 2 },
    { code: "ST-1003", first: "Riya", last: "Thapa", gender: "female", cls: grade7.id, roll: 1 },
    { code: "ST-1004", first: "Bikash", last: "Rai", gender: "male", cls: grade7.id, roll: 3 },
    { code: "ST-1005", first: "Nima", last: "Lama", gender: "male", cls: grade7.id, roll: 4 },
    { code: "ST-1006", first: "Sujata", last: "Karki", gender: "female", cls: grade7.id, roll: 5 },
    { code: "ST-1007", first: "Dipesh", last: "Magar", gender: "male", cls: grade7.id, roll: 6 },
    { code: "ST-1008", first: "Prakriti", last: "Basnet", gender: "female", cls: grade7.id, roll: 7 },
    { code: "ST-1009", first: "Sagar", last: "Tamang", gender: "male", cls: grade6.id, roll: 2 },
    { code: "ST-1010", first: "Aayush", last: "Poudel", gender: "male", cls: grade6.id, roll: 3 },
    { code: "ST-1011", first: "Shreya", last: "Ghimire", gender: "female", cls: grade6.id, roll: 4 },
    { code: "ST-1012", first: "Rohan", last: "Adhikari", gender: "male", cls: grade8.id, roll: 1 },
    { code: "ST-1013", first: "Sanjana", last: "Bista", gender: "female", cls: grade8.id, roll: 2 },
    { code: "ST-1014", first: "Nishant", last: "KC", gender: "male", cls: grade8.id, roll: 3 },
  ];

  const studentRows = await db
    .insert(t.students)
    .values(
      seedStudents.map((s, i) => ({
        organisationId: org.id,
        studentId: s.code,
        admissionNumber: `ADM-${2026}-${String(i + 1).padStart(3, "0")}`,
        firstName: s.first,
        lastName: s.last,
        gender: s.gender,
        dateOfBirth: ["2014-05-12", "2013-08-02", "2013-01-15", "2013-11-20", "2013-06-30", "2013-09-11",
          "2013-03-04", "2013-12-25", "2014-02-17", "2014-07-08", "2014-10-01", "2012-04-19", "2012-08-27", "2012-01-30"][i],
        nationality: "Nepali",
        address: "Lakeside, Pokhara",
        phone: `98412345${String(70 + i)}`,
        admissionDate: "2026-04-14",
        status: "active" as const,
      })),
    )
    .returning();
  const studentByCode = (code: string) =>
    must(studentRows.find((s) => s.studentId === code), `student ${code}`);

  await db.insert(t.enrolments).values(
    seedStudents.map((s) => {
      const student = studentByCode(s.code);
      const section =
        s.cls === grade7.id
          ? s.code === "ST-1003" || s.roll > 4
            ? sec(grade7.id, "B")
            : sec(grade7.id, "A")
          : s.cls === grade6.id
            ? sec(grade6.id, "A")
            : sec(grade8.id, "A");
      return {
        organisationId: org.id,
        studentId: student.id,
        academicYearId: year.id,
        classId: s.cls,
        sectionId: section.id,
        rollNumber: s.roll,
      };
    }),
  );

  const guardianRows = await db
    .insert(t.guardians)
    .values([
      { organisationId: org.id, fullName: "Rajesh Sharma", relationship: "father" as const, phone: "9841000001", occupation: "Engineer", email: email("rajesh") },
      { organisationId: org.id, fullName: "Mingma Sherpa", relationship: "mother" as const, phone: "9841000002", occupation: "Teacher", email: email("mingma") },
      { organisationId: org.id, fullName: "Hari Prasad", relationship: "father" as const, phone: "9841000003", occupation: "Business", email: email("hari") },
      { organisationId: org.id, fullName: "Kabita Thapa", relationship: "mother" as const, phone: "9841000004", occupation: "Nurse", email: email("kabita") },
    ])
    .returning();
  const g = (name: string) =>
    must(guardianRows.find((x) => x.fullName === name), `guardian ${name}`);

  // Sharma siblings share BOTH parents → the "switch child without logout" demo.
  await db.insert(t.studentGuardians).values([
    { organisationId: org.id, studentId: studentByCode("ST-1001").id, guardianId: g("Rajesh Sharma").id, isPrimary: true },
    { organisationId: org.id, studentId: studentByCode("ST-1001").id, guardianId: g("Mingma Sherpa").id },
    { organisationId: org.id, studentId: studentByCode("ST-1002").id, guardianId: g("Rajesh Sharma").id, isPrimary: true },
    { organisationId: org.id, studentId: studentByCode("ST-1002").id, guardianId: g("Mingma Sherpa").id },
    { organisationId: org.id, studentId: studentByCode("ST-1003").id, guardianId: g("Hari Prasad").id, isPrimary: true },
    { organisationId: org.id, studentId: studentByCode("ST-1003").id, guardianId: g("Kabita Thapa").id },
    { organisationId: org.id, studentId: studentByCode("ST-1004").id, guardianId: g("Hari Prasad").id, isPrimary: true },
  ]);

  console.log("→ user accounts...");
  const roleOf = (key: string) => must(roleByKey.get(key), `role ${key}`);
  async function makeUser(opts: {
    name: string; username: string; password: string; roleKeys: string[];
    employeeId?: string; studentId?: string; guardianId?: string;
  }) {
    const [u] = await db
      .insert(t.users)
      .values({
        organisationId: org.id,
        name: opts.name,
        email: email(opts.username),
        username: opts.username,
        passwordHash: await pw(opts.password),
        employeeId: opts.employeeId ?? null,
        studentId: opts.studentId ?? null,
        guardianId: opts.guardianId ?? null,
      })
      .returning();
    await db.insert(t.userRoles).values(
      opts.roleKeys.map((key) => ({ userId: u.id, roleId: roleOf(key).id })),
    );
    return u;
  }

  const adminUser = await makeUser({ name: "Ramesh Adhikari", username: "owner", password: "Owner@123", roleKeys: ["owner"] });
  await makeUser({ name: "Sarita Devi", username: "principal", password: "Principal@123", roleKeys: ["principal"] });
  const johnAdmin = await makeUser({ name: "John Admin", username: "admin", password: "Admin@123", roleKeys: ["administrator"] });
  const prakashUser = await makeUser({ name: "Prakash Sharma", username: "prakash", password: "Teacher@123", roleKeys: ["teacher", "class_teacher"], employeeId: prakash.id });
  const sitaUser = await makeUser({ name: "Sita Rai", username: "sita", password: "Teacher@123", roleKeys: ["teacher"], employeeId: sita.id });
  await makeUser({ name: "Bikash Gurung", username: "accountant", password: "Accountant@123", roleKeys: ["accountant"], employeeId: emp("EMP-003").id });
  await makeUser({ name: "Exam Cell", username: "examcell", password: "Exam@123", roleKeys: ["exam_officer"] });
  await makeUser({ name: "Aarav Sharma", username: "ST-1001", password: "Student@123", roleKeys: ["student"], studentId: studentByCode("ST-1001").id });
  await makeUser({ name: "Rajesh Sharma", username: "parent", password: "Parent@123", roleKeys: ["parent"], guardianId: g("Rajesh Sharma").id });

  console.log("→ timetable periods + slots...");
  const periodDefs = [
    { name: "Period 1", startTime: "08:00", endTime: "08:45", isBreak: false, orderIndex: 0 },
    { name: "Period 2", startTime: "08:45", endTime: "09:30", isBreak: false, orderIndex: 1 },
    { name: "Period 3", startTime: "09:30", endTime: "10:15", isBreak: false, orderIndex: 2 },
    { name: "Break", startTime: "10:15", endTime: "10:30", isBreak: true, orderIndex: 3 },
    { name: "Period 4", startTime: "10:30", endTime: "11:15", isBreak: false, orderIndex: 4 },
    { name: "Period 5", startTime: "11:15", endTime: "12:00", isBreak: false, orderIndex: 5 },
    { name: "Lunch", startTime: "12:00", endTime: "13:00", isBreak: true, orderIndex: 6 },
    { name: "Period 6", startTime: "13:00", endTime: "13:45", isBreak: false, orderIndex: 7 },
    { name: "Period 7", startTime: "13:45", endTime: "14:30", isBreak: false, orderIndex: 8 },
  ];
  const periodRows = await db
    .insert(t.timetablePeriods)
    .values(periodDefs.map((p) => ({ organisationId: org.id, ...p })))
    .returning();
  const studyPeriods = periodRows.filter((p) => !p.isBreak);

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const weekRotation = [subj("MATH"), subj("ENG"), subj("SCI"), subj("NEP"), subj("SST"), subj("CS")];
  const slotValues: (typeof t.timetableSlots.$inferInsert)[] = [];
  for (const sectionId of [
    sec(grade6.id, "A").id, sec(grade7.id, "A").id, sec(grade8.id, "A").id,
  ]) {
    const classOf =
      sectionId === sec(grade6.id, "A").id ? grade6 : sectionId === sec(grade7.id, "A").id ? grade7 : grade8;
    for (const day of days) {
      studyPeriods.forEach((period, idx) => {
        const subject = weekRotation[(idx + day.length + classOf.numericLevel!) % weekRotation.length];
        const teacher = subject.code === "MATH" ? prakash.id : subject.code === "ENG" || subject.code === "SCI" ? sita.id : prakash.id;
        slotValues.push({
          organisationId: org.id,
          sectionId,
          day,
          periodId: period.id,
          subjectId: subject.id,
          teacherId: teacher,
          room: `R-${classOf.numericLevel}${sectionId === sec(grade7.id, "A").id ? "A" : "1"}`,
        });
      });
    }
  }
  await db.insert(t.timetableSlots).values(slotValues);

  console.log("→ attendance (last 10 school days)...");
  const attendanceValues: (typeof t.attendanceRecords.$inferInsert)[] = [];
  const dates: string[] = [];
  const d = new Date();
  for (let i = 0; i < 14 && dates.length < 10; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    dates.push(day.toISOString().slice(0, 10));
  }
  const classTeachers = { markedBy: prakashUser.id };
  for (const s of seedStudents) {
    const student = studentByCode(s.code);
    const section =
      s.cls === grade7.id
        ? s.code === "ST-1003" || s.roll > 4
          ? sec(grade7.id, "B")
          : sec(grade7.id, "A")
        : s.cls === grade6.id
          ? sec(grade6.id, "A")
          : sec(grade8.id, "A");
    dates.forEach((date, idx) => {
      const roll = (s.roll * 7 + idx * 3) % 10;
      const status = roll === 0 ? "absent" : roll === 1 ? "late" : roll === 2 && idx % 3 === 0 ? "excused" : "present";
      attendanceValues.push({
        organisationId: org.id,
        studentId: student.id,
        classId: s.cls,
        sectionId: section.id,
        date,
        status: status as "present" | "absent" | "late" | "excused",
        ...classTeachers,
      });
    });
  }
  await db.insert(t.attendanceRecords).values(attendanceValues);

  console.log("→ leave request, homework, notices, events...");
  await db.insert(t.leaveRequests).values({
    organisationId: org.id,
    applicantType: "student",
    studentId: studentByCode("ST-1004").id,
    type: "sick",
    reason: "Fever, doctor advised rest for two days.",
    fromDate: dates[1],
    toDate: dates[2],
    status: "pending",
  });

  const [hw1] = await db
    .insert(t.homework)
    .values([
      {
        organisationId: org.id, classId: grade7.id, sectionId: sec(grade7.id, "A").id,
        subjectId: subj("MATH").id, teacherId: prakashUser.id,
        title: "Linear Equations Practice Set 4", description: "Solve exercises 4.1 to 4.3, show all steps clearly.",
        assignedDate: dates[4], submissionDate: dates[1], maxMarks: 20,
      },
      {
        organisationId: org.id, classId: grade7.id, sectionId: sec(grade7.id, "A").id,
        subjectId: subj("ENG").id, teacherId: sitaUser.id,
        title: "Essay: My Vision for Nepal", description: "500 words, own words, neat handwriting or typed.",
        assignedDate: dates[5], submissionDate: dates[0], maxMarks: 15,
      },
    ])
    .returning();

  await db.insert(t.homeworkSubmissions).values({
    organisationId: org.id,
    homeworkId: hw1.id,
    studentId: studentByCode("ST-1003").id,
    content: "Completed all three exercises in my notebook.",
    status: "submitted",
    submittedAt: new Date(),
  });
  await db.insert(t.homeworkSubmissions).values({
    organisationId: org.id,
    homeworkId: hw1.id,
    studentId: studentByCode("ST-1005").id,
    content: "Solved 4.1 and 4.2, 4.3 pending.",
    status: "late",
    submittedAt: new Date(),
  });

  const ownerUser = johnAdmin;
  const noticeRows = await db
    .insert(t.notices)
    .values([
      {
        organisationId: org.id, title: "Dashain Holiday Notice",
        body: "The school will remain closed from 20 October for 10 days. Classes resume on 31 October.",
        priority: "high" as const, authorId: ownerUser.id,
      },
      {
        organisationId: org.id, title: "Parent-Teacher Meeting",
        body: "PTM for Grade 6-8 will be held on Saturday, 9 AM - 12 PM. Parents are requested to attend.",
        priority: "normal" as const, authorId: ownerUser.id,
      },
    ])
    .returning();
  await db.insert(t.noticeAudiences).values([
    { organisationId: org.id, noticeId: noticeRows[0].id, audienceType: "everyone" },
    { organisationId: org.id, noticeId: noticeRows[1].id, audienceType: "parents" },
    { organisationId: org.id, noticeId: noticeRows[1].id, audienceType: "class", audienceId: grade7.id },
  ]);

  await db.insert(t.events).values({
    organisationId: org.id,
    title: "Annual Sports Day",
    description: "Inter-house track and field events. Parents welcome.",
    startDate: dates[6],
    startTime: "09:00",
    endTime: "15:00",
    venue: "School Playground",
    audiences: ["everyone"],
    createdBy: ownerUser.id,
  });

  console.log("→ fees: categories, structures, invoices, payments...");
  const feeCats = await db
    .insert(t.feeCategories)
    .values([
      { organisationId: org.id, name: "Admission Fee" },
      { organisationId: org.id, name: "Tuition Fee" },
      { organisationId: org.id, name: "Examination Fee" },
      { organisationId: org.id, name: "Transport Fee" },
      { organisationId: org.id, name: "Library Fee" },
    ])
    .returning();
  const feeCat = (name: string) => must(feeCats.find((c) => c.name === name), `fee cat ${name}`);

  const feeStructure = await (async () => {
    const [fs] = await db
      .insert(t.feeStructures)
      .values({
        organisationId: org.id, name: "Grade 7 - 2026/27",
        academicYearId: year.id, classId: grade7.id,
      })
      .returning();
    await db.insert(t.feeStructureItems).values([
      { organisationId: org.id, feeStructureId: fs.id, feeCategoryId: feeCat("Tuition Fee").id, name: "Tuition (Term 1)", amount: "18000.00", frequency: "quarterly" },
      { organisationId: org.id, feeStructureId: fs.id, feeCategoryId: feeCat("Examination Fee").id, name: "Mid-Term Exam", amount: "1500.00", frequency: "one_time" },
      { organisationId: org.id, feeStructureId: fs.id, feeCategoryId: feeCat("Library Fee").id, name: "Library (Annual)", amount: "1000.00", frequency: "annual" },
    ]);
    return fs;
  })();

  // One invoice per Grade-7 student with a partial payment on two of them.
  const grade7Students = seedStudents.filter((s) => s.cls === grade7.id);
  for (const s of grade7Students) {
    const student = studentByCode(s.code);
    const items = [
      { name: "Tuition (Term 1)", amount: "18000.00" },
      { name: "Mid-Term Exam", amount: "1500.00" },
      { name: "Library (Annual)", amount: "1000.00" },
    ];
    const subtotal = 20500;
    const discount = s.code === "ST-1006" ? 2000 : 0;
    const total = subtotal - discount;
    const [inv] = await db
      .insert(t.invoices)
      .values({
        organisationId: org.id,
        invoiceNumber: `INV-2026-${s.code.slice(-4)}`,
        studentId: student.id,
        issueDate: "2026-04-14",
        dueDate: "2026-10-20",
        status: "unpaid",
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        fine: "0.00",
        total: total.toFixed(2),
        paid: "0.00",
        createdBy: ownerUser.id,
      })
      .returning();
    await db.insert(t.invoiceItems).values(
      items.map((i) => ({ organisationId: org.id, invoiceId: inv.id, ...i, dueDate: "2026-10-20" })),
    );
    if (discount > 0) {
      await db.insert(t.discounts).values({
        organisationId: org.id, invoiceId: inv.id, amount: "2000.00",
        reason: "Sibling discount", createdBy: ownerUser.id,
      });
    }
    if (s.code === "ST-1003" || s.code === "ST-1004") {
      const paidAmount = s.code === "ST-1003" ? total : 10000;
      await db.insert(t.payments).values({
        organisationId: org.id, invoiceId: inv.id, amount: paidAmount.toFixed(2),
        method: s.code === "ST-1003" ? "esewa" : "cash",
        reference: s.code === "ST-1003" ? "ESW-992811" : null,
        receivedBy: ownerUser.id,
      });
      await db.update(t.invoices).set({
        paid: paidAmount.toFixed(2),
        status: paidAmount >= total ? "paid" : "partial",
      }).where(eq(t.invoices.id, inv.id));
    }
  }
  void feeStructure;

  console.log("→ grading scale + mid-term exam with marks...");
  const [scale] = await db
    .insert(t.gradingScales)
    .values({ organisationId: org.id, name: "Default GPA Scale", isDefault: true })
    .returning();
  await db.insert(t.gradingScaleBands).values([
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "90", maxPercent: "100", grade: "A+", gpa: "4.0", remark: "Outstanding" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "80", maxPercent: "89.99", grade: "A", gpa: "3.6", remark: "Excellent" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "70", maxPercent: "79.99", grade: "B+", gpa: "3.2", remark: "Very Good" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "60", maxPercent: "69.99", grade: "B", gpa: "2.8", remark: "Good" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "50", maxPercent: "59.99", grade: "C", gpa: "2.4", remark: "Average" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "40", maxPercent: "49.99", grade: "D", gpa: "2.0", remark: "Needs Improvement" },
    { organisationId: org.id, gradingScaleId: scale.id, minPercent: "0", maxPercent: "39.99", grade: "F", gpa: "0.0", remark: "Fail" },
  ]);

  const [exam] = await db
    .insert(t.exams)
    .values({
      organisationId: org.id, name: "Mid-Term Examination 2026",
      type: "mid_term", termId: term1.id, academicYearId: year.id,
      startDate: dates[5], endDate: dates[2], status: "completed",
    })
    .returning();

  const examSubjects = await db
    .insert(t.examSubjects)
    .values([
      { organisationId: org.id, examId: exam.id, classId: grade7.id, subjectId: subj("MATH").id, fullMarks: 100, passMarks: 35, theoryMarks: 75, practicalMarks: 0, internalMarks: 25 },
      { organisationId: org.id, examId: exam.id, classId: grade7.id, subjectId: subj("ENG").id, fullMarks: 100, passMarks: 35, theoryMarks: 80, internalMarks: 20 },
      { organisationId: org.id, examId: exam.id, classId: grade7.id, subjectId: subj("SCI").id, fullMarks: 100, passMarks: 35, theoryMarks: 70, practicalMarks: 30 },
    ])
    .returning();

  const markValues: (typeof t.marks.$inferInsert)[] = [];
  for (const es of examSubjects) {
    for (const s of grade7Students) {
      const student = studentByCode(s.code);
      const base = 38 + ((s.roll * 13 + es.fullMarks) % 55); // deterministic 38..92
      markValues.push({
        organisationId: org.id,
        examSubjectId: es.id,
        studentId: student.id,
        marksObtained: base,
        isAbsent: false,
        enteredBy: ownerUser.id,
      });
    }
  }
  await db.insert(t.marks).values(markValues);

  console.log("→ audit sample...");
  await db.insert(t.auditLogs).values({
    organisationId: org.id,
    userId: ownerUser.id,
    userName: ownerUser.name,
    action: "seed",
    entity: "system",
    newValue: { message: "Demo data seeded" },
  });

  console.log("\n✓ Seed complete — demo logins (password in brackets):");
  console.log("  Platform admin   admin@yourplatform.com        [Platform@123]");
  console.log("  Owner            owner@greenwood.edu.np        [Owner@123]");
  console.log("  Principal        principal@greenwood.edu.np     [Principal@123]");
  console.log("  Administrator    admin@greenwood.edu.np         [Admin@123]");
  console.log("  Teacher          prakash@greenwood.edu.np       [Teacher@123]");
  console.log("  Accountant       accountant@greenwood.edu.np    [Accountant@123]");
  console.log("  Exam officer     examcell@greenwood.edu.np      [Exam_officer@123]");
  console.log("  Student (ST-1001) ST-1001                       [Student@123]");
  console.log("  Parent           parent@greenwood.edu.np        [Parent@123]");
}

main()
  .then(() => ownerPool.end())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await ownerPool.end();
    process.exit(1);
  });
