// Immutable domain model for Teacher
export class Teacher {
	constructor(
		public readonly id: number,
		public readonly firstName: string,
		public readonly lastName: string,
		public readonly phoneNumber: string,
		public readonly group: string,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	get fullName(): string {
		return `${this.firstName} ${this.lastName}`;
	}

	equals(other: Teacher): boolean {
		return this.id === other.id;
	}

	with(updates: Partial<Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>>): Teacher {
		return new Teacher(
			this.id,
			updates.firstName ?? this.firstName,
			updates.lastName ?? this.lastName,
			updates.phoneNumber ?? this.phoneNumber,
			updates.group ?? this.group,
			this.createdAt,
			updates.updatedAt ?? new Date(),
		);
	}
}

