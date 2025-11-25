# Architecture Documentation

## Overview

The MRP (Masjid Record Program) Telegram Bot is a conversational bot built with Grammy.js that manages student and teacher records, attendance tracking, and memorization progress for a mosque/masjid. The application follows a modular architecture with clear separation of concerns.

## Architecture Layers

### 1. Presentation Layer (Conversations)

**Location**: `src/conversations/`

The bot uses a tree-based conversation system built on top of Grammy.js conversations plugin. All user interactions flow through structured conversation trees.

#### Core Components

- **`baseConversation.ts`**: Provides the foundational `ConversationBuilder` class and `createTreeConversation` function
  - Supports text input steps and button menu steps
  - Handles validation, error messages, and branching logic
  - Manages in-place message editing for better UX
  - Type-safe conversation building

#### Conversation Modules

- **Students** (`students/`): CRUD operations for student records
  - Create, Update, Delete flows
  - Student selection with fuzzy search
  
- **Teachers** (`teachers/`): CRUD operations for teacher records
  - Similar structure to students module
  
- **Attendance** (`attendance/`): Multiple attendance-taking methods
  - By group
  - By student name
  - Quick attendance for teachers
  - Search-based attendance
  
- **Memorization** (`memorization/`): Track student memorization progress
  - Record page numbers (0-604)
  - Student selection with search
  
- **Browse** (`browse/`): View and search student/teacher records
  - Filter by group
  - Fuzzy search functionality
  - Pagination support
  
- **Summary** (`summaryConversation.ts`): View attendance and memorization summaries

### 2. Business Logic Layer (Repositories)

**Location**: `src/model/drizzle/repos.ts`

The repository pattern abstracts database operations and provides domain models.

#### Repository Classes

- **`StudentRepo`**: Student CRUD operations
  - `read()`, `create()`, `update()`, `delete()`
  - `lookFor()`: Fuzzy search using Fuse.js
  
- **`TeacherRepo`**: Teacher CRUD operations
  - Similar to StudentRepo
  - `findByPhone()`: Find teacher by phone number
  - `teachersPhoneNumber()`: Check if phone exists
  
- **`AttendanceRepo`**: Attendance tracking
  - `create()`: Prevents duplicate attendance for same day/event
  - `hasAttended()`: Check if student attended on a date
  - `deleteToday()`: Remove today's attendance
  
- **`MemorizationRepo`**: Memorization records
  - `create()`: Record memorization page

#### Domain Models

Domain classes (`Student`, `Teacher`, `Attendance`, `Memorization`) use snake_case properties to match database schema while providing type safety.

### 3. Data Access Layer (Drizzle ORM)

**Location**: `src/model/drizzle/`

- **`schema.ts`**: SQLite table definitions using Drizzle ORM
- **`db.ts`**: Database connection configuration
- **`repos.ts`**: Repository implementations using Drizzle queries

### 4. Infrastructure Layer

**Location**: `src/utils/`, `src/locales/`

- **Internationalization** (`utils/i18n.ts`): Multi-language support (English/Arabic)
- **Logging** (`utils/logger.ts`): Winston-based logging with daily rotation
- **Greeting** (`utils/greeting.ts`): Welcome messages and cancellation handling

## Data Flow

```
User Message
    ↓
Telegram API
    ↓
Bot Middleware (Session, Conversations)
    ↓
Command Handler / Conversation Entry
    ↓
Conversation Tree (baseConversation.ts)
    ↓
Repository Layer (repos.ts)
    ↓
Drizzle ORM (db.ts, schema.ts)
    ↓
SQLite Database (data.db)
```

## Key Design Patterns

### 1. Tree Conversation Pattern

Conversations are built as trees of steps:
- **Text Steps**: Collect user input with validation
- **Button Steps**: Present options with inline keyboards
- **Branching**: Steps can conditionally branch based on user input

### 2. Repository Pattern

- Abstracts database operations
- Provides domain models separate from database schema
- Enables easy testing and swapping of data sources

### 3. Builder Pattern

`ConversationBuilder` uses fluent API for constructing conversations:
```typescript
new ConversationBuilder()
  .text('name', 'Enter name:')
  .menu('action', 'Choose action:', [...])
  .build(onSuccess)
```

### 4. Dependency Injection

Repositories are injected into conversation factories:
```typescript
studentCrudConversation(studentRepo)
```

## Type Safety

The project uses TypeScript extensively:
- **`types.d.ts`**: Core type definitions
  - `MyContext`: Extended Grammy context with session and conversations
  - `Step`: Union type for conversation steps
  - `AnswerKey`: Branded type for step keys
  - `TreeConversationOptions`: Configuration for tree conversations

## Session Management

Sessions store:
- `state`: Current conversation state
- `language`: User's preferred language ('en' | 'ar')

## Error Handling

- Try-catch blocks in conversation flows
- Error logging via Winston logger
- User-friendly error messages via i18n
- Graceful degradation on failures

## Scalability Considerations

- **Modular Conversations**: Each feature is self-contained
- **Repository Abstraction**: Easy to swap database backends
- **Type Safety**: Catches errors at compile time
- **Logging**: Comprehensive logging for debugging and monitoring




