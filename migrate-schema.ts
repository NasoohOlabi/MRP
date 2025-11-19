import { Database } from 'bun:sqlite';

const db = new Database('data.db');

console.log('🔧 Updating database schema...\n');

try {
    // Add the new columns if they don't exist
    console.log('Adding phone column...');
    db.run('ALTER TABLE students ADD COLUMN phone TEXT');

    console.log('Adding father_phone column...');
    db.run('ALTER TABLE students ADD COLUMN father_phone TEXT');

    console.log('Adding mother_phone column...');
    db.run('ALTER TABLE students ADD COLUMN mother_phone TEXT');

    console.log('Adding birth_year column...');
    db.run('ALTER TABLE students ADD COLUMN birth_year INTEGER');

    console.log('\n✅ Schema updated successfully!');
} catch (error: any) {
    if (error.message.includes('duplicate column name')) {
        console.log('⚠️  Columns already exist, skipping...');
    } else {
        console.error('❌ Error:', error.message);
    }
}

// Check if we need to migrate data from birth_date to birth_year
const hasData = db.query('SELECT COUNT(*) as count FROM students WHERE birth_date IS NOT NULL').get() as { count: number };

if (hasData.count > 0) {
    console.log('\n📊 Migrating birth_date to birth_year...');
    // Assuming birth_date was storing timestamps, we'll extract the year
    // If it's already a year, this will just copy it
    db.run(`UPDATE students SET birth_year = 
		CASE 
			WHEN birth_date < 3000 THEN birth_date
			ELSE strftime('%Y', datetime(birth_date, 'unixepoch'))
		END
		WHERE birth_year IS NULL`);
    console.log('✅ Data migrated!');
}

db.close();
console.log('\n✅ All done! You can now run the import script.');
