// Immutable domain model for Memorization
export class Memorization {
	constructor(
		public readonly id: number,
		public readonly studentId: number,
		public readonly page: number,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	equals(other: Memorization): boolean {
		return this.id === other.id;
	}

	isValidPage(): boolean {
		return this.page >= 0 && this.page <= 604;
	}
}

