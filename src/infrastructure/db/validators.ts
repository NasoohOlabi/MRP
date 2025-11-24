// Zod validators for runtime type safety
import { z } from 'zod';

// Student validators
export const StudentInsertSchema = z.object({
	firstName: z.string().min(1).max(255),
	lastName: z.string().min(1).max(255),
	birthYear: z.number().int().min(1900).max(2100),
	phone: z.string().max(20).nullable().optional(),
	fatherPhone: z.string().max(20).nullable().optional(),
	motherPhone: z.string().max(20).nullable().optional(),
	group: z.string().min(1).max(100),
});

export const StudentUpdateSchema = StudentInsertSchema.partial().extend({
	id: z.number().int().positive(),
});

export const StudentSchema = StudentInsertSchema.extend({
	id: z.number().int().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Teacher validators
export const TeacherInsertSchema = z.object({
	firstName: z.string().min(1).max(255),
	lastName: z.string().min(1).max(255),
	phoneNumber: z.string().min(1).max(20),
	group: z.string().min(1).max(100),
});

export const TeacherUpdateSchema = TeacherInsertSchema.partial().extend({
	id: z.number().int().positive(),
});

export const TeacherSchema = TeacherInsertSchema.extend({
	id: z.number().int().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Attendance validators
export const AttendanceInsertSchema = z.object({
	studentId: z.number().int().positive(),
	event: z.string().min(1).max(255),
});

export const AttendanceSchema = AttendanceInsertSchema.extend({
	id: z.number().int().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Memorization validators
export const MemorizationInsertSchema = z.object({
	studentId: z.number().int().positive(),
	page: z.number().int().min(0).max(604),
});

export const MemorizationSchema = MemorizationInsertSchema.extend({
	id: z.number().int().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Type exports
export type StudentInsert = z.infer<typeof StudentInsertSchema>;
export type StudentUpdate = z.infer<typeof StudentUpdateSchema>;
export type Student = z.infer<typeof StudentSchema>;

export type TeacherInsert = z.infer<typeof TeacherInsertSchema>;
export type TeacherUpdate = z.infer<typeof TeacherUpdateSchema>;
export type Teacher = z.infer<typeof TeacherSchema>;

export type AttendanceInsert = z.infer<typeof AttendanceInsertSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;

export type MemorizationInsert = z.infer<typeof MemorizationInsertSchema>;
export type Memorization = z.infer<typeof MemorizationSchema>;

