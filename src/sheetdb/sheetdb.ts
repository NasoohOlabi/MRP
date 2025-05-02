/**
 * SheetDB TypeScript Library
 * Modernized version using Bun and TypeScript
 */

import { create } from './lib/create.js';
import { deleteRow } from './lib/delete.js';
import { endpoint } from './lib/endpoint.js';
import { isURL } from './lib/isURL.js';
import { read } from './lib/read.js';
import { update } from './lib/update.js';
import { validAddress } from './lib/validAddress.js';
import type { ReadParams, RowData, SheetDBConfig, SheetDBResponse } from './types.js';

/**
 * SheetDBClient class for interacting with SheetDB API
 */
export class SheetDBClient {
	private config: SheetDBConfig;

	/**
	 * Create a new SheetDBClient instance
	 * @param config Configuration for SheetDB
	 */
	constructor(config?: SheetDBConfig) {
		const configParam = config || {} as SheetDBConfig;

		configParam.version = configParam.version || '1';
		configParam.token = configParam.token || '';

		if (!configParam.address) {
			throw Error('address param needed');
		}

		if (!validAddress(configParam.address)) {
			throw Error('wrong address param.');
		}

		if (!isURL(configParam.address)) {
			configParam.address = 'https://sheetdb.io/api/v' +
				configParam.version + '/' +
				configParam.address;
		}

		this.config = configParam;
	}

	/**
	 * Create a new row in the SheetDB
	 * @param newRow Data for the new row
	 * @param sheet Optional sheet name
	 * @returns Promise with the API response
	 */
	create(newRow: RowData, sheet?: string): Promise<SheetDBResponse> {
		return create(this.config, newRow, sheet);
	}

	/**
	 * Read data from SheetDB
	 * @param params Optional read parameters
	 * @returns Promise with the API response
	 */
	read(params?: ReadParams): Promise<SheetDBResponse> {
		return read(this.config, params);
	}

	/**
	 * Update data in SheetDB
	 * @param columnName Column name to match
	 * @param value Value to match
	 * @param newRow New data for the row
	 * @param sheet Optional sheet name
	 * @returns Promise with the API response
	 */
	update(columnName: string, value: string | number, newRow: RowData, sheet?: string): Promise<SheetDBResponse> {
		return update(this.config, columnName, value, newRow, sheet);
	}

	/**
	 * Delete data from SheetDB
	 * @param columnName Column name to match
	 * @param value Value to match
	 * @param sheet Optional sheet name
	 * @returns Promise with the API response
	 */
	delete(columnName: string, value: string | number, sheet?: string): Promise<SheetDBResponse> {
		return deleteRow(this.config, columnName, value, sheet);
	}

	/**
	 * Access custom endpoints in SheetDB
	 * @param endpointName Custom endpoint name
	 * @param sheet Optional sheet name
	 * @returns Promise with the API response
	 */
	endpoint(endpointName: string, sheet?: string): Promise<SheetDBResponse> {
		return endpoint(this.config, endpointName, sheet);
	}
}

/**
 * Create a new SheetDBClient instance
 * @param config Configuration for SheetDB
 * @returns SheetDBClient instance
 */
export function getSheetDBClient(config?: SheetDBConfig): SheetDBClient {
	return new SheetDBClient(config);
}

export default getSheetDBClient;

// Export types
export * from './types.js';

