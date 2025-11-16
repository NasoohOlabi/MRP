// drizzle/schema.ts
import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Represents the 'students' table
export const students = sqliteTable('students', {
	id: integer('id').primaryKey(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }).notNull(),
	// Use integer with mode 'timestamp' for dates in SQLite
	birthDate: integer('birth_date', { mode: 'timestamp' }).notNull(),
	group: text('group', { length: 100 }).notNull(),
	// Use integer with mode 'timestamp' and an explicit SQL default for timestamps
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
});

// Represents the 'teacher' table
export const teachers = sqliteTable('teacher', {
	id: integer('id').primaryKey(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }).notNull(),
	phoneNumber: text('phone_number', { length: 20 }).notNull().unique(),
	group: text('group', { length: 100 }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
});

// Represents the 'attendance' table
export const attendance = sqliteTable('attendance', {
	id: integer('id').primaryKey(),
	studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
	event: text('event', { length: 255 }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`cast((julianday('now') - 2440587.5)*86400000 as integer)`).notNull(),
}, (table) => [ // Return an array of indexes for the new API
	// Enforces the business rule: one attendance record per student, per event, per day.
	// We use a unique index on a derived date column.
	uniqueIndex('unique_student_event_date')
		.on(table.studentId, table.event, sql`date(${table.createdAt})`)
]);

// Define relations between tables (No changes needed)
export const studentsRelations = relations(students, ({ many }) => ({
	attendanceRecords: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
	student: one(students, {
		fields: [attendance.studentId],
		references: [students.id],
	}),
}));