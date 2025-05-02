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
import type { SheetDBConfig } from './types.js';

/**
 * SheetDB client for interacting with SheetDB API
 * @param config Configuration for SheetDB
 * @returns SheetDB client instance
 */
export function getSheetDBClient(config?: SheetDBConfig) {
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

	return {
		config: configParam,
		create,
		read,
		update,
		delete: deleteRow,
		endpoint,
	};
}

export default getSheetDBClient;

// Export types
export * from './types.js';

