import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { DB } from "../../lib/types";
import {
  academicYears,
  classes,
  enrolments,
  guardians,
  sections,
  studentGuardians,
  students,
  roles,
  userRoles,
  users,
  organisations,
} from "../../db/schema";
import type { StudentInput, GuardianInput } from "@edu/shared";
import { conflict, notFound } from "../../lib/errors";
import { hashPassword } from "../../lib/password";
import { randomBytes } from "node:crypto";
import type { AuthUser } from "../../lib/context";
import { assertStudentAssigned, teacherScope } from "../../lib/teacher-scope";

type StudentRow = typeof students.$inferSelect;

function fullName(s: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}

function temporaryPassword() {
  return `Nuc-${randomBytes(5).toString("base64url")}`;
}

/* ------------------------------ Students ------------------------------ */

export type StudentListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
  academicYearId?: string;
  principal?: AuthUser;
};

const SORTABLE: Record<string, unknown> = {
  firstName: students.firstName,
  lastName: students.lastName,
  rollNumber: sql`${enrolments.rollNumber}`,
  admissionDate: students.admissionDate,
  createdAt: students.createdAt,
};

export async function listStudents(
  db: DB,
  orgId: string,
  f: StudentListFilters,
) {
  const conds = [eq(students.organisationId, orgId)];
  if (f.status) conds.push(eq(students.status, f.status as never));
  if (f.search) {
    const pattern = `%${f.search}%`;
    conds.push(
      or(
        ilike(students.firstName, pattern),
        ilike(students.lastName, pattern),
        ilike(students.studentId, pattern),
        ilike(students.admissionNumber, pattern),
      )!,
    );
  }
  if (f.classId) conds.push(eq(enrolments.classId, f.classId));
  if (f.sectionId) conds.push(eq(enrolments.sectionId, f.sectionId));

  if (f.principal) {
    const scope = teacherScope(
      f.principal,
      sql`${enrolments.classId}`,
      sql`${enrolments.sectionId}`,
    );
    if (scope) conds.push(scope as never);
  }
  const where = and(...conds);
  const sortCol = (SORTABLE[f.sort ?? "createdAt"] ??
    students.createdAt) as typeof students.createdAt;
  const order = f.order === "asc" ? sql`asc` : sql`desc`;

  const countRow = await db
    .select({ n: sql<number>`count(*)` })
    .from(students)
    .leftJoin(
      enrolments,
      and(
        eq(enrolments.studentId, students.id),
        f.academicYearId
          ? eq(enrolments.academicYearId, f.academicYearId)
          : sql`true`,
      ),
    )
    .where(where);
  const total = Number(countRow[0]?.n ?? 0);

  const rows = await db
    .select({
      id: students.id,
      studentId: students.studentId,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      photoUrl: students.photoUrl,
      dateOfBirth: students.dateOfBirth,
      gender: students.gender,
      bloodGroup: students.bloodGroup,
      nationality: students.nationality,
      address: students.address,
      phone: students.phone,
      email: students.email,
      admissionDate: students.admissionDate,
      status: students.status,
      rollNumber: enrolments.rollNumber,
      classId: enrolments.classId,
      sectionId: enrolments.sectionId,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(students)
    .leftJoin(
      enrolments,
      and(
        eq(enrolments.studentId, students.id),
        f.academicYearId
          ? eq(enrolments.academicYearId, f.academicYearId)
          : sql`true`,
      ),
    )
    .leftJoin(classes, eq(enrolments.classId, classes.id))
    .leftJoin(sections, eq(enrolments.sectionId, sections.id))
    .where(where)
    .orderBy(sql`${sortCol} ${order}`)
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  return {
    data: rows.map((r) => ({
      ...r,
      fullName: fullName(r),
      academicYearId: f.academicYearId ?? null,
    })),
    total,
  };
}

export async function getStudent(
  db: DB,
  orgId: string,
  id: string,
  principal?: AuthUser,
) {
  if (principal) await assertStudentAssigned(db, principal, orgId, id);
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.organisationId, orgId)))
    .limit(1);
  if (!student) throw notFound("Student not found");

  const history = await db
    .select({
      id: enrolments.id,
      academicYearId: enrolments.academicYearId,
      yearName: academicYears.name,
      classId: enrolments.classId,
      className: classes.name,
      sectionId: enrolments.sectionId,
      sectionName: sections.name,
      rollNumber: enrolments.rollNumber,
      promotionStatus: enrolments.promotionStatus,
    })
    .from(enrolments)
    .innerJoin(academicYears, eq(enrolments.academicYearId, academicYears.id))
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .leftJoin(sections, eq(enrolments.sectionId, sections.id))
    .where(
      and(eq(enrolments.studentId, id), eq(enrolments.organisationId, orgId)),
    )
    .orderBy(desc(academicYears.startDate));

  const guardianRows = await db
    .select({
      id: guardians.id,
      fullName: guardians.fullName,
      relationship: guardians.relationship,
      phone: guardians.phone,
      email: guardians.email,
      address: guardians.address,
      occupation: guardians.occupation,
      isPrimary: studentGuardians.isPrimary,
    })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(
      and(
        eq(studentGuardians.studentId, id),
        eq(studentGuardians.organisationId, orgId),
      ),
    );

  const current = history[0] ?? null;
  return {
    ...student,
    fullName: fullName(student),
    className: current?.className ?? null,
    sectionName: current?.sectionName ?? null,
    rollNumber: current?.rollNumber ?? null,
    classId: current?.classId ?? null,
    sectionId: current?.sectionId ?? null,
    academicYearId: current?.academicYearId ?? null,
    history,
    guardians: guardianRows,
  };
}

