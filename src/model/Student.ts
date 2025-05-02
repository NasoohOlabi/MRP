import type { SheetDBClient, SheetDBConfig, SheetDBResponse } from "../sheetdb/sheetdb";
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

	public constructor(private config: SheetDBClient) {
		super(config, 'students', true);
	}
	public async create(params: Omit<Omit<Omit<Student, 'updated_at'>, 'created_at'>, 'id'>) {
		if (this.track_dates) {
			return await this.config.create({
				...params,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				id: 0
			}, this.sheet!) as SheetDBResponse;
		}
		return await this._create({ ...params }) as SheetDBResponse;
	}
}