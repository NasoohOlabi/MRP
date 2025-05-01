/**
 * SheetDB TypeScript Definitions
 */

export interface SheetDBConfig {
	address: string;
	version?: string;
	auth_login?: string;
	auth_password?: string;
}

export interface SearchParams {
	[key: string]: string | number | boolean;
}

export interface ReadParams {
	limit?: number;
	offset?: number;
	search?: SearchParams;
	sheet?: string;
}

export interface SheetDBResponse {
	[key: string]: any;
}

export type RowData = Record<string, any>;