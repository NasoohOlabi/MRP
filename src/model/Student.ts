import type { SheetDBClient } from "../sheetdb/sheetdb";
import { BaseRepo } from "./BaseRepo";

export class Student {
	// id	first_name	last_name	group	birth_date	created_at	updated_at
	constructor(
		public id: number,
		public first_name: string,
		public last_name: number,
		public birth_date: string,
		public created_at: Date,
		public updated_at: string
	) { }
}

export class StudentRepo extends BaseRepo<Student> {
	sheet = 'students';
	track_dates = true;
	public constructor(db: SheetDBClient) {
		super(db);
	}
}