function cardEscape(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}
export async function identityCardHtml(
  db: DB,
  orgId: string,
  id: string,
  principal?: AuthUser,
) {
  const student = await getStudent(db, orgId, id, principal);
  const [organisation] = await db
    .select({
      name: organisations.name,
      logoUrl: organisations.logoUrl,
      address: organisations.address,
      phone: organisations.phone,
      email: organisations.email,
      primaryColor: organisations.primaryColor,
    })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Identity Card - ${cardEscape(student.fullName)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;background:#fff}.sheet{display:flex;gap:20px;flex-wrap:wrap}.card{width:86mm;height:54mm;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;position:relative;background:#fff;box-shadow:0 4px 14px #0f172a12}.band{height:12mm;background:${cardEscape(organisation?.primaryColor ?? "#2563eb")};color:#fff;padding:5px 10px;display:flex;align-items:center;gap:8px}.band img{width:24px;height:24px;object-fit:contain;background:#fff;border-radius:5px}.school{font-size:11px;font-weight:700}.sub{font-size:7px;opacity:.85;margin-top:2px}.body{display:flex;gap:9px;padding:9px}.photo{width:24mm;height:30mm;object-fit:cover;border:1px solid #dbe3ef;border-radius:5px}.placeholder{width:24mm;height:30mm;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:24px;font-weight:700;border-radius:5px}.details{font-size:8px;line-height:1.65;min-width:0}.details strong{display:block;font-size:12px;line-height:1.2;margin-bottom:3px}.label{color:#64748b}.footer{position:absolute;bottom:0;left:0;right:0;background:#f8fafc;padding:4px 9px;font-size:7px;color:#64748b}.back{padding:12px;font-size:8px;line-height:1.6}.back h3{margin:0 0 8px;color:${cardEscape(organisation?.primaryColor ?? "#2563eb")};font-size:11px}.back p{margin:4px 0}.print{margin-top:24px;padding:8px 14px;border:0;border-radius:6px;background:#172033;color:#fff}@media print{.print{display:none}.card{box-shadow:none}}</style></head><body><div class="sheet"><section class="card"><div class="band">${organisation?.logoUrl ? `<img src="${cardEscape(organisation.logoUrl)}" alt="">` : ""}<div><div class="school">${cardEscape(organisation?.name)}</div><div class="sub">STUDENT IDENTITY CARD</div></div></div><div class="body">${student.photoUrl ? `<img class="photo" src="${cardEscape(student.photoUrl)}" alt="">` : `<div class="placeholder">${cardEscape(student.firstName?.[0] ?? "S")}</div>`}<div class="details"><strong>${cardEscape(student.fullName)}</strong><div><span class="label">Student ID:</span> ${cardEscape(student.studentId)}</div><div><span class="label">Class:</span> ${cardEscape(student.className)} ${student.sectionName ? `· ${cardEscape(student.sectionName)}` : ""}</div><div><span class="label">Roll:</span> ${cardEscape(student.rollNumber)}</div><div><span class="label">Status:</span> ${cardEscape(student.status)}</div></div></div><div class="footer">${cardEscape(organisation?.phone)} · ${cardEscape(organisation?.email)}</div></section><section class="card back"><h3>${cardEscape(organisation?.name)} · Student Card</h3><p><strong>Address:</strong> ${cardEscape(organisation?.address)}</p><p><strong>In case of emergency:</strong> Contact the institution using the details above.</p><p>This card remains the property of the institution and must be returned when requested.</p><div class="footer">Issued for the current academic enrolment</div></section></div><button class="print" onclick="window.print()">Print identity card</button></body></html>`;
}

export async function createStudent(
  db: DB,
  orgId: string,
  input: StudentInput & {
    academicYearId?: string | null;
    classId?: string | null;
    sectionId?: string | null;
  },
) {
  try {
    return await db.transaction(async (tx) => {
      const [student] = await tx
        .insert(students)
        .values({
          organisationId: orgId,
          studentId: input.studentId,
          admissionNumber: input.admissionNumber ?? null,
          firstName: input.firstName,
          middleName: input.middleName ?? null,
          lastName: input.lastName,
          photoUrl: input.photoUrl ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender,
          bloodGroup: input.bloodGroup ?? null,
          nationality: input.nationality ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          admissionDate: input.admissionDate ?? null,
          status: input.status,
        })
        .returning();

      if (input.academicYearId && input.classId) {
        await tx.insert(enrolments).values({
          organisationId: orgId,
          studentId: student.id,
          academicYearId: input.academicYearId,
          classId: input.classId,
          sectionId: input.sectionId ?? null,
          rollNumber: input.rollNumber ?? null,
        });
      }
      return student;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw conflict("Student ID or admission number already exists");
    }
    throw err;
  }
}

export async function updateStudent(
  db: DB,
  orgId: string,
  id: string,
  input: Partial<StudentInput>,
) {
  const [row] = await db
    .update(students)
    .set({
      admissionNumber: input.admissionNumber ?? undefined,
      firstName: input.firstName,
      middleName: input.middleName ?? undefined,
      lastName: input.lastName,
      photoUrl: input.photoUrl ?? undefined,
      dateOfBirth: input.dateOfBirth ?? undefined,
      gender: input.gender,
      bloodGroup: input.bloodGroup ?? undefined,
      nationality: input.nationality ?? undefined,
      address: input.address ?? undefined,
      phone: input.phone ?? undefined,
      email: input.email ?? undefined,
      admissionDate: input.admissionDate ?? undefined,
      status: input.status,
    })
    .where(and(eq(students.id, id), eq(students.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Student not found");
  return row;
}

export async function transitionStudentStatus(
  db: DB,
  orgId: string,
  id: string,
  status:
    | "active"
    | "graduated"
    | "suspended"
    | "withdrawn"
    | "transferred"
    | "alumni",
) {
  return db.transaction(async (tx) => {
    const [student] = await tx
      .update(students)
      .set({ status })
      .where(and(eq(students.id, id), eq(students.organisationId, orgId)))
      .returning();
    if (!student) throw notFound("Student not found");

    const [currentYear] = await tx
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.organisationId, orgId),
          eq(academicYears.isCurrent, true),
        ),
      )
      .limit(1);
    if (currentYear) {
      await tx
        .update(enrolments)
        .set({ promotionStatus: status === "active" ? null : status })
        .where(
          and(
            eq(enrolments.organisationId, orgId),
            eq(enrolments.studentId, id),
            eq(enrolments.academicYearId, currentYear.id),
          ),
        );
    }
    return student;
  });
}

export async function updateStudentProfile(
  db: DB,
  orgId: string,
  id: string,
  input: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    nationality?: string | null;
    photoUrl?: string | null;
  },
) {
  const [row] = await db
    .update(students)
    .set({
      phone: input.phone,
      email: input.email,
      address: input.address,
      nationality: input.nationality,
      photoUrl: input.photoUrl,
    })
    .where(and(eq(students.id, id), eq(students.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Student not found");
  return getStudent(db, orgId, id);
}

export async function deleteStudent(db: DB, orgId: string, id: string) {
  const rows = await db
    .delete(students)
    .where(and(eq(students.id, id), eq(students.organisationId, orgId)))
    .returning();
  if (!rows.length) throw notFound("Student not found");
}

export async function provisionStudentAccount(
  db: DB,
  orgId: string,
  studentId: string,
) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.organisationId, orgId)))
    .limit(1);
  if (!student) throw notFound("Student not found");
  const [existing] = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(and(eq(users.studentId, studentId), eq(users.organisationId, orgId)))
    .limit(1);
  if (existing)
    return {
      created: false,
      username: existing.username,
      email: existing.email,
      temporaryPassword: null,
    };
  const password = temporaryPassword();
  const username = student.studentId;
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.organisationId, orgId), eq(roles.key, "student")))
    .limit(1);
  if (!role) throw notFound("Student role not configured");
  const [account] = await db
    .insert(users)
    .values({
      organisationId: orgId,
      name: fullName(student),
      email: student.email,
      username,
      passwordHash: await hashPassword(password),
      studentId,
      mustChangePassword: true,
    })
    .returning({ id: users.id, username: users.username, email: users.email });
  await db.insert(userRoles).values({ userId: account.id, roleId: role.id });
  return {
    created: true,
    username: account.username,
    email: account.email,
    temporaryPassword: password,
  };
}

