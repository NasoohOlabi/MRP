import Fuse from "fuse.js";
import type { SheetDBClient, SheetDBResponse } from "../sheetdb/sheetdb";
import { BaseRepo } from "./BaseRepo";

export class Teacher {
	// id	first_name	last_name	group	birth_date	created_at	updated_at
	constructor(
		public id: number,
		public first_name: string,
		public last_name: string,
		public phone_number: string,
		public group: string,
		public created_at: Date,
		public updated_at: string
	) { }
}

export class TeacherRepo extends BaseRepo<Teacher>{

	public constructor(dbClient: SheetDBClient) {
		super(dbClient, 'teachers', true);
	}
	public async create(params: Omit<Omit<Omit<Teacher, 'updated_at'>, 'created_at'>, 'id'>) {
		return await this._create(params) as SheetDBResponse;
	}
	public async update(teacher: Teacher) {
		// columnName: string, value: string | number,
		return await this._update('id', teacher.id, teacher)
	}
	async lookFor(response: string) {
		const teachers = await this._read()
		console.log(`teacher read ${teachers.length}`)
		console.log(`teachers:\n`, teachers)
		// const results = new Fuse(teachers.map(({ first_name, last_name, id }) => ({ first_name, last_name, id }))).search(response)
		const results = new Fuse(teachers, { keys: ['first_name', 'last_name', 'group'] }).search(response)
		return results
	}
	async teachersPhoneNumber(phone_number: string): Promise<boolean> {
		const teachers = await this._read()
		return teachers.some(t => t.phone_number === phone_number)
	}
	public async delete(teacher: Teacher) {
		return await this._delete('id', teacher.id)
	}
}