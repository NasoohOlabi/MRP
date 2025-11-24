# Architecture Documentation (Refactored)

## Overview

The MRP (Masjid Record Program) Telegram Bot has been refactored to follow a clean architecture pattern with clear separation of concerns, type safety, and comprehensive observability.

## Architecture Layers

### 1. Application Layer (`src/app/`)

**Location**: `src/app/`

The application layer contains the Telegram bot adapter and conversation handlers.

#### Components

- **`telegram/bot.ts`**: Main bot setup and command handlers
- **`telegram/conversations/`**: Conversation tree definitions
- **`telegram/middleware/`**: GrammY middleware (context injection, etc.)
- **`telegram/utils/`**: Telegram-specific utilities (greeting, help detection, LM Studio integration)

### 2. Core Layer (`src/core/`)

**Location**: `src/core/`

The core layer contains domain models and business logic.

#### Domain Models (`core/domain/`)

- **`student.ts`**: Immutable Student domain model
- **`teacher.ts`**: Immutable Teacher domain model
- **`attendance.ts`**: Immutable Attendance domain model
- **`memorization.ts`**: Immutable Memorization domain model
- **`mappers.ts`**: Mappers between database rows and domain models

#### Services (`core/services/`)

- **`studentService.ts`**: Student use cases (register, update, delete, search)
- **`teacherService.ts`**: Teacher use cases (register, update, delete, search)
- **`attendanceService.ts`**: Attendance use cases (record, query, remove)
- **`memorizationService.ts`**: Memorization use cases (record, query, remove)

Services wrap repositories and provide transaction management via Unit of Work pattern.

### 3. Infrastructure Layer (`src/infrastructure/`)

**Location**: `src/infrastructure/`

The infrastructure layer contains technical implementations.

#### Database (`infrastructure/db/`)

- **`schema.ts`**: Drizzle ORM schema definitions
- **`db.ts`**: Database connection
- **`unitOfWork.ts`**: Transaction management
- **`validators.ts`**: Zod validators for runtime type safety
- **`repositories/`**: Data access layer (pure CRUD operations)

#### Observability (`infrastructure/observability/`)

- **`logger.ts`**: Structured logging with Pino
- **`tracing.ts`**: OpenTelemetry tracing
- **`context.ts`**: Async context for request-scoped metadata

#### Internationalization (`infrastructure/i18n/`)

- **`index.ts`**: i18n utilities
- **`locales/`**: Translation files (en.ts, ar.ts)

## Data Flow

```
User Message (Telegram)
    ↓
Bot Middleware (Context Injection, Session)
    ↓
Command Handler / Conversation Entry
    ↓
Conversation Tree (baseConversation.ts)
    ↓
Service Layer (Business Logic + Transactions)
    ↓
Repository Layer (Data Access)
    ↓
Drizzle ORM
    ↓
SQLite Database
```

## Key Design Patterns

### 1. Clean Architecture

- **Separation of Concerns**: Clear boundaries between layers
- **Dependency Inversion**: Core layer doesn't depend on infrastructure
- **Domain-Driven Design**: Rich domain models with business logic

### 2. Repository Pattern

- Repositories provide pure data access
- No business logic in repositories
- Easy to swap implementations for testing

### 3. Service Layer Pattern

- Services encapsulate use cases
- Transaction management via Unit of Work
- Business rules enforced at service level

### 4. Unit of Work Pattern

- Ensures transactional consistency
- Wraps multiple repository operations in a single transaction

### 5. Domain Models

- Immutable domain objects
- Business logic in domain models
- Mappers convert between DB rows and domain models

## Type Safety

- **TypeScript strict mode**: Enabled with strictest flags
- **Zod validators**: Runtime type validation for all data
- **Branded types**: AnswerKey for conversation step keys
- **Type inference**: Strong type inference throughout

## Observability

### Logging

- Structured JSON logs with Pino
- Contextual metadata (userId, chatId, traceId)
- Daily rotation with 7-day retention
- Pretty printing in development

### Tracing

- OpenTelemetry integration
- Automatic instrumentation
- Custom spans for conversations and DB operations
- Trace context propagation

### Context

- AsyncLocalStorage for request-scoped context
- Automatic injection via middleware
- Available in all layers

## Testing

- Unit tests for services and repositories
- Integration tests for bot functionality
- Test utilities in `tests/` directory

## Migration Notes

The old codebase structure (`src/conversations/`, `src/model/drizzle/repos.ts`) is still present for backward compatibility. Conversations are gradually being migrated to use the new service layer.

