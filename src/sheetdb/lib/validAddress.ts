/**
 * Check if the address is a valid SheetDB address
 * @param address The address to check
 * @returns True if the address is valid, false otherwise
 */
export function validAddress(address: string): boolean {
	const pattern = new RegExp("^https:\/\/sheetdb.io");
	const res = pattern.test(address);

	return res || address.indexOf('http') === -1;
}