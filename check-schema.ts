import { Database } from 'bun:sqlite';

const db = new Database('data.db');
const result = db.query('PRAGMA table_info(students)').all();
console.log(JSON.stringify(result, null, 2));
db.close();
