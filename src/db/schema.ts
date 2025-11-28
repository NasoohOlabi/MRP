// Database schema definitions for Wartaqi bot using Drizzle ORM
import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Teachers table - derived from 'حلقة' column
export const teachers = sqliteTable('teachers', {
	id: integer('id').primaryKey(),
	name: text('name', { length: 255 }).notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Students table
export const students = sqliteTable(
	'students',
	{
		id: integer('id').primaryKey(),
		firstName: text('first_name', { length: 255 }).notNull(),
		lastName: text('last_name', { length: 255 }).notNull(),
		birthYear: integer('birth_year'),
		phone: text('phone', { length: 20 }),
		level: integer('level'), // 1-4
		teacherId: integer('teacher_id').notNull().references(() => teachers.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	},
	(table) => [
		index('idx_students_teacher_id').on(table.teacherId),
	],
);

// Users table - stores bot user accounts and role assignments
export const users = sqliteTable('users', {
	id: integer('id').primaryKey(),
	telegramUserId: integer('telegram_user_id').notNull().unique(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }),
	role: text('role', { length: 20 }).notNull().default('student'),
	phone: text('phone', { length: 20 }),
	linkedStudentId: integer('linked_student_id').references(() => students.id, { onDelete: 'set null' }),
	linkedTeacherId: integer('linked_teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
	isActive: integer('is_active').notNull().default(1),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Notebook deliveries table - tracks which students received notebooks for which level
export const notebookDeliveries = sqliteTable(
	'notebook_deliveries',
	{
		id: integer('id').primaryKey(),
		studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
		level: integer('level').notNull(), // The level for which the notebook was delivered
		deliveredAt: integer('delivered_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	},
	(table) => [
		index('idx_notebook_deliveries_student_id').on(table.studentId),
	],
);

// Attendance table
export const attendance = sqliteTable(
	'attendance',
	{
		id: integer('id').primaryKey(),
		studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
		date: text('date', { length: 10 }).notNull(), // Format: YYYY-MM-DD
		status: text('status', { length: 20 }).notNull().default('present'), // 'present', 'absent'
		teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
	},
	(table) => [
		index('idx_attendance_student_id').on(table.studentId),
		index('idx_attendance_date').on(table.date),
	],
);

// Define relations
export const teachersRelations = relations(teachers, ({ many }) => ({
	students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
	teacher: one(teachers, {
		fields: [students.teacherId],
		references: [teachers.id],
	}),
	notebookDeliveries: many(notebookDeliveries),
	attendanceRecords: many(attendance),
}));

export const usersRelations = relations(users, ({ one }) => ({
	linkedStudent: one(students, {
		fields: [users.linkedStudentId],
		references: [students.id],
	}),
	linkedTeacher: one(teachers, {
		fields: [users.linkedTeacherId],
		references: [teachers.id],
	}),
}));

export const notebookDeliveriesRelations = relations(notebookDeliveries, ({ one }) => ({
	student: one(students, {
		fields: [notebookDeliveries.studentId],
		references: [students.id],
	}),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
	student: one(students, {
		fields: [attendance.studentId],
		references: [students.id],
	}),
	teacher: one(teachers, {
		fields: [attendance.teacherId],
		references: [teachers.id],
	}),
}));

