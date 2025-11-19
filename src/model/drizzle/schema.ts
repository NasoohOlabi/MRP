// drizzle/schema.ts
import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Represents the 'students' table
export const students = sqliteTable('students', {
	id: integer('id').primaryKey(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }).notNull(),
	// Use integer with mode 'timestamp' for dates in SQLite
	birthYear: integer('birth_year').notNull(),
	phone: text('phone', { length: 20 }),
	fatherPhone: text('father_phone', { length: 20 }),
	motherPhone: text('mother_phone', { length: 20 }),
	group: text('group', { length: 100 }).notNull(),
	// Use integer with mode 'timestamp' and an explicit SQL default for timestamps
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Represents the 'teacher' table
export const teachers = sqliteTable('teacher', {
	id: integer('id').primaryKey(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }).notNull(),
	phoneNumber: text('phone_number', { length: 20 }).notNull().unique(),
	group: text('group', { length: 100 }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const attendance = sqliteTable('attendance', {
	id: integer('id').primaryKey(),
	studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
	event: text('event', { length: 255 }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const memorization = sqliteTable('memorization', {
	id: integer('id').primaryKey(),
	studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
	page: integer('page').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Define relations between tables
export const attendanceRelations = relations(attendance, ({ one }) => ({
	student: one(students, {
		fields: [attendance.studentId],
		references: [students.id],
	}),
}));

export const memorizationRelations = relations(memorization, ({ one }) => ({
	student: one(students, {
		fields: [memorization.studentId],
		references: [students.id],
	}),
}));

export const studentsRelations = relations(students, ({ many }) => ({
	attendanceRecords: many(attendance),
	memorizationRecords: many(memorization),
}));