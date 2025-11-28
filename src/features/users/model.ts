// User service for managing user accounts and authentication
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type UserRole = 'admin' | 'teacher' | 'student';

export class UserService {
	/**
	 * Register a new user account
	 */
	async register(data: {
		telegramUserId: number;
		firstName: string;
		lastName?: string | undefined;
		role?: UserRole | undefined;
		phone?: string | undefined;
		linkedStudentId?: number | undefined;
		linkedTeacherId?: number | undefined;
	}): Promise<User> {
		// Check if user already exists
		const existing = await this.getByTelegramId(data.telegramUserId);
		if (existing) {
			throw new Error('User already exists');
		}

		const [user] = await db
			.insert(users)
			.values({
				telegramUserId: data.telegramUserId,
				firstName: data.firstName,
				lastName: data.lastName ?? null,
				role: data.role ?? 'student',
				phone: data.phone ?? null,
				linkedStudentId: data.linkedStudentId ?? null,
				linkedTeacherId: data.linkedTeacherId ?? null,
				isActive: true,
			})
			.returning();

		if (!user) {
			throw new Error('Failed to create user');
		}

		return user;
	}

	/**
	 * Get user by Telegram user ID
	 */
	async getByTelegramId(telegramUserId: number): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.telegramUserId, telegramUserId))
			.limit(1);

		return user || null;
	}

	/**
	 * Get user by ID
	 */
	async getById(id: number): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);

		return user || null;
	}

	/**
	 * Update user information
	 */
	async update(id: number, data: Partial<Omit<NewUser, 'id' | 'telegramUserId' | 'createdAt'>>): Promise<User> {
		const [updated] = await db
			.update(users)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(users.id, id))
			.returning();

		if (!updated) {
			throw new Error('User not found');
		}

		return updated;
	}

	/**
	 * Update user role (admin only)
	 */
	async updateRole(id: number, role: UserRole): Promise<User> {
		return this.update(id, { role });
	}

	/**
	 * Deactivate a user account
	 */
	async deactivate(id: number): Promise<void> {
		await db.update(users).set({ isActive: false }).where(eq(users.id, id));
	}

	/**
	 * Activate a user account
	 */
	async activate(id: number): Promise<void> {
		await db.update(users).set({ isActive: true }).where(eq(users.id, id));
	}

	/**
	 * Get all users (admin only)
	 */
	async getAll(): Promise<User[]> {
		return db.select().from(users);
	}

	/**
	 * Get users by role
	 */
	async getByRole(role: UserRole): Promise<User[]> {
		return db.select().from(users).where(eq(users.role, role));
	}

	/**
	 * Check if user has required role
	 */
	hasRole(user: User | null, requiredRole: UserRole | UserRole[]): boolean {
		if (!user || !user.isActive) {
			return false;
		}

		if (user.role === 'admin') {
			return true; // Admins have access to everything
		}

		const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
		return roles.includes(user.role as UserRole);
	}

	/**
	 * Check if user can perform admin actions
	 */
	isAdmin(user: User | null): boolean {
		return this.hasRole(user, 'admin');
	}

	/**
	 * Check if user can perform teacher actions
	 */
	isTeacher(user: User | null): boolean {
		return this.hasRole(user, ['admin', 'teacher']);
	}

	/**
	 * Check if user is a student
	 */
	isStudent(user: User | null): boolean {
		return this.hasRole(user, 'student');
	}
}

