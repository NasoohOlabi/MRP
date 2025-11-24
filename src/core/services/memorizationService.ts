// Memorization service - use case layer
import type { Memorization } from '../domain/memorization.js';
import { MemorizationRepository } from '../../infrastructure/db/repositories/memorizationRepository.js';
import { unitOfWork } from '../../infrastructure/db/unitOfWork.js';

export interface RecordMemorizationParams {
	studentId: number;
	page: number;
}

export interface GetMemorizationParams {
	studentId: number;
	fromDate?: Date;
	toDate?: Date;
	limit?: number;
	offset?: number;
}

export class MemorizationService {
	constructor(private readonly repository: MemorizationRepository = new MemorizationRepository()) {}

	async recordMemorization(params: RecordMemorizationParams): Promise<Memorization> {
		if (params.page < 0 || params.page > 604) {
			throw new Error('Page number must be between 0 and 604');
		}
		return unitOfWork.execute(async () => {
			return this.repository.create({
				studentId: params.studentId,
				page: params.page,
			});
		});
	}

	async getMemorizationByStudent(params: GetMemorizationParams): Promise<{ records: Memorization[]; total: number }> {
		return this.repository.findByStudentId(params.studentId, {
			fromDate: params.fromDate,
			toDate: params.toDate,
			limit: params.limit,
			offset: params.offset,
		});
	}

	async removeMemorization(id: number): Promise<void> {
		return unitOfWork.execute(async () => {
			await this.repository.delete(id);
		});
	}
}

