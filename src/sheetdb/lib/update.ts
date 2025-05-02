/**
 * Update data in SheetDB
 */
import type { RowData, SheetDBConfig } from '../types';

export function update(
	config: SheetDBConfig,
	columnName: string,
	value: string | number,
	newRow: RowData,
	sheet?: string
): Promise<any> {

	return new Promise((resolve, reject) => {
		if (!columnName) {
			return reject('no column name');
		}

		const sheetParam = !sheet ? '' : `?sheet=${sheet}`;
		const url = `${config.address}/${columnName}/${value}${sheetParam}`;

		const headers: HeadersInit = {
			'Accept': 'application/vnd.sheetdb.3+json',
			'Content-Type': 'application/json',
			'X-User-Agent': `SheetDB-Bun/${config.version || '1'}`
		};

		// Add authorization header if credentials are provided
		if (config.token) {
			headers['Authorization'] = `Bearer ${config.token}`;
		}

		// Use fetch API instead of XMLHttpRequest
		fetch(url, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ data: newRow }),
		})
			.then(response => response.json())
			.then(data => resolve(data))
			.catch(error => reject(error));
	});
}