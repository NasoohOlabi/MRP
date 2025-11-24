import { Database } from 'bun:sqlite';
import { AttendanceRepo, StudentRepo, TeacherRepo } from './repos';

async function ensureSchema() {
	// Ensure tables exist in the SQLite database before seeding
	const sqlite = new Database('data.db');
	sqlite.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      birth_date INTEGER NOT NULL,
      "group" TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE,
      "group" TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY,
      student_id INTEGER NOT NULL,
      event TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);
	sqlite.close();
}

async function seed() {
	await ensureSchema();

	const studentRepo = new StudentRepo();
	const teacherRepo = new TeacherRepo();
	const attendanceRepo = new AttendanceRepo();

	// Seed teachers (skip if phone already exists)
	const teachers = [
		{ first_name: 'Fatima', last_name: 'Ali', phone_number: '555-0101', group: 'A' },
		{ first_name: 'Omar', last_name: 'Hassan', phone_number: '555-0102', group: 'B' },
	];
	for (const t of teachers) {
		const exists = await teacherRepo.teachersPhoneNumber(t.phone_number);
		if (!exists) {
			await teacherRepo.create(t);
		}
	}

	// Seed students only if table is empty
	const studentsData = [
		{ first_name: 'Aisha', last_name: 'Khan', birth_year: 2015, group: 'A', phone: null, father_phone: null, mother_phone: null },
		{ first_name: 'Yusuf', last_name: 'Rahman', birth_year: 2014, group: 'A', phone: null, father_phone: null, mother_phone: null },
		{ first_name: 'Zain', last_name: 'Iqbal', birth_year: 2013, group: 'B', phone: null, father_phone: null, mother_phone: null },
		{ first_name: 'Maryam', last_name: 'Naseem', birth_year: 2015, group: 'B', phone: null, father_phone: null, mother_phone: null },
	];
	for (const s of studentsData) {
		await studentRepo.create(s);
	}

	// Seed attendance for first two students
	const students = await studentRepo.read();
	if (students.length > 0) {
		const s1 = students[0];
		await attendanceRepo.create({ student_id: s1.id, event: 'class' });
		await attendanceRepo.create({ student_id: s1.id, event: 'quran' });

		if (students[1]) {
			const s2 = students[1];
			await attendanceRepo.create({ student_id: s2.id, event: 'class' });
		}
	}

	// Output summary
	const outTeachers = await teacherRepo.read();
	const outStudents = await studentRepo.read();
	const outAttendance = await attendanceRepo.read();

	console.log('Seed summary:');
	console.log(`Teachers: ${outTeachers.length}`);
	console.log(`Students: ${outStudents.length}`);
	console.log(`Attendance: ${outAttendance.length}`);

	console.log('Teacher sample:', outTeachers.slice(0, 2));
	console.log('Student sample:', outStudents.slice(0, 3));
	console.log('Attendance sample:', outAttendance.slice(0, 5));
}

if (import.meta.main) {
	seed()
		.then(() => {
			console.log('Demo seeding completed.');
		})
		.catch((err) => {
			console.error('Seeding failed:', err);
			process.exit(1);
		});
}