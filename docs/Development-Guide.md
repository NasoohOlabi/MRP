# Development Guide

## Getting Started

### Prerequisites

- **Bun**: Latest version installed ([installation guide](https://bun.sh/docs/installation))
- **Git**: For version control
- **Code Editor**: VS Code recommended (with TypeScript extension)

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd MRP
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your BOT_TOKEN
   ```

4. **Initialize database**:
   ```bash
   bun run drizzle
   ```

5. **Start development server**:
   ```bash
   bun run dev
   ```

## Project Structure

```
src/
├── conversations/      # Conversation flows
│   ├── attendance/     # Attendance-related conversations
│   ├── browse/        # Browse/search conversations
│   ├── memorization/  # Memorization tracking
│   ├── students/      # Student CRUD
│   ├── teachers/      # Teacher CRUD
│   └── baseConversation.ts  # Core conversation system
├── locales/           # Internationalization
├── model/             # Data layer
│   └── drizzle/       # Database schema and repos
├── utils/             # Utility functions
├── index.ts           # Main entry point
└── types.d.ts         # Type definitions
```

## Development Workflow

### 1. Creating a New Conversation

#### Step 1: Create Conversation File

Create a new file in the appropriate directory:

```typescript
// src/conversations/myfeature/myConversation.ts
import { ConversationBuilder } from '../baseConversation.js';
import { StudentRepo } from '../../model/drizzle/repos.js';

export const myConversation = (repo: StudentRepo) => {
  return new ConversationBuilder<{name: string}>()
    .text('name', 'enter_name', {
      validate: (text) => text.length > 0,
      error: 'name_required'
    })
    .build(
      async (results) => {
        // Process results
        await repo.create({...});
      },
      {
        successMessage: 'operation_completed',
        failureMessage: 'operation_failed'
      }
    );
};
```

#### Step 2: Register Conversation

In `src/index.ts`:

```typescript
import { createConversation } from '@grammyjs/conversations';
import { myConversation } from './conversations/myfeature/myConversation.js';

bot.use(createConversation(myConversation(studentRepo), 'myConversation'));
```

#### Step 3: Add Command Handler

```typescript
bot.command('mycommand', async (ctx) => {
  await ctx.conversation.enter('myConversation');
});
```

#### Step 4: Add Translations

In `src/locales/en.ts` and `src/locales/ar.ts`:

```typescript
export const en = {
  // ... existing keys
  enter_name: "Enter name:",
  name_required: "Name is required",
};
```

### 2. Adding Database Tables

#### Step 1: Update Schema

In `src/model/drizzle/schema.ts`:

```typescript
export const myTable = sqliteTable('my_table', {
  id: integer('id').primaryKey(),
  name: text('name', { length: 255 }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
```

#### Step 2: Create Repository

In `src/model/drizzle/repos.ts`:

```typescript
export class MyRepo {
  async create(params: {...}): Promise<MyEntity> {
    // Implementation
  }
  
  async read(): Promise<MyEntity[]> {
    // Implementation
  }
}
```

#### Step 3: Run Migration

```bash
bun run drizzle
```

### 3. Adding New Repository Methods

1. Add method to repository class
2. Use Drizzle ORM for queries
3. Convert database rows to domain models
4. Handle errors appropriately

Example:

```typescript
public async findByGroup(group: string): Promise<Student[]> {
  const rows = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.group, group));
  return rows.map(toStudentDomain);
}
```

## Code Style

### TypeScript

- Use explicit types, avoid `any`
- Use interfaces for object shapes
- Use `async/await` for asynchronous operations
- Handle errors with try-catch

### Naming Conventions

- **PascalCase**: Classes, types, interfaces
- **camelCase**: Functions, variables, methods
- **UPPER_CASE**: Constants
- **kebab-case**: File names (optional, current project uses camelCase)

### File Organization

- One class/function per file (when possible)
- Group related functionality
- Keep files focused and small

### Comments

- Use JSDoc for public APIs
- Explain "why", not "what"
- Keep comments up to date

Example:

```typescript
/**
 * Creates a new student record.
 * 
 * @param params - Student data (without id, timestamps)
 * @returns Created student with generated ID
 * @throws Error if validation fails
 */
public async create(params: CreateStudentParams): Promise<Student> {
  // Implementation
}
```

## Testing

### Manual Testing

1. Start bot: `bun run dev`
2. Test commands in Telegram
3. Check logs for errors
4. Verify database changes

### Test Checklist

- [ ] Conversation flows work correctly
- [ ] Validation works as expected
- [ ] Error handling is graceful
- [ ] Translations are correct
- [ ] Database operations succeed
- [ ] Edge cases handled

## Debugging

### Logging

Use the logger for debugging:

```typescript
import { logger } from './utils/logger.js';

logger.debug('Debug message', { data });
logger.info('Info message');
logger.error('Error occurred', error);
```

### Common Issues

1. **Conversation not starting**: Check registration in `index.ts`
2. **Translation missing**: Add key to locale files
3. **Database errors**: Check schema and migrations
4. **Type errors**: Run `tsc --noEmit` to check types

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for verbose logging.

## Git Workflow

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `fix/*`: Bug fixes

### Commit Messages

Use conventional commits:

```
feat: add student search functionality
fix: resolve attendance duplicate issue
docs: update API documentation
refactor: simplify conversation builder
```

### Pull Requests

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Create PR with description
6. Request review

## Performance Considerations

### Database Queries

- Use indexes for frequently queried fields
- Avoid N+1 queries
- Use pagination for large datasets

### Memory Management

- Avoid storing large objects in session
- Clean up unused data
- Monitor memory usage

### Conversation Performance

- Keep conversation trees shallow when possible
- Use in-place editing for better UX
- Cache frequently accessed data

## Internationalization

### Adding Translations

1. Add key to `src/locales/en.ts`
2. Add translation to `src/locales/ar.ts`
3. Use `t()` function in code:

```typescript
await ctx.reply(t('my_key', getLang(ctx.session)));
```

### Translation Keys

- Use descriptive, hierarchical keys
- Keep keys consistent
- Document complex translations

## Best Practices

1. **Type Safety**: Leverage TypeScript types
2. **Error Handling**: Always handle errors gracefully
3. **User Experience**: Provide clear feedback
4. **Security**: Validate all user input
5. **Documentation**: Keep docs updated
6. **Testing**: Test before committing
7. **Code Review**: Get feedback on changes

## Resources

- [Grammy.js Documentation](https://grammy.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Getting Help

1. Check existing documentation
2. Review code examples in the project
3. Check GitHub issues
4. Ask in team chat/forum
5. Contact maintainers



