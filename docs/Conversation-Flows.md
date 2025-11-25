# Conversation Flows Documentation

## Overview

The bot uses a tree-based conversation system where each conversation is a series of steps (text input or button menus) that guide users through operations. All conversations are built using the `ConversationBuilder` class or the `createTreeConversation` function.

## Base Conversation System

### Location
`src/conversations/baseConversation.ts`

### Key Components

#### ConversationBuilder

A fluent builder API for creating conversations:

```typescript
new ConversationBuilder<{name: string, age: string}>()
  .text('name', 'Enter your name:')
  .text('age', 'Enter your age:', {
    validate: (text) => !isNaN(Number(text)),
    error: 'Please enter a valid number'
  })
  .build(async (results) => {
    // Handle success
  })
```

#### Step Types

1. **TextStep**: Collects text input from user
   - `prompt`: Message to display
   - `validate`: Optional validation function
   - `error`: Error message if validation fails
   - `next`: Next step (can be conditional)

2. **ButtonStep**: Presents inline keyboard options
   - `options`: Array of button options
   - `inPlace`: Edit message in place (better UX)
   - `onSelect`: Callback when option is selected

## Available Conversations

### 1. Student Management (`/students`)

**Entry Point**: `src/conversations/students/studentCrud.ts`

**Flow**:
1. **Operation Selection** (Button Menu)
   - Create
   - Update
   - Delete
   - Cancel

#### Create Flow (`flows/create.ts`)

1. Enter first name (text)
2. Enter last name (text)
3. Enter birth year (text, validated as YYYY)
4. Enter group (text)
5. Enter phone (text, optional)
6. Enter father's phone (text, optional)
7. Enter mother's phone (text, optional)
8. Success → Creates student record

#### Update Flow (`flows/update.ts`)

1. Search for student (fuzzy search)
2. Select student from results
3. Update fields (similar to create)
4. Success → Updates student record

#### Delete Flow (`flows/delete.ts`)

1. Search for student (fuzzy search)
2. Select student from results
3. Confirm deletion
4. Success → Deletes student record

### 2. Teacher Management (`/teachers`)

**Entry Point**: `src/conversations/teachers/teacherCrud.ts`

Similar structure to student management:
- Create: first name, last name, phone number, group
- Update: search → select → update fields
- Delete: search → select → confirm → delete

**Differences**:
- Phone number is required and must be unique
- No birth year or parent phone fields

### 3. Browse (`/browse`)

**Entry Point**: `src/conversations/browse/browseConversation.ts`

**Flow**:
1. **What to browse?** (Button Menu)
   - Students
   - Teachers

2. **Filter/Search** (Button Menu)
   - All (show all records)
   - Filter by group (select group from list)
   - Search (fuzzy search by name)

3. **Results Display**
   - Paginated list of results
   - Navigation: Previous/Next buttons
   - Change filter option

**Features**:
- Fuzzy search using Fuse.js
- Group filtering
- Pagination support
- In-place message editing for smooth navigation

### 4. Memorization (`/memorize`)

**Entry Point**: `src/conversations/memorization/memorizationConversation.ts`

**Flow**:
1. Enter student name (text)
2. Fuzzy search results (button menu)
3. Select student
4. Enter page number (text, validated 0-604)
5. Success → Creates memorization record

**Validation**:
- Page number must be between 0 and 604
- Student must exist

### 5. Attendance (`/attendance`)

**Entry Point**: `src/conversations/attendance/attendanceTaking.ts`

**Flow**:
1. **Attendance Method** (Button Menu)
   - By Group
   - All Students
   - By First Name
   - By Last Name
   - Search Student

2. **Enter Event Name** (text)
   - Examples: "Friday Prayer", "Class", "Event Name"

3. **Method-Specific Flow**:

   **By Group**:
   - Select group (button menu)
   - Show students in group
   - Mark attendance (button for each student)
   
   **All Students**:
   - Show all students
   - Mark attendance (button for each student)
   
   **By Name/Search**:
   - Enter name or search query
   - Select student from results
   - Mark attendance

**Features**:
- Prevents duplicate attendance (same day, same event)
- Shows attendance status for each student
- Quick toggle (present/absent)

#### Teacher Quick Attendance (`attendance/teacherQuickAttendance.ts`)

Specialized flow for teachers:
- Authenticates teacher by phone number
- Shows only students in teacher's group
- Streamlined attendance taking

### 6. Summary (`/summary`)

**Entry Point**: `src/conversations/summaryConversation.ts`

**Flow**:
1. **Summary Type** (Button Menu)
   - Attendance Summary
   - Memorization Summary

2. **Filters**:
   - Select group (optional)
   - Select date range (for attendance)
   - Select student (optional)

3. **Display Results**:
   - Attendance: Shows attendance records with dates and events
   - Memorization: Shows memorization progress with page numbers

## Conversation Lifecycle

1. **Entry**: User triggers command or conversation
2. **Step Execution**: Bot presents step (text prompt or buttons)
3. **User Response**: User provides input
4. **Validation**: Input validated (if applicable)
5. **Next Step**: Move to next step or branch
6. **Completion**: All steps completed
7. **Success Handler**: `onSuccess` callback executed
8. **Success Message**: User receives confirmation

## Error Handling

### Validation Errors
- Invalid input → Show error message → Retry step
- Error messages are internationalized

### Cancellation
- User can cancel at any button step
- Cancellation shows greeting message
- Conversation state cleared

### Exceptions
- Caught by try-catch in `createTreeConversation`
- Logged via Winston logger
- User sees failure message

## Internationalization

All prompts and messages use the i18n system:
- Keys defined in `src/locales/en.ts` and `src/locales/ar.ts`
- Language determined by user session
- Default: English

**Usage**:
```typescript
t('enter_first_name', getLang(ctx.session))
```

## Best Practices

1. **Use ConversationBuilder**: For complex flows, use the builder API
2. **Validate Early**: Validate input as soon as possible
3. **Provide Clear Prompts**: Make it obvious what input is expected
4. **Handle Cancellation**: Always provide cancel option
5. **Use In-Place Editing**: For multi-step menus, use `inPlace: true`
6. **Type Safety**: Use TypeScript types for conversation results
7. **Error Messages**: Provide helpful error messages

## Adding New Conversations

1. Create conversation file in appropriate directory
2. Define conversation using `ConversationBuilder` or `createTreeConversation`
3. Register in `src/index.ts`:
   ```typescript
   bot.use(createConversation(myConversation, 'myConversationName'));
   ```
4. Add command handler:
   ```typescript
   bot.command('mycommand', async (ctx) => {
     await ctx.conversation.enter('myConversationName');
   });
   ```
5. Add i18n keys to `src/locales/en.ts` and `src/locales/ar.ts`

## Example: Creating a Simple Conversation

```typescript
import { ConversationBuilder } from '../baseConversation.js';
import { StudentRepo } from '../../model/drizzle/repos.js';

export const myConversation = (repo: StudentRepo) => {
  return new ConversationBuilder<{name: string}>()
    .text('name', 'enter_student_name', {
      validate: (text) => text.length > 0,
      error: 'name_required'
    })
    .build(
      async (results) => {
        // Process results.name
        await repo.create({...});
      },
      {
        successMessage: 'student_created',
        failureMessage: 'creation_failed'
      }
    );
};
```