/* ------------------------------ Guardians ------------------------------ */

export async function listGuardians(db: DB, orgId: string, search?: string) {
  const conds = [eq(guardians.organisationId, orgId)];
  if (search) conds.push(ilike(guardians.fullName, `%${search}%`));

  const rows = await db
    .select()
    .from(guardians)
    .where(and(...conds))
    .orderBy(asc(guardians.fullName));

  const links = await db
    .select({
      guardianId: studentGuardians.guardianId,
      studentId: students.id,
      fullName: students.firstName,
      lastName: students.lastName,
      studentCode: students.studentId,
      isPrimary: studentGuardians.isPrimary,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .where(eq(studentGuardians.organisationId, orgId));

  return rows.map((g) => {
    const children = links.filter((l) => l.guardianId === g.id);
    return {
      ...g,
      isPrimary: children.some((c) => c.isPrimary),
      children: children.map((c) => ({
        studentId: c.studentId,
        fullName: `${c.fullName} ${c.lastName}`,
        className: null as string | null,
        studentCode: c.studentCode,
      })),
    };
  });
}

export async function createGuardian(
  db: DB,
  orgId: string,
  input: GuardianInput,
) {
  const [row] = await db
    .insert(guardians)
    .values({
      organisationId: orgId,
      fullName: input.fullName,
      relationship: input.relationship,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      occupation: input.occupation ?? null,
      photoUrl: input.photoUrl ?? null,
    })
    .returning();
  return row;
}

export async function provisionGuardianAccount(
  db: DB,
  orgId: string,
  guardianId: string,
) {
  const [guardian] = await db
    .select()
    .from(guardians)
    .where(
      and(eq(guardians.id, guardianId), eq(guardians.organisationId, orgId)),
    )
    .limit(1);
  if (!guardian) throw notFound("Guardian not found");
  const [existing] = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(
      and(eq(users.guardianId, guardianId), eq(users.organisationId, orgId)),
    )
    .limit(1);
  if (existing)
    return {
      created: false,
      username: existing.username,
      email: existing.email,
      temporaryPassword: null,
    };
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.organisationId, orgId), eq(roles.key, "parent")))
    .limit(1);
  if (!role) throw notFound("Parent role not configured");
  const password = temporaryPassword();
  const username = guardian.email ?? `parent-${guardian.id.slice(0, 8)}`;
  const [account] = await db
    .insert(users)
    .values({
      organisationId: orgId,
      name: guardian.fullName,
      email: guardian.email,
      username,
      passwordHash: await hashPassword(password),
      guardianId,
      mustChangePassword: true,
    })
    .returning({ id: users.id, username: users.username, email: users.email });
  await db.insert(userRoles).values({ userId: account.id, roleId: role.id });
  return {
    created: true,
    username: account.username,
    email: account.email,
    temporaryPassword: password,
  };
}

