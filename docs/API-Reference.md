# API Reference Documentation

## Repository API

All repositories are located in `src/model/drizzle/repos.ts` and provide CRUD operations for their respective entities.

### StudentRepo

Manages student records.

#### Methods

##### `read(): Promise<Student[]>`
Retrieves all students from the database.

**Returns**: Array of `Student` objects

**Example**:
```typescript
const students = await studentRepo.read();
```

##### `create(params): Promise<Student>`
Creates a new student record.

**Parameters**:
```typescript
{
  first_name: string;
  last_name: string;
  birth_year: number;
  group: string;
  phone?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
}
```

**Returns**: Created `Student` object with generated ID

**Example**:
```typescript
const student = await studentRepo.create({
  first_name: 'Ahmed',
  last_name: 'Ali',
  birth_year: 2010,
  group: 'Group A',
  phone: '+1234567890'
});
```

##### `update(student: Student): Promise<Student>`
Updates an existing student record.

**Parameters**: `Student` object with updated fields

**Returns**: Updated `Student` object

**Example**:
```typescript
student.group = 'Group B';
const updated = await studentRepo.update(student);
```

##### `delete(student: Student): Promise<{success: boolean}>`
Deletes a student record. Cascades to attendance and memorization records.

**Parameters**: `Student` object to delete

**Returns**: `{success: boolean}`

**Example**:
```typescript
await studentRepo.delete(student);
```

##### `lookFor(query: string): Promise<FuseResult<Student>[]>`
Performs fuzzy search on students.

**Parameters**: Search query string

**Returns**: Array of Fuse.js search results

**Example**:
```typescript
const results = await studentRepo.lookFor('Ahmed');
results.forEach(result => {
  console.log(result.item.first_name); // Student object
  console.log(result.score); // Match score (0 = perfect match)
});
```

---

### TeacherRepo

Manages teacher records.

#### Methods

##### `read(): Promise<Teacher[]>`
Retrieves all teachers.

##### `create(params): Promise<Teacher>`
Creates a new teacher.

**Parameters**:
```typescript
{
  first_name: string;
  last_name: string;
  phone_number: string; // Must be unique
  group: string;
}
```

##### `update(teacher: Teacher): Promise<Teacher>`
Updates a teacher record.

##### `delete(teacher: Teacher): Promise<{success: boolean}>`
Deletes a teacher record.

##### `lookFor(query: string): Promise<FuseResult<Teacher>[]>`
Fuzzy search for teachers.

##### `findByPhone(phone_number: string): Promise<Teacher | null>`
Finds a teacher by phone number.

**Returns**: `Teacher` if found, `null` otherwise

##### `teachersPhoneNumber(phone_number: string): Promise<boolean>`
Checks if a phone number exists.

**Returns**: `true` if phone exists, `false` otherwise

---

### AttendanceRepo

Manages attendance records.

#### Methods

##### `read(): Promise<Attendance[]>`
Retrieves all attendance records.

##### `create(params): Promise<Attendance | null>`
Creates an attendance record. Returns `null` if duplicate (same student, same event, same day).

**Parameters**:
```typescript
{
  student_id: number;
  event: string;
}
```

**Returns**: `Attendance` object or `null` if duplicate

**Example**:
```typescript
const attendance = await attendanceRepo.create({
  student_id: 1,
  event: 'Friday Prayer'
});
if (!attendance) {
  console.log('Already marked attendance today');
}
```

##### `update(attendance: Attendance): Promise<Attendance>`
Updates an attendance record.

##### `delete(attendance: Attendance): Promise<{success: boolean}>`
Deletes an attendance record.

##### `hasAttended(studentId: number, eventName: string, date: Date): Promise<boolean>`
Checks if a student attended a specific event on a given date.

**Returns**: `true` if attended, `false` otherwise

##### `deleteToday(studentId: number, eventName: string): Promise<{success: boolean}>`
Deletes today's attendance for a student and event.

**Returns**: `{success: boolean}`

---

### MemorizationRepo

Manages memorization records.

#### Methods

##### `create(params): Promise<Memorization>`
Creates a memorization record.

**Parameters**:
```typescript
{
  student_id: number;
  page: number; // 0-604
}
```

