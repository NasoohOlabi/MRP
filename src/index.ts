// load .env file
import dotenv from 'dotenv';
import { getSheetDBClient } from './sheetdb/sheetdb.js';
import { StudentRepo } from './model/Student.js';

const env = dotenv.config().parsed! as {
	BOT_TOKEN: string,
	GOOGLE_SHEET_ID: string,
	LOG_LEVEL: string,
	SHEET_DB: string,
	SHEET_DB_TOKEN: string,
};

// Example of using the modernized SheetDB client
const sheetdb = getSheetDBClient({
	address: env.SHEET_DB,
	version: '1',
	token: env.SHEET_DB_TOKEN
});


const studentsRepo = new StudentRepo(sheetdb)

const s = await studentsRepo.read()

console.log(s)

console.log(s[0].birth_date)