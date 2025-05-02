import type { ReadParams, RowData, SheetDBClient } from "../sheetdb/sheetdb";

export abstract class BaseRepo<T>  {

	protected constructor(
		protected db: SheetDBClient,
		protected sheet: string | null = null,
		protected track_dates = false
	) {
	}

	protected async _read(params?: Omit<ReadParams, 'sheet'>): Promise<T[]> {
		return await this.db.read({ ...params, sheet: this.sheet! }) as T[];
	}

	protected async _create(params: RowData) {
		if (this.track_dates) {
			params.created_at = new Date().toISOString();
			params.updated_at = new Date().toISOString();
		}
		return await this.db.create(params, this.sheet!) as T[];
	}

	protected async _update(columnName: string, value: string | number, newRow: RowData) {
		if (this.track_dates) {
			newRow.updated_at = new Date().toISOString();
		}
		return await this.db.update(columnName, value, newRow, this.sheet!) as T[];
	}

	protected async _delete(columnName: string, value: string | number) {
		return await this.db.delete(columnName, value, this.sheet!) as T[];
	}
}