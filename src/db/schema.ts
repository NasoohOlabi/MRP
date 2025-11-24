// Database schema definitions using Drizzle ORM
import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Represents the 'students' table
export const students = sqliteTable('students', {
	id: integer('id').primaryKey(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }).notNull(),
	birthYear: integer('birth_year').notNull(),
	phone: text('phone', { length: 20 }),
	fatherPhone: text('father_phone', { length: 20 }),
	motherPhone: text('mother_phone', { length: 20 }),
	group: text('group', { length: 100 }),
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

// User accounts table for authentication and authorization
export const users = sqliteTable('users', {
	id: integer('id').primaryKey(),
	telegramUserId: integer('telegram_user_id').notNull().unique(),
	firstName: text('first_name', { length: 255 }).notNull(),
	lastName: text('last_name', { length: 255 }),
	role: text('role', { length: 20 }).notNull().default('student'), // 'admin', 'teacher', 'student'
	phone: text('phone', { length: 20 }),
	linkedStudentId: integer('linked_student_id').references(() => students.id, { onDelete: 'set null' }),
	linkedTeacherId: integer('linked_teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
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
	linkedUsers: many(users),
}));

export const teachersRelations = relations(teachers, ({ many: _many }) => ({
	linkedUsers: _many(users),
}));

export const usersRelations = relations(users, ({ one: _one }) => ({
	linkedStudent: _one(students, {
		fields: [users.linkedStudentId],
		references: [students.id],
	}),
	linkedTeacher: _one(teachers, {
		fields: [users.linkedTeacherId],
		references: [teachers.id],
	}),
}));

