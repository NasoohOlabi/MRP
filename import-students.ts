import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './src/model/drizzle/schema';
import { readFileSync } from 'fs';


// Initialize database connection
const sqlite = new Database('data.db');
const db = drizzle(sqlite, { schema });

async function importStudents() {
    try {
        console.log('🗑️  Deleting all existing students...');

        // Delete all students from the table
        await db.delete(schema.students);

        console.log('✅ All students deleted successfully\n');

        console.log('📂 Reading students.csv file...');

        // Read the CSV file
        const csvContent = readFileSync('students.csv', 'utf-8');

        // Parse CSV properly handling multi-line fields
        const records = parseCSV(csvContent);

        console.log(`📊 Found ${records.length} records to process\n`);

        let imported = 0;
        let skipped = 0;

        for (const record of records) {
            const { birthYear, motherPhone, group, fatherPhone, firstName, lastName } = record;

            // Skip if essential fields are missing
            if (!firstName?.trim() || !lastName?.trim()) {
                console.log(`⚠️  Skipping incomplete record: ${firstName || '?'} ${lastName || '?'} (${group || 'no group'})`);
                skipped++;
                continue;
            }

            // Parse birth year
            const birthYearNum = parseInt(birthYear.trim());
            if (isNaN(birthYearNum)) {
                console.log(`⚠️  Skipping invalid birth year for: ${firstName} ${lastName}`);
                skipped++;
                continue;
            }

            try {
                // Clean phone numbers (remove newlines and extra spaces)
                const cleanMotherPhone = motherPhone?.replace(/[\r\n]/g, ' ').trim() || null;
                const cleanFatherPhone = fatherPhone?.replace(/[\r\n]/g, ' ').trim() || null;

                // Insert student into database
                await db.insert(schema.students).values({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    birthYear: birthYearNum,
                    group: group.trim(),
                    phone: null, // Not in CSV
                    fatherPhone: cleanFatherPhone,
                    motherPhone: cleanMotherPhone,
                });

                imported++;
                console.log(`✅ Imported: ${firstName.trim()} ${lastName.trim()} (${group.trim()})`);
            } catch (error) {
                console.error(`❌ Error importing ${firstName} ${lastName}:`, error);
                skipped++;
            }
        }

        console.log('\n📊 Import Summary:');
        console.log(`   ✅ Successfully imported: ${imported} students`);
        console.log(`   ⚠️  Skipped: ${skipped} records`);
        console.log(`   📝 Total processed: ${records.length} records`);

    } catch (error) {
        console.error('❌ Error during import:', error);
        process.exit(1);
    } finally {
        // Close database connection
        sqlite.close();
    }
}

// Proper CSV parser that handles quoted fields with newlines
function parseCSV(content: string): Array<{
    birthYear: string;
    motherPhone: string;
    group: string;
    fatherPhone: string;
    firstName: string;
    lastName: string;
}> {
    const records: Array<any> = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    // Skip header line
    while (i < content.length && content[i] !== '\n') {
        i++;
    }
    i++; // Skip the newline after header

    while (i < content.length) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (!inQuotes && char === ',') {
            // End of field
            currentRecord.push(currentField);
            currentField = '';
            i++;
            continue;
        }

        if (!inQuotes && (char === '\n' || (char === '\r' && nextChar === '\n'))) {
            // End of record
            currentRecord.push(currentField);
            currentField = '';

            // Only add non-empty records
            if (currentRecord.length === 6 && currentRecord.some(f => f.trim())) {
                records.push({
                    birthYear: currentRecord[0],
                    motherPhone: currentRecord[1],
                    group: currentRecord[2],
                    fatherPhone: currentRecord[3],
                    firstName: currentRecord[4],
                    lastName: currentRecord[5],
                });
            }

            currentRecord = [];

            // Skip \r\n or just \n
            if (char === '\r' && nextChar === '\n') {
                i += 2;
            } else {
                i++;
            }
            continue;
        }

        // Regular character
        currentField += char;
        i++;
    }

    // Handle last record if file doesn't end with newline
    if (currentField || currentRecord.length > 0) {
        currentRecord.push(currentField);
        if (currentRecord.length === 6 && currentRecord.some(f => f.trim())) {
            records.push({
                birthYear: currentRecord[0],
                motherPhone: currentRecord[1],
                group: currentRecord[2],
                fatherPhone: currentRecord[3],
                firstName: currentRecord[4],
                lastName: currentRecord[5],
            });
        }
    }

    return records;
}

// Run the import
importStudents();
