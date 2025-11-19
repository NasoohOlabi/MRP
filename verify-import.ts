import { Database } from 'bun:sqlite';

const db = new Database('data.db');

const count = db.query('SELECT COUNT(*) as count FROM students').get() as { count: number };
console.log(`📊 Total students in database: ${count.count}`);

// Show a few sample records
console.log('\n📝 Sample records:');
const samples = db.query(`
	SELECT first_name, last_name, birth_year, \`group\`, mother_phone, father_phone 
	FROM students 
	LIMIT 5
`).all();

samples.forEach((student: any) => {
    console.log(`  - ${student.first_name} ${student.last_name} (${student.birth_year}, ${student.group})`);
    if (student.mother_phone) console.log(`    Mother: ${student.mother_phone}`);
    if (student.father_phone) console.log(`    Father: ${student.father_phone}`);
});

db.close();
