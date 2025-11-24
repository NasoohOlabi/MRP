// Authentication and authorization utilities
import type { MyContext } from '../types.js';
import { UserService, type UserRole } from '../features/users/model.js';

const userService = new UserService();

/**
 * Get the current user from context
 */
export async function getCurrentUser(ctx: MyContext) {
	if (!ctx.from?.id) {
		return null;
	}

	return await userService.getByTelegramId(ctx.from.id);
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(ctx: MyContext): Promise<boolean> {
	const user = await getCurrentUser(ctx);
	
	if (!user) {
		const lang = ctx.session?.language || 'en';
		await ctx.reply(lang === 'ar' 
			? 'يجب تسجيل الدخول أولاً. استخدم /register للتسجيل.'
			: 'You must be logged in first. Use /register to register.');
		return false;
	}

	if (!user.isActive) {
		const lang = ctx.session?.language || 'en';
		await ctx.reply(lang === 'ar'
			? 'حسابك غير نشط. يرجى الاتصال بالمسؤول.'
			: 'Your account is inactive. Please contact an administrator.');
		return false;
	}

	// Store user in context for easy access
	(ctx as any).user = user;
	return true;
}

/**
 * Middleware to require specific role(s)
 */
export async function requireRole(ctx: MyContext, requiredRole: UserRole | UserRole[]): Promise<boolean> {
	const authenticated = await requireAuth(ctx);
	if (!authenticated) {
		return false;
	}

	const user = await getCurrentUser(ctx);
	if (!user) {
		return false;
	}

	if (!userService.hasRole(user, requiredRole)) {
		const lang = ctx.session?.language || 'en';
		const roleText = Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole;
		await ctx.reply(lang === 'ar'
			? `ليس لديك الصلاحية للوصول إلى هذا الأمر. المطلوب: ${roleText}`
			: `You don't have permission to access this command. Required role: ${roleText}`);
		return false;
	}

	return true;
}

/**
 * Check if user is admin
 */
export async function requireAdmin(ctx: MyContext): Promise<boolean> {
	return requireRole(ctx, 'admin');
}

/**
 * Check if user is teacher or admin
 */
export async function requireTeacher(ctx: MyContext): Promise<boolean> {
	return requireRole(ctx, ['admin', 'teacher']);
}

/**
 * Get user role helper
 */
export async function getUserRole(ctx: MyContext): Promise<UserRole | null> {
	const user = await getCurrentUser(ctx);
	if (!user) return null;
	return user.role as UserRole;
}

