# Database Schema Documentation

## Overview

The application uses SQLite as the database, managed through Drizzle ORM. The schema consists of four main tables: `students`, `teachers`, `attendance`, and `memorization`.

## Schema Location

- **Schema Definition**: `src/model/drizzle/schema.ts`
- **Database File**: `data.db` (SQLite)
- **Config**: `drizzle.config.json`

## Tables

### 1. Students Table

**Table Name**: `students`

Stores student information including personal details and contact information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing student ID |
| `first_name` | TEXT(255) | NOT NULL | Student's first name |
| `last_name` | TEXT(255) | NOT NULL | Student's last name |
| `birth_year` | INTEGER | NOT NULL | Year of birth (YYYY) |
| `phone` | TEXT(20) | NULL | Student's phone number (optional) |
| `father_phone` | TEXT(20) | NULL | Father's phone number (optional) |
| `mother_phone` | TEXT(20) | NULL | Mother's phone number (optional) |
| `group` | TEXT(100) | NOT NULL | Student's group/class assignment |
| `created_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Creation timestamp |
| `updated_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Last update timestamp |

**Relations**:
- One-to-many with `attendance` table
- One-to-many with `memorization` table

**Cascade Behavior**: When a student is deleted, all related attendance and memorization records are automatically deleted (CASCADE).

### 2. Teachers Table

**Table Name**: `teacher`

Stores teacher information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing teacher ID |
| `first_name` | TEXT(255) | NOT NULL | Teacher's first name |
| `last_name` | TEXT(255) | NOT NULL | Teacher's last name |
| `phone_number` | TEXT(20) | NOT NULL, UNIQUE | Teacher's phone number (must be unique) |
| `group` | TEXT(100) | NOT NULL | Teacher's assigned group/class |
| `created_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Creation timestamp |
| `updated_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Last update timestamp |

**Unique Constraints**:
- `phone_number` must be unique across all teachers

### 3. Attendance Table

**Table Name**: `attendance`

Tracks student attendance for various events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing attendance record ID |
| `student_id` | INTEGER | NOT NULL, FOREIGN KEY | Reference to `students.id` |
| `event` | TEXT(255) | NOT NULL | Name/type of event (e.g., "Friday Prayer", "Class") |
| `created_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | When attendance was recorded |
| `updated_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Last update timestamp |

**Foreign Keys**:
- `student_id` → `students.id` (ON DELETE CASCADE)

**Business Rules**:
- A student cannot have duplicate attendance for the same event on the same day
- The `AttendanceRepo.create()` method enforces this rule

### 4. Memorization Table

**Table Name**: `memorization`

Tracks student memorization progress (Quran pages).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing memorization record ID |
| `student_id` | INTEGER | NOT NULL, FOREIGN KEY | Reference to `students.id` |
| `page` | INTEGER | NOT NULL | Page number memorized (0-604) |
| `created_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | When memorization was recorded |
| `updated_at` | INTEGER (timestamp) | NOT NULL, DEFAULT | Last update timestamp |

**Foreign Keys**:
- `student_id` → `students.id` (ON DELETE CASCADE)

**Business Rules**:
- Page numbers should be between 0 and 604 (validated in conversation flow)

## Timestamp Handling

All timestamps are stored as integers representing Unix timestamps (seconds since epoch). SQLite uses `strftime('%s', 'now')` for default values.

**Conversion**:
- Database: INTEGER (Unix timestamp in seconds)
- Application: JavaScript `Date` objects
- Conversion handled automatically by Drizzle ORM with `mode: 'timestamp'`

## Indexes

Currently, the schema relies on primary keys and foreign keys for indexing. Consider adding indexes for:
- `students.group` (for filtering by group)
- `attendance.student_id` + `attendance.event` + `attendance.created_at` (for attendance queries)
- `memorization.student_id` (for student memorization history)

## Migration

Database migrations are handled by Drizzle Kit:

```bash
bun run drizzle
```

This pushes schema changes to the database. The schema is defined in TypeScript, and Drizzle generates the SQL migrations automatically.

## Data Integrity

### Constraints

1. **Foreign Key Constraints**: Enforced at database level
2. **Cascade Deletes**: Students deletion cascades to attendance and memorization
3. **Unique Constraints**: Teacher phone numbers must be unique
4. **NOT NULL Constraints**: Required fields are enforced

### Application-Level Validation

- Phone number format validation (in conversation flows)
- Birth year range validation
- Page number range validation (0-604)
- Duplicate attendance prevention (same day, same event)

## Backup Recommendations

Since SQLite is a file-based database:

1. **Regular Backups**: Copy `data.db` regularly
2. **Version Control**: Do NOT commit `data.db` to git (should be in `.gitignore`)
3. **Export Scripts**: Consider creating export scripts for CSV/JSON backups

## Example Queries

### Get all students in a group
```typescript
const students = await db.select()
  .from(studentsTable)
  .where(eq(studentsTable.group, 'Group A'));
```

### Get attendance for a student
```typescript
const attendance = await db.select()
  .from(attendanceTable)
  .where(eq(attendanceTable.studentId, studentId));
```

### Get student with attendance records
```typescript
const studentWithAttendance = await db.query.students.findFirst({
  where: eq(studentsTable.id, studentId),
  with: { attendanceRecords: true }
});
```

