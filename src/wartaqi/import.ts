import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { readFileSync } from 'fs';
import * as schema from './db/schema.js';

// Initialize database connection
const sqlite = new Database('wartaqi.db');
const db = drizzle(sqlite, { schema });

interface CSVRecord {
	firstName: string; // إسم
	lastName: string; // كنية
	inGroup: string; // in group
	phone: string; // رقم موبايل
	birthYear: string; // مواليد
	teacherName: string; // حلقة
	fullName: string; // الإسم الكامل
	attendanceCount: string; // الحضور
	level: string; // مستوى
	notebook: string; // كتيب (TRUE/FALSE)
	attendancePercentage: string; // نسبة الحضور
	attendanceStatuses: string[]; // Rest are attendance dates/flags
}

interface AttendanceDateColumn {
	header: string;
	isoDate: string | null;
}

interface ParsedCSVResult {
	records: CSVRecord[];
	attendanceDateColumns: AttendanceDateColumn[];
}

async function importWartaqi() {
	try {
		console.log('🗑️  Clearing existing data...');

		// Delete all existing data (in correct order due to foreign keys)
		await db.delete(schema.attendance);
		await db.delete(schema.notebookDeliveries);
		await db.delete(schema.students);
		await db.delete(schema.teachers);

		console.log('✅ All existing data cleared\n');

		console.log('📂 Reading Wartaqi.csv file...');

		// Read the CSV file
		const csvContent = readFileSync('Wartaqi.csv', 'utf-8');

		// Parse CSV
		const { records, attendanceDateColumns } = parseCSV(csvContent);

		const parsedAttendanceDates = attendanceDateColumns.filter((col) => col.isoDate).length;
		console.log(`📊 Found ${records.length} records to process`);
		console.log(`📆 Found ${attendanceDateColumns.length} attendance columns (${parsedAttendanceDates} parsed)\n`);

		const unmappedHeaders = attendanceDateColumns
			.filter((col) => !col.isoDate && col.header.trim())
			.map((col) => col.header.trim() || '(empty)');

		if (unmappedHeaders.length) {
			const preview = unmappedHeaders.slice(0, 5).join(', ');
			console.warn(
				`⚠️  ${unmappedHeaders.length} attendance headers could not be mapped to ISO dates: ${preview}${unmappedHeaders.length > 5 ? ', ...' : ''
				}`,
			);
		}

		// Extract unique teachers
		const teacherNames = new Set<string>();
		for (const record of records) {
			if (record.teacherName?.trim()) {
				teacherNames.add(record.teacherName.trim());
			}
		}

		console.log(`👨‍🏫 Found ${teacherNames.size} unique teachers\n`);

		// Insert teachers and create mapping
		const teacherMap = new Map<string, number>();
		for (const teacherName of teacherNames) {
			const [result] = await db
				.insert(schema.teachers)
				.values({ name: teacherName })
				.returning({ id: schema.teachers.id });
			teacherMap.set(teacherName, result.id);
			console.log(`✅ Inserted teacher: ${teacherName} (ID: ${result.id})`);
		}

		// Create a default teacher for students without assigned teachers
		const DEFAULT_TEACHER_NAME = 'غير محدد';
		let defaultTeacherId: number;
		if (teacherMap.has(DEFAULT_TEACHER_NAME)) {
			defaultTeacherId = teacherMap.get(DEFAULT_TEACHER_NAME)!;
		} else {
			const [result] = await db
				.insert(schema.teachers)
				.values({ name: DEFAULT_TEACHER_NAME })
				.returning({ id: schema.teachers.id });
			defaultTeacherId = result.id;
			teacherMap.set(DEFAULT_TEACHER_NAME, defaultTeacherId);
			console.log(`✅ Created default teacher: ${DEFAULT_TEACHER_NAME} (ID: ${defaultTeacherId})`);
		}

		console.log('\n📚 Importing students...\n');

		let imported = 0;
		let skipped = 0;
		let totalAttendanceRecords = 0;

		for (const record of records) {
			const { firstName, lastName, phone, birthYear, teacherName, level, notebook } = record;

			// Only require firstName and lastName - everything else is optional
			if (!firstName?.trim() || !lastName?.trim()) {
				console.log(`⚠️  Skipping record missing name: ${firstName || '?'} ${lastName || '?'}`);
				skipped++;
				continue;
			}

			// Use default teacher if no teacher is assigned
			const assignedTeacherName = teacherName?.trim() || DEFAULT_TEACHER_NAME;
			let teacherId = teacherMap.get(assignedTeacherName);

			// If teacher doesn't exist in map, use default
			if (!teacherId) {
				teacherId = defaultTeacherId;
				if (assignedTeacherName !== DEFAULT_TEACHER_NAME) {
					console.log(`⚠️  Unknown teacher "${assignedTeacherName}" for ${firstName} ${lastName}, using default teacher`);
				}
			}

			// Parse birth year (optional)
			let birthYearNum: number | null = null;
			if (birthYear?.trim()) {
				const parsed = parseInt(birthYear.trim());
				if (!isNaN(parsed)) {
					birthYearNum = parsed;
				}
			}

			// Parse level (optional, 1-4)
			let levelNum: number | null = null;
			if (level?.trim()) {
				const parsed = parseInt(level.trim());
				if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
					levelNum = parsed;
				}
			}

			// Clean phone number
			const cleanPhone = phone?.replace(/[\r\n]/g, ' ').trim() || null;

			try {
				// Insert student
				const [student] = await db
					.insert(schema.students)
					.values({
						firstName: firstName.trim(),
						lastName: lastName.trim(),
						birthYear: birthYearNum,
						phone: cleanPhone,
						level: levelNum,
						teacherId: teacherId,
					})
					.returning({ id: schema.students.id });

				// If notebook is TRUE, insert a delivery record for their current level
				if (notebook?.trim().toUpperCase() === 'TRUE' && levelNum !== null) {
					await db.insert(schema.notebookDeliveries).values({
						studentId: student.id,
						level: levelNum,
					});
				}

				// Insert attendance records for parsed dates
				let attendanceForStudent = 0;
				for (let columnIndex = 0; columnIndex < attendanceDateColumns.length; columnIndex++) {
					const column = attendanceDateColumns[columnIndex];
					const status = normalizeAttendanceStatus(record.attendanceStatuses[columnIndex]);

					if (!status || !column.isoDate) {
						continue;
					}

					await db.insert(schema.attendance).values({
						studentId: student.id,
						date: column.isoDate,
						status,
						teacherId,
					});

					attendanceForStudent++;
				}

				totalAttendanceRecords += attendanceForStudent;

				imported++;
				console.log(`✅ Imported: ${firstName.trim()} ${lastName.trim()} (Level: ${levelNum || 'N/A'}, Teacher: ${teacherName.trim()})`);
			} catch (error) {
				console.error(`❌ Error importing ${firstName} ${lastName}:`, error);
				skipped++;
			}
		}

		console.log('\n📊 Import Summary:');
		console.log(`   ✅ Successfully imported: ${imported} students`);
		console.log(`   📅 Attendance records stored: ${totalAttendanceRecords}`);
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

// CSV parser that handles the Wartaqi.csv format
function parseCSV(content: string): ParsedCSVResult {
	const records: CSVRecord[] = [];
	const lines = content.split('\n');

	if (!lines.length) {
		return { records, attendanceDateColumns: [] };
	}

	const headerFields = parseCSVLine(lines[0] || '');
	const attendanceDateColumns = buildAttendanceDateColumns(headerFields.slice(11));

	// Skip header line (line 0) and summary line (line 1)
	for (let i = 2; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Parse CSV line (simple split by comma, handling quoted fields)
		const fields = parseCSVLine(line);

		if (fields.length < 11) {
			// Skip incomplete rows
			continue;
		}

		const attendanceStatuses = fields.slice(11);

		records.push({
			firstName: fields[0] || '',
			lastName: fields[1] || '',
			inGroup: fields[2] || '',
			phone: fields[3] || '',
			birthYear: fields[4] || '',
			teacherName: fields[5] || '',
			fullName: fields[6] || '',
			attendanceCount: fields[7] || '',
			level: fields[8] || '',
			notebook: fields[9] || '',
			attendancePercentage: fields[10] || '',
			attendanceStatuses,
		});
	}

	return { records, attendanceDateColumns };
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6,
};

function buildAttendanceDateColumns(headers: string[]): AttendanceDateColumn[] {
	const columns: AttendanceDateColumn[] = [];
	let lastResolvedDate: Date | null = null;

	for (const header of headers) {
		const cleanedHeader = header.replace(/^"+|"+$/g, '').trim();
		const headerLabel = cleanedHeader || header.trim() || '(empty)';

		if (!cleanedHeader) {
			columns.push({ header: headerLabel, isoDate: null });
			continue;
		}

		const parsed = parseAttendanceHeaderLabel(cleanedHeader);
		if (!parsed) {
			columns.push({ header: headerLabel, isoDate: null });
			continue;
		}

		const resolvedDate = lastResolvedDate
			? findNextMatchingDateAfter(lastResolvedDate, parsed.dayOfMonth, parsed.dayOfWeek)
			: findMostRecentMatchingDate(parsed.dayOfMonth, parsed.dayOfWeek);

		if (!resolvedDate) {
			columns.push({ header: headerLabel, isoDate: null });
			continue;
		}

		columns.push({ header: headerLabel, isoDate: formatDateISO(resolvedDate) });
		lastResolvedDate = resolvedDate;
	}

	return columns;
}

function parseAttendanceHeaderLabel(header: string): { dayOfWeek: number; dayOfMonth: number } | null {
	const normalized = header.toLowerCase();
	const dayNameMatch = normalized.match(/\b(sun|mon|tue|wed|thu|fri|sat)\b/);
	const dayNumberMatch = normalized.match(/\b(\d{1,2})\b/);

	if (!dayNameMatch || !dayNumberMatch) {
		return null;
	}

	const dayOfWeek = DAY_NAME_TO_INDEX[dayNameMatch[1]];
	const dayOfMonth = parseInt(dayNumberMatch[1], 10);

	if (dayOfWeek === undefined || isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
		return null;
	}

	return { dayOfWeek, dayOfMonth };
}

function findMostRecentMatchingDate(dayOfMonth: number, dayOfWeek: number): Date | null {
	const reference = new Date();
	reference.setHours(0, 0, 0, 0);

	for (let offset = 0; offset < 365; offset++) {
		const candidate = new Date(reference);
		candidate.setDate(reference.getDate() - offset);

		if (candidate.getDate() === dayOfMonth && candidate.getDay() === dayOfWeek) {
			return candidate;
		}
	}

	return null;
}

function findNextMatchingDateAfter(lastDate: Date, dayOfMonth: number, dayOfWeek: number): Date | null {
	for (let offset = 1; offset <= 90; offset++) {
		const candidate = new Date(lastDate);
		candidate.setDate(lastDate.getDate() + offset);

		if (candidate.getDate() === dayOfMonth && candidate.getDay() === dayOfWeek) {
			return candidate;
		}
	}

	return null;
}

function formatDateISO(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

const PRESENT_ATTENDANCE_VALUES = new Set(['TRUE', 'PRESENT', 'P', '1', 'YES', 'Y']);
const ABSENT_ATTENDANCE_VALUES = new Set(['FALSE', 'ABSENT', 'A', '0', 'NO', 'N']);

function normalizeAttendanceStatus(value?: string): 'present' | 'absent' | null {
	if (!value) {
		return null;
	}

	const normalized = value.trim().toUpperCase();
	if (!normalized) {
		return null;
	}

	if (PRESENT_ATTENDANCE_VALUES.has(normalized)) {
		return 'present';
	}

	if (ABSENT_ATTENDANCE_VALUES.has(normalized)) {
		return 'absent';
	}

	return null;
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let currentField = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				currentField += '"';
				i++;
			} else {
				// Toggle quote mode
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// End of field
			fields.push(currentField);
			currentField = '';
		} else {
			currentField += char;
		}
	}

	// Add last field
	fields.push(currentField);

	return fields;
}

// Run the import
importWartaqi();

