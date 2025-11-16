# MRP Telegram Bot

This project is a Telegram bot designed to manage student and teacher data. It leverages the grammy.js framework for bot interactions, drizzle-orm for database management, and potentially integrates with Google Sheets for data storage or synchronization.

## Features

*   **Student Management**: Create, read, update, and delete student records.
*   **Teacher Management**: Create, read, update, and delete teacher records.
*   **Browse Functionality**: View and search through student and teacher data.
*   **Conversational Interface**: User-friendly interactions through Telegram commands and guided conversations.

## Technologies Used

*   **Bun**: Fast all-in-one JavaScript runtime.
*   **TypeScript**: Strongly typed superset of JavaScript.
*   **Grammy.js**: A Telegram Bot API framework for Node.js.
*   **@grammyjs/conversations**: Plugin for grammy.js to handle multi-step conversations.
*   **Drizzle ORM**: TypeScript ORM for relational databases.
*   **dotenv**: Loads environment variables from a `.env` file.
*   **Google Spreadsheet**: (Potentially) for data storage or integration.
*   **Fuse.js**: Lightweight fuzzy-search library.

## Setup

To get this project up and running, follow these steps:

1.  **Clone the repository**:

    ```bash
    git clone <repository_url>
    cd mrp
    ```

2.  **Install Dependencies**:

    This project uses `bun` as its package manager. If you don't have `bun` installed, you can install it by following the instructions on [Bun's official website](https://bun.sh/docs/installation).

    ```bash
    bun install
    ```

3.  **Environment Variables**:

    Create a `.env` file in the root directory of the project and add the following environment variables:

    ```env
    BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    LOG_LEVEL=info
    ```

    *   `BOT_TOKEN`: Obtain this from BotFather on Telegram.

## Running the Bot

To start the bot, run the following command:

```bash
bun run src/index.ts
```

Alternatively, you can use the `dev` script defined in `package.json`:

```bash
bun run dev
```

## Bot Commands

Once the bot is running, you can interact with it using the following commands:

*   `/start`: Initiates the bot and displays a welcome message.
*   `/students`: Enters the student management conversation.
*   `/teachers`: Enters the teacher management conversation.
*   `/browse`: Enters the browsing conversation for student and teacher data.

## Project Structure

```
.gitignore
README.md
bun.lockb
docs/
├── Coding Style and Conventions.md
└── Project Setup and Running Instructions.md
package-lock.json
package.json
src/
├── conversations/             # Defines conversational flows for the bot
│   ├── attendance.ts
│   ├── baseConversation.ts
│   ├── browse/                # Browse related conversations
│   ├── students/              # Student management conversations
│   └── teachers/              # Teacher management conversations
├── index.ts                   # Main entry point of the bot application
├── model/                     # Database models and repositories
│   └── drizzle/               # Drizzle ORM specific configurations and repos
└── types.d.ts                 # TypeScript declaration file for custom types
tsconfig.json
```