**Returns**: Created `Memorization` object

**Example**:
```typescript
const memorization = await memorizationRepo.create({
  student_id: 1,
  page: 15
});
```

---

## Domain Models

### Student

```typescript
class Student {
  id: number;
  first_name: string;
  last_name: string;
  birth_year: number;
  group: string;
  phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### Teacher

```typescript
class Teacher {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  group: string;
  created_at: Date;
  updated_at: Date;
}
```

### Attendance

```typescript
class Attendance {
  id: number;
  student_id: number;
  event: string;
  created_at: Date;
  updated_at: Date;
}
```

### Memorization

```typescript
class Memorization {
  id: number;
  student_id: number;
  page: number;
  created_at: Date;
  updated_at: Date;
}
```

---

## Utility Functions

### Internationalization (`src/utils/i18n.ts`)

#### `t(key: string, lang?: string, params?: Record<string, string>): string`
Translates a key to the specified language.

**Parameters**:
- `key`: Translation key
- `lang`: Language code ('en' | 'ar'), defaults to 'en'
- `params`: Optional parameters for string interpolation

**Example**:
```typescript
t('greeting', 'en') // "Welcome! Please use..."
t('selected_student_enter_page', 'en', {name: 'Ahmed'}) // "Selected Ahmed. Enter..."
```

#### `getLang(session: MySession): string`
Gets the language from user session.

**Returns**: Language code ('en' | 'ar')

---

### Logging (`src/utils/logger.ts`)

Winston logger instance with daily rotation.

#### Usage

```typescript
import { logger } from './utils/logger.js';

logger.info('Information message');
logger.error('Error message', error);
logger.warn('Warning message');
logger.debug('Debug message');
```

**Log Levels**: Set via `LOG_LEVEL` environment variable
- `error`
- `warn`
- `info`
- `debug`

**Log Files**:
- `logs/app-YYYY-MM-DD.jsonl`: Application logs
- `logs/exceptions-YYYY-MM-DD.jsonl`: Uncaught exceptions
- `logs/rejections-YYYY-MM-DD.jsonl`: Unhandled promise rejections

**Retention**: Logs kept for 7 days

---

### Greeting (`src/utils/greeting.ts`)

#### `sendGreeting(ctx: MyContext): Promise<void>`
Sends welcome message with available commands.

#### `cancelAndGreet(ctx: MyContext, btnCtx: MyContext): Promise<void>`
Cancels current operation and sends greeting.

---

## Bot Commands

All commands are registered in `src/index.ts`:

| Command | Description | Conversation |
|---------|-------------|--------------|
| `/start` | Welcome message | None |
| `/students` | Student management | `createStudentConversation` |
| `/teachers` | Teacher management | `createTeacherConversation` |
| `/browse` | Browse records | `browseStudentsConversation` |
| `/memorize` | Record memorization | `createMemorizationConversation` |
| `/attendance` | Take attendance | `attendanceTakingConversation` |
| `/summary` | View summaries | `summaryConversation` |

---

## Type Definitions

### MyContext

Extended Grammy context with session and conversation support:

```typescript
type MyContext = BaseContext & ConversationFlavor<BaseContext>;
```

### MySession

Session data structure:

```typescript
type MySession = {
  state?: string;
  language?: 'en' | 'ar';
};
```

### Step Types

See `src/types.d.ts` for complete type definitions:
- `TextStep`: Text input step
- `ButtonStep`: Button menu step
- `Step`: Union of step types
- `TreeConversationOptions`: Conversation configuration

---

## Error Handling

### Repository Errors

Repositories throw errors that should be caught:

```typescript
try {
  const student = await studentRepo.create({...});
} catch (error) {
  logger.error('Failed to create student:', error);
  // Handle error
}
```

### Conversation Errors

Conversations handle errors internally and show failure messages to users. Errors are logged automatically.

---

## Best Practices

1. **Always use async/await**: All repository methods are async
2. **Handle null returns**: Some methods return `null` (e.g., `AttendanceRepo.create()`)
3. **Use type safety**: Leverage TypeScript types for domain models
4. **Log errors**: Use logger for error tracking
5. **Validate input**: Validate before calling repository methods
6. **Use i18n**: Always use translation keys, not hardcoded strings



