console.log("Hello via Bun!");

// Import the modernized SheetDB client
import { sheetdbClient } from './src/sheetdb/index.js';

// Example of using the modernized SheetDB client
const sheetdb = sheetdbClient({
	address: 'a3knoedogbebf', // Your SheetDB ID
	version: '1',
	// Optional authentication
	// auth_login: 'your-login',
	// auth_password: 'your-password'
});

// Example: Read data from SheetDB
async function fetchData() {
	try {
		const data = await sheetdb.read();
		console.log('Data from SheetDB:', data);
	} catch (error) {
		console.error('Error fetching data:', error);
	}
}

// Uncomment to run the example
// fetchData();

