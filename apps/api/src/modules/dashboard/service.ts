import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "../../lib/types";
import type { AuthUser } from "../../lib/context";
import { students, employees, attendanceRecords, invoices, notices, events } from "../../db/schema";
import { learnerStudentIds } from "../../lib/teacher-scope";
import { calendarEventScope } from "../../lib/calendar-visibility";

const tenant = (table: { organisationId: any }, orgId: string) => eq(table.organisationId, orgId);

export async function summary(db: DB, orgId: string, user?: AuthUser) {
  const learnerIds = user ? await learnerStudentIds(db, orgId, user) : null;
  const isLearnerOrParent = learnerIds !== null;
  const canViewFinance = Boolean(user?.isPlatformAdmin || user?.permissions?.includes("invoice.view"));

  if (isLearnerOrParent) {
    const studentFilter = learnerIds.length ? inArray(attendanceRecords.studentId, learnerIds) : sql`false`;
    const invoiceFilter = learnerIds.length ? inArray(invoices.studentId, learnerIds) : sql`false`;

    const [[a], [f], recentNotices, upcomingEvents] = await Promise.all([
      db.select({
        present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
        total: sql<number>`count(*)`
      }).from(attendanceRecords).where(and(tenant(attendanceRecords, orgId), studentFilter)),
      db.select({
        total: sql<number>`coalesce(sum(${invoices.total}),0)`,
        paid: sql<number>`coalesce(sum(${invoices.paid}),0)`
      }).from(invoices).where(and(tenant(invoices, orgId), invoiceFilter)),
      db.select({
        id: notices.id,
        title: notices.title,
        body: notices.body,
        priority: notices.priority,
        publishAt: notices.publishAt,
        authorId: notices.authorId,
        createdAt: notices.createdAt,
        expireAt: notices.expireAt,
        organisationId: notices.organisationId,
      }).from(notices).where(and(
        tenant(notices, orgId),
        sql`exists (select 1 from notice_audiences na where na.notice_id = ${notices.id} and na.organisation_id = ${orgId} and na.audience_type in ('everyone', 'students', 'parents'))`
      )).orderBy(sql`${notices.publishAt} desc`).limit(5),
      db.select().from(events).where(and(tenant(events, orgId), calendarEventScope(user), sql`coalesce(${events.endDate}, ${events.startDate}) >= current_date`)).orderBy(events.startDate).limit(5)
    ]);

    return {
      students: learnerIds.length,
      employees: 0,
      attendancePercentage: Number(a.total) ? Math.round(Number(a.present) * 10000 / Number(a.total)) / 100 : 0,
      fees: {
        total: Number(f.total),
        paid: Number(f.paid),
        outstanding: Number(f.total) - Number(f.paid)
      },
      recentNotices,
      upcomingEvents
    };
  }

  // Staff and Admin flow
  const [[s], [e], [a], [f], recentNotices, upcomingEvents] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(tenant(students, orgId)),
    db.select({ count: sql<number>`count(*)` }).from(employees).where(tenant(employees, orgId)),
    db.select({
      present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
      total: sql<number>`count(*)`
    }).from(attendanceRecords).where(tenant(attendanceRecords, orgId)),
    canViewFinance
      ? db.select({
          total: sql<number>`coalesce(sum(${invoices.total}),0)`,
          paid: sql<number>`coalesce(sum(${invoices.paid}),0)`
        }).from(invoices).where(tenant(invoices, orgId))
      : Promise.resolve([{ total: 0, paid: 0 }]),
    db.select().from(notices).where(tenant(notices, orgId)).orderBy(sql`${notices.publishAt} desc`).limit(5),
    db.select().from(events).where(and(tenant(events, orgId), calendarEventScope(user), sql`coalesce(${events.endDate}, ${events.startDate}) >= current_date`)).orderBy(events.startDate).limit(5)
  ]);

  return {
    students: Number(s.count),
    employees: Number(e.count),
    attendancePercentage: Number(a.total) ? Math.round(Number(a.present) * 10000 / Number(a.total)) / 100 : 0,
    fees: {
      total: Number(f.total),
      paid: Number(f.paid),
      outstanding: Number(f.total) - Number(f.paid)
    },
    recentNotices,
    upcomingEvents
  };
}
