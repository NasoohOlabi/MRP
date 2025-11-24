// Immutable domain model for Student
export class Student {
	constructor(
		public readonly id: number,
		public readonly firstName: string,
		public readonly lastName: string,
		public readonly birthYear: number,
		public readonly group: string,
		public readonly phone: string | null,
		public readonly fatherPhone: string | null,
		public readonly motherPhone: string | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	get fullName(): string {
		return `${this.firstName} ${this.lastName}`;
	}

	equals(other: Student): boolean {
		return this.id === other.id;
	}

	with(updates: Partial<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>): Student {
		return new Student(
			this.id,
			updates.firstName ?? this.firstName,
			updates.lastName ?? this.lastName,
			updates.birthYear ?? this.birthYear,
			updates.group ?? this.group,
			updates.phone ?? this.phone,
			updates.fatherPhone ?? this.fatherPhone,
			updates.motherPhone ?? this.motherPhone,
			this.createdAt,
			updates.updatedAt ?? new Date(),
		);
	}
}

