# Simplified Architecture

This project uses a **feature-based architecture** where code is organized by domain feature (Students, Teachers, Attendance, Memorization) rather than by technical layers.

## Directory Structure

```
src/
├── bot.ts                 # Main bot setup and configuration
├── index.ts               # Entry point
├── types.d.ts             # Shared TypeScript types
├── db/                    # Database configuration
│   ├── index.ts          # Database connection
│   └── schema.ts         # Drizzle ORM schema
├── features/              # Feature modules
│   ├── students/
│   │   ├── model.ts      # Student domain model, repository, and service
│   │   └── conversations.ts  # Student-related bot conversations
│   ├── teachers/
│   │   ├── model.ts
│   │   └── conversations.ts
│   ├── attendance/
│   │   ├── model.ts
│   │   └── conversations.ts
│   └── memorization/
│       ├── model.ts
│       └── conversations.ts
├── utils/                 # Shared utilities
│   ├── i18n.ts           # Internationalization
│   ├── logger.ts         # Logging configuration
│   └── ...               # Other utilities
└── locales/              # Translation files
    ├── en.ts
    └── ar.ts
```

## Key Principles

### 1. Feature-Based Organization
Each feature (Students, Teachers, etc.) is self-contained in its own folder with:
- **model.ts**: Domain models, repository (data access), and service (business logic)
- **conversations.ts**: Telegram bot conversation flows

### 2. Simple Procedural Conversations
Instead of a complex "step engine" with JSON-like configurations, conversations are written as simple procedural functions using `grammy-conversations`:

```typescript
async function createStudentConversation(conversation, ctx) {
  // Ask for name
  await ctx.reply('Enter first name:');
  const response = await conversation.wait();
  const firstName = response.message.text;
  
  // Ask for last name
  await ctx.reply('Enter last name:');
  const response2 = await conversation.wait();
  const lastName = response2.message.text;
  
  // Save to database
  await studentService.register({ firstName, lastName, ... });
}
```

**Benefits:**
- **Easy to follow**: Data flow is linear and visible through local variables
- **Standard pattern**: Uses standard `grammy-conversations` API
- **No abstractions**: No hidden "step engine" or complex state machines

### 3. Layered Model Structure
Each feature follows a three-layer pattern within `model.ts`:

1. **Domain Model**: Simple TypeScript interfaces representing entities
2. **Repository**: Data access layer (talks to database)
3. **Service**: Business logic layer (talks to repository)

Example:
```typescript
// Domain Model
interface Student {
  id: number;
  firstName: string;
  lastName: string;
  // ...
}

// Repository (data access)
class StudentRepo {
  async findAll(): Promise<Student[]> { ... }
  async create(data): Promise<Student> { ... }
}

// Service (business logic)
class StudentService {
  constructor(private repo: StudentRepo) {}
  
  async register(params): Promise<Student> {
    return this.repo.create(params);
  }
}
```

### 4. Centralized Database
All database configuration is in `src/db/`:
- **index.ts**: Database connection using Drizzle ORM
- **schema.ts**: Table definitions

## Conversation Flow

1. User sends command (e.g., `/students`)
2. Bot enters conversation (`studentMenuConversation`)
3. Conversation shows menu and waits for user input
4. User selects action (Create, Update, Delete, View)
5. Conversation branches to appropriate sub-conversation
6. Sub-conversation collects data step-by-step using `await conversation.wait()`
7. Data is passed to service layer
8. Service validates and calls repository
9. Repository saves to database
10. Success message shown to user

## Adding a New Feature

1. Create `src/features/yourfeature/model.ts`:
   - Define domain interface
   - Create Repository class
   - Create Service class

2. Create `src/features/yourfeature/conversations.ts`:
   - Write procedural conversation functions
   - Use `await conversation.wait()` to collect user input

3. Register in `src/bot.ts`:
   ```typescript
   import { yourFeatureConversation } from './features/yourfeature/conversations.js';
   bot.use(createConversation(yourFeatureConversation, 'yourfeature'));
   bot.command('yourfeature', async (ctx) => {
     await ctx.conversation.enter('yourfeature');
   });
   ```

## Why This Is Simpler

### Before (Complex)
- Multiple layers: conversations/, core/, infrastructure/
- Abstract "step engine" with JSON-like step definitions
- Hidden state management
- Hard to trace data flow

### After (Simple)
- Features grouped together
- Direct procedural code
- Explicit data flow with local variables
- Easy to read and modify

## Development

```bash
# Start the bot
bun run src/index.ts

# The bot will connect to Telegram and start handling messages
```

## Technologies

- **Bun**: JavaScript runtime
- **Grammy**: Telegram bot framework
- **Drizzle ORM**: Type-safe SQL query builder
- **SQLite**: Database
- **TypeScript**: Type safety


