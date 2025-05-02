import type { ReadParams, SheetDBClient } from "../sheetdb/sheetdb";

export class Student {
	constructor(
		public id: number,
		public name: string,
		public age: number,
		public grade: string
	) { }
}
