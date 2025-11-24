// Student service - use case layer
import type { Student } from '../domain/student.js';
import { StudentRepository } from '../../infrastructure/db/repositories/studentRepository.js';
import { unitOfWork } from '../../infrastructure/db/unitOfWork.js';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';

export interface CreateStudentParams {
	firstName: string;
	lastName: string;
	birthYear: number;
	group: string;
	phone?: string | null;
	fatherPhone?: string | null;
	motherPhone?: string | null;
}

export interface UpdateStudentParams {
	id: number;
	firstName?: string;
	lastName?: string;
	birthYear?: number;
	group?: string;
	phone?: string | null;
	fatherPhone?: string | null;
	motherPhone?: string | null;
}

export class StudentService {
	constructor(private readonly repository: StudentRepository = new StudentRepository()) {}

	async getAllStudents(): Promise<Student[]> {
		return this.repository.findAll();
	}

	async getStudentById(id: number): Promise<Student | null> {
		return this.repository.findById(id);
	}

	async registerStudent(params: CreateStudentParams): Promise<Student> {
		return unitOfWork.execute(async () => {
			return this.repository.create({
				firstName: params.firstName,
				lastName: params.lastName,
				birthYear: params.birthYear,
				group: params.group,
				phone: params.phone ?? null,
				fatherPhone: params.fatherPhone ?? null,
				motherPhone: params.motherPhone ?? null,
			});
		});
	}

	async updateStudent(params: UpdateStudentParams): Promise<Student> {
		return unitOfWork.execute(async () => {
			const existing = await this.repository.findById(params.id);
			if (!existing) {
				throw new Error(`Student with id ${params.id} not found`);
			}
			const updated = existing.with({
				firstName: params.firstName,
				lastName: params.lastName,
				birthYear: params.birthYear,
				group: params.group,
				phone: params.phone,
				fatherPhone: params.fatherPhone,
				motherPhone: params.motherPhone,
				updatedAt: new Date(),
			});
			return this.repository.update(updated);
		});
	}

	async deleteStudent(id: number): Promise<void> {
		return unitOfWork.execute(async () => {
			await this.repository.delete(id);
		});
	}

	async searchStudents(query: string): Promise<FuseResult<Student>[]> {
		const students = await this.repository.findAll();
		const fuse = new Fuse(students, {
			keys: ['firstName', 'lastName', 'group'],
			threshold: 0.3,
		});
		return fuse.search(query);
	}
}

