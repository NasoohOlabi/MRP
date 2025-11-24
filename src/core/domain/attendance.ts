// Immutable domain model for Attendance
export class Attendance {
	constructor(
		public readonly id: number,
		public readonly studentId: number,
		public readonly event: string,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	equals(other: Attendance): boolean {
		return this.id === other.id;
	}

	isSameDay(other: Date): boolean {
		return (
			this.createdAt.getFullYear() === other.getFullYear() &&
			this.createdAt.getMonth() === other.getMonth() &&
			this.createdAt.getDate() === other.getDate()
		);
	}
}

