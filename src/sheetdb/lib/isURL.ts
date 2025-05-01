/**
 * Check if the address is a URL
 * @param address The address to check
 * @returns True if the address is a URL, false otherwise
 */
export function isURL(address: string): boolean {
	const pattern = new RegExp("^https:\/\/");
	return pattern.test(address);
}