export async function updateGuardian(
  db: DB,
  orgId: string,
  id: string,
  input: Partial<GuardianInput>,
) {
  const [row] = await db
    .update(guardians)
    .set({
      fullName: input.fullName,
      relationship: input.relationship,
      phone: input.phone ?? undefined,
      email: input.email ?? undefined,
      address: input.address ?? undefined,
      occupation: input.occupation ?? undefined,
      photoUrl: input.photoUrl ?? undefined,
    })
    .where(and(eq(guardians.id, id), eq(guardians.organisationId, orgId)))
    .returning();
  if (!row) throw notFound("Guardian not found");
  return row;
}

export async function linkGuardian(
  db: DB,
  orgId: string,
  studentId: string,
  guardianId: string,
  isPrimary: boolean,
) {
  try {
    const [row] = await db
      .insert(studentGuardians)
      .values({ organisationId: orgId, studentId, guardianId, isPrimary })
      .returning();
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === "23505")
      throw conflict("Already linked");
    throw err;
  }
}

export async function unlinkGuardian(
  db: DB,
  orgId: string,
  studentId: string,
  guardianId: string,
) {
  await db
    .delete(studentGuardians)
    .where(
      and(
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.guardianId, guardianId),
        eq(studentGuardians.organisationId, orgId),
      ),
    );
}

/* ---------------------- Promotion wizard (SRS §61) ---------------------- */

export type PromotionEntry = {
  studentId: string;
  status: "promoted" | "repeated" | "transferred" | "graduated" | "withdrawn";
  toClassId?: string | null;
  toSectionId?: string | null;
};

export async function promoteStudents(
  db: DB,
  orgId: string,
  fromYearId: string,
  toYearId: string,
  entries: PromotionEntry[],
) {
  return db.transaction(async (tx) => {
    const results: { studentId: string; status: string }[] = [];
    for (const entry of entries) {
      const [source] = await tx
        .select()
        .from(enrolments)
        .where(
          and(
            eq(enrolments.studentId, entry.studentId),
            eq(enrolments.academicYearId, fromYearId),
            eq(enrolments.organisationId, orgId),
          ),
        )
        .limit(1);
      if (!source) continue;

      if (entry.status === "transferred" || entry.status === "withdrawn") {
        await tx
          .update(enrolments)
          .set({ promotionStatus: entry.status })
          .where(eq(enrolments.id, source.id));
        if (entry.status === "withdrawn") {
          await tx
            .update(students)
            .set({ status: "withdrawn" })
            .where(eq(students.id, entry.studentId));
        }
      } else {
        // New year = NEW row; the old year's row is never modified (SRS §60).
        await tx
          .insert(enrolments)
          .values({
            organisationId: orgId,
            studentId: entry.studentId,
            academicYearId: toYearId,
            classId: entry.toClassId ?? source.classId,
            sectionId: entry.toSectionId ?? source.sectionId,
            rollNumber: source.rollNumber,
            promotionStatus: entry.status,
          })
          .onConflictDoNothing();
        await tx
          .update(enrolments)
          .set({ promotionStatus: entry.status })
          .where(eq(enrolments.id, source.id));
        if (entry.status === "graduated") {
          await tx
            .update(students)
            .set({ status: "graduated" })
            .where(eq(students.id, entry.studentId));
        }
      }
      results.push({ studentId: entry.studentId, status: entry.status });
    }
    return results;
  });
}
