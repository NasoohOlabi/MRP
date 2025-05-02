import Fuse from "fuse.js";
import type { SheetDBClient, SheetDBResponse } from "../sheetdb/sheetdb";
import { BaseRepo } from "./BaseRepo";

export class Student {
	// id	first_name	last_name	group	birth_date	created_at	updated_at
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public birth_date: string,
		public group: string,
		public created_at: Date,
		public updated_at: string
	) { }
}

export class StudentRepo extends BaseRepo<Student>{

	public constructor(dbClient: SheetDBClient) {
		super(dbClient, 'students', true);
	}
	public async create(params: Omit<Omit<Omit<Student, 'updated_at'>, 'created_at'>, 'id'>) {
		return await this._create(params) as SheetDBResponse;
	}
	public async update(student: Student) {
		// columnName: string, value: string | number,
		return await this._update('id', student.id, student)
	}
	async lookFor(response: string) {
		const students = await this._read()
		console.log(`student read ${students.length}`)
		console.log(`students:\n`, students)
		// const results = new Fuse(students.map(({ first_name, last_name, id }) => ({ first_name, last_name, id }))).search(response)
		const results = new Fuse(students, { keys: ['first_name', 'last_name', 'group'] }).search(response)
		return results
	}
}