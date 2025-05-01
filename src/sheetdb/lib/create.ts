/**
 * Create a new row in the SheetDB
 */
import type { RowData, SheetDBConfig } from '../types';

// Use Bun's built-in fetch API instead of XMLHttpRequest
export function create(this: { config: SheetDBConfig }, newRow: RowData, sheet?: string): Promise<any> {
	const config = this.config;

	return new Promise((resolve, reject) => {
		const sheetParam = !sheet ? '' : `?sheet=${sheet}`;
		const url = `${config.address}${sheetParam}`;

		const headers: HeadersInit = {
			'Accept': 'application/vnd.sheetdb.3+json',
			'Content-Type': 'application/json',
			'X-User-Agent': `SheetDB-Bun/${config.version || '1'}`
		};

		// Add authorization header if credentials are provided
		if (config.auth_login && config.auth_password) {
			const auth = btoa(`${config.auth_login}:${config.auth_password}`);
			headers['Authorization'] = `Basic ${auth}`;
		}

		// Use fetch API instead of XMLHttpRequest
		fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				data: newRow,
			}),
		})
			.then(response => response.json())
			.then(data => resolve(data))
			.catch(error => reject(error));
	});
}