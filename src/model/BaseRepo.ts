import type { ReadParams, RowData, SheetDBClient } from "../sheetdb/sheetdb";

export abstract class BaseRepo<T>  {
	protected sheet: string | null = null;
	constructor(
		protected db: SheetDBClient
	) {
		if (!this.sheet) {
			throw new Error('Sheet not defined');
		}
	}

	public async read<T>(params: Omit<ReadParams, 'sheet'>) {
		return await this.db.read({ ...params, sheet: this.sheet! }) as T[];
	}

	public async create<T>(params: RowData) {
		return await this.db.create(params, this.sheet!) as T[];
	}

	public async update<T>(columnName: string, value: string | number, newRow: RowData) {
		return await this.db.update(columnName, value, newRow, this.sheet!) as T[];
	}

	public async delete<T>(columnName: string, value: string | number) {
		return await this.db.delete(columnName, value, this.sheet!) as T[];
	}
}