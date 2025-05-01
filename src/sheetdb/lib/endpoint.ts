/**
 * Access custom endpoints in SheetDB
 */
import type { SheetDBConfig } from '../types';

export function endpoint(
	this: { config: SheetDBConfig },
	endpoint: string,
	sheet?: string
): Promise<any> {
	const config = this.config;

	return new Promise((resolve, reject) => {
		const sheetParam = !sheet ? '' : `?sheet=${sheet}`;
		const url = `${config.address}/${endpoint}${sheetParam}`;

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
			method: 'GET',
			headers,
		})
			.then(response => response.json())
			.then(data => resolve(data))
			.catch(error => reject(error));
	});
}