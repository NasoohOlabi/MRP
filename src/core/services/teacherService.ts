// Teacher service - use case layer
import type { Teacher } from '../domain/teacher.js';
import { TeacherRepository } from '../../infrastructure/db/repositories/teacherRepository.js';
import { unitOfWork } from '../../infrastructure/db/unitOfWork.js';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';

export interface CreateTeacherParams {
	firstName: string;
	lastName: string;
	phoneNumber: string;
	group: string;
}

export interface UpdateTeacherParams {
	id: number;
	firstName?: string;
	lastName?: string;
	phoneNumber?: string;
	group?: string;
}

export class TeacherService {
	constructor(private readonly repository: TeacherRepository = new TeacherRepository()) {}

	async getAllTeachers(): Promise<Teacher[]> {
		return this.repository.findAll();
	}

	async getTeacherById(id: number): Promise<Teacher | null> {
		return this.repository.findById(id);
	}

	async getTeacherByPhone(phoneNumber: string): Promise<Teacher | null> {
		return this.repository.findByPhone(phoneNumber);
	}

	async registerTeacher(params: CreateTeacherParams): Promise<Teacher> {
		return unitOfWork.execute(async () => {
			const exists = await this.repository.phoneExists(params.phoneNumber);
			if (exists) {
				throw new Error(`Teacher with phone number ${params.phoneNumber} already exists`);
			}
			return this.repository.create({
				firstName: params.firstName,
				lastName: params.lastName,
				phoneNumber: params.phoneNumber,
				group: params.group,
			});
		});
	}

	async updateTeacher(params: UpdateTeacherParams): Promise<Teacher> {
		return unitOfWork.execute(async () => {
			const existing = await this.repository.findById(params.id);
			if (!existing) {
				throw new Error(`Teacher with id ${params.id} not found`);
			}
			if (params.phoneNumber && params.phoneNumber !== existing.phoneNumber) {
				const exists = await this.repository.phoneExists(params.phoneNumber);
				if (exists) {
					throw new Error(`Teacher with phone number ${params.phoneNumber} already exists`);
				}
			}
			const updated = existing.with({
				firstName: params.firstName,
				lastName: params.lastName,
				phoneNumber: params.phoneNumber,
				group: params.group,
				updatedAt: new Date(),
			});
			return this.repository.update(updated);
		});
	}

	async deleteTeacher(id: number): Promise<void> {
		return unitOfWork.execute(async () => {
			await this.repository.delete(id);
		});
	}

	async searchTeachers(query: string): Promise<FuseResult<Teacher>[]> {
		const teachers = await this.repository.findAll();
		const fuse = new Fuse(teachers, {
			keys: ['firstName', 'lastName', 'group'],
			threshold: 0.3,
		});
		return fuse.search(query);
	}
}

