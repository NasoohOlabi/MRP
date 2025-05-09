# Coding Style and Conventions

## 1. Language

* **TypeScript**: The project is exclusively written in TypeScript. Utilize strong typing wherever possible to enhance code quality and maintainability.
* **ES Modules**: The project uses ES Modules (`"type": "module"` in `package.json`). Use `import` and `export` syntax.

## 2. File Structure

The project follows a modular structure within the `src/` directory:

* `src/`
  * `conversations/`: Contains logic for different bot conversations.
    * `baseConversation.ts`: Core utility for building tree-like conversations.
    * `students/`: Example: `studentCrud.ts` for student management conversation.
  * `index.ts`: The main entry point for the bot, including initialization, middleware setup, and command/message handlers.
  * `model/`: Defines data models and repository classes.
    * `BaseRepo.ts`: Abstract base repository for common database operations.
    * `Student.ts`: Concrete repository and model for students.
  * `sheetdb/`: Contains the client and utilities for interacting with the SheetDB API.
    * `sheetdb.ts`: The main `SheetDBClient` and related functions.
    * `lib/`: Helper functions for the SheetDB client.
    * `types.ts`: Type definitions specific to SheetDB.
  * `types.d.ts`: Global TypeScript type definitions for the application (e.g., context types, conversation step types).

## 3. Asynchronous Operations

* **`async/await`**: Extensively used for all I/O-bound operations (API calls, conversation steps) to maintain non-blocking behavior.

## 4. Error Handling

* **`try...catch` blocks**: Used to handle potential errors, especially within conversation flows and API interactions.
* **Logging**: Errors are typically logged to the console using `console.error`.
* **User Feedback**: For errors within conversations, appropriate failure messages are sent to the user.

## 5. Dependencies

* **Package Manager**: Bun is used for package management and as the runtime.
* **`package.json`**: Defines project dependencies and scripts.
* **Key Dependencies**: `grammy`, `@grammyjs/conversations`, `dotenv`.

## 6. JSDoc Comments

* **Purpose**: Add JSDoc comments to public-facing functions, classes, methods, and complex type definitions.
* **Focus**: Especially important for core/base components like `baseConversation.ts`, `BaseRepo.ts`, and `SheetDBClient.ts` to explain their purpose, parameters, and return values.
* **Style**: Use `/** ... */` blocks. Include `@param`, `@returns`, `@template`, `@throws` where appropriate.

## 7. Naming Conventions

* **PascalCase**: For classes, types, and interfaces (e.g., `MyContext`, `SheetDBClient`, `TreeConversationOptions`).
* **camelCase**: For functions, methods, variables, and file names (e.g., `createTreeConversation`, `studentRepo`, `baseConversation.ts`).
* **Protected Members**: Methods intended for internal use within a class or its subclasses are often prefixed with an underscore (e.g., `_read`, `_create` in `BaseRepo`).

## 8. Code Formatting & Linting

* (Not explicitly defined in project files)
* **Recommendation**: Consider integrating Prettier for consistent code formatting and ESLint for identifying potential code issues and enforcing coding standards.

## 9. Type Definitions

* **Clarity**: Define clear and specific types for function parameters, return values, and complex objects.
* **Centralized Types**: Global types are in `src/types.d.ts`. Module-specific types (like for `sheetdb`) are co-located (e.g., `src/sheetdb/types.ts`).
