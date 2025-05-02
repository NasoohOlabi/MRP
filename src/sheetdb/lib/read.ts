/**
 * Read data from SheetDB
 */
import type { ReadParams, SheetDBConfig } from '../types';

export function read(this: { config: SheetDBConfig }, params?: ReadParams): Promise<any> {
	const config = this.config;
	const requestParams = params || {};

	return new Promise((resolve, reject) => {
		const { limit, offset, search, sheet } = requestParams;

		// Build URL with query parameters
		let url = config.address;
		const queryParams: string[] = [];

		// Add search parameters if provided
		if (search && Object.keys(search).length > 0) {
			url += '/search';

			Object.entries(search).forEach(([key, value], index) => {
				queryParams.push(`${key}=${value}`);
			});
		}

		// Add limit, offset, and sheet parameters if provided
		if (limit) queryParams.push(`limit=${limit}`);
		if (offset) queryParams.push(`offset=${offset}`);
		if (sheet) queryParams.push(`sheet=${sheet}`);

		// Add query parameters to URL
		if (queryParams.length > 0) {
			url += `?${queryParams.join('&')}`;
		}

		// Set headers
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
			method: 'GET',
			headers,
		})
			.then(response => response.json())
			.then(data => resolve(data))
			.catch(error => reject(error));
	});
}