# MRP Telegram Bot

A comprehensive Telegram bot for managing student and teacher records, attendance tracking, and memorization progress for a mosque/masjid. Built with Grammy.js, Drizzle ORM, and TypeScript.

**Note**: The bot is deployed on [@MasjidAlBootiBot](https://t.me/MasjidAlBootiBot) for production use.

## Features

* **Student Management**: Full CRUD operations for student records with fuzzy search
* **Teacher Management**: Create, update, and delete teacher records
* **Attendance Tracking**: Multiple methods for taking attendance (by group, by name, search)
* **Memorization Tracking**: Record and track student memorization progress (Quran pages 0-604)
* **Browse & Search**: View and search through student and teacher data with pagination
* **Summaries**: View attendance and memorization summaries
* **Multi-language Support**: English and Arabic interface
* **Conversational Interface**: User-friendly tree-based conversation flows
* **AI-Powered Help**: Ask questions about the bot using LM Studio integration (requires local LM Studio instance)

## Technologies Used

* **Bun**: Fast all-in-one JavaScript runtime and package manager
* **TypeScript**: Strongly typed superset of JavaScript
* **Grammy.js**: Modern Telegram Bot API framework
* **@grammyjs/conversations**: Plugin for handling multi-step conversations
* **Drizzle ORM**: TypeScript ORM for SQLite database
* **Fuse.js**: Lightweight fuzzy-search library
* **Winston**: Logging with daily rotation
* **dotenv**: Environment variable management

## Setup

To get this project up and running, follow these steps:

1. **Clone the repository**:

    ```bash
    git clone <repository_url>
    cd mrp
    ```

2. **Install Dependencies**:

    This project uses `bun` as its package manager. If you don't have `bun` installed, you can install it by following the instructions on [Bun's official website](https://bun.sh/docs/installation).

    ```bash
    bun install
    ```

3. **Environment Variables**:

    Create a `.env` file in the root directory of the project and add the following environment variables:

    ```env
    BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    LOG_LEVEL=info
    LM_STUDIO_URL=http://localhost:1234
    LM_STUDIO_MODEL=local-model
    ```

    * `BOT_TOKEN`: Obtain this from BotFather on Telegram.
    * `LOG_LEVEL`: Logging level (info, debug, warn, error).
    * `LM_STUDIO_URL`: (Optional) URL for your local LM Studio instance. Defaults to `http://localhost:1234`.
    * `LM_STUDIO_MODEL`: (Optional) Model name to use with LM Studio. Defaults to `local-model`.

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

* `/start` - Initiates the bot and displays a welcome message
* `/students` - Student management (create, update, delete)
* `/teachers` - Teacher management (create, update, delete)
* `/browse` - Browse and search student/teacher records
* `/memorize` - Record student memorization progress
* `/attendance` - Take attendance for events
* `/summary` - View attendance and memorization summaries
* `/help [question]` - Ask questions about the bot. Uses LM Studio (if running) to provide intelligent answers based on the codebase

## Project Structure

```
MRP/
├── docs/                      # Documentation
│   ├── Architecture.md        # System architecture overview
│   ├── Database-Schema.md    # Database schema documentation
│   ├── Conversation-Flows.md  # Conversation flow documentation
│   ├── API-Reference.md      # API and repository reference
│   ├── Coding Style and Conventions.md
│   └── Project Setup and Running Instructions.md
├── src/
│   ├── conversations/         # Conversation flows
│   │   ├── attendance/        # Attendance taking flows
│   │   ├── browse/            # Browse/search flows
│   │   ├── memorization/      # Memorization tracking
│   │   ├── students/          # Student CRUD flows
│   │   ├── teachers/          # Teacher CRUD flows
│   │   ├── baseConversation.ts # Core conversation system
│   │   └── summaryConversation.ts
│   ├── locales/               # Internationalization
│   │   ├── en.ts              # English translations
│   │   └── ar.ts              # Arabic translations
│   ├── model/                 # Data layer
│   │   └── drizzle/           # Drizzle ORM
│   │       ├── schema.ts      # Database schema
│   │       ├── db.ts          # Database connection
│   │       └── repos.ts       # Repository implementations
│   ├── utils/                 # Utilities
│   │   ├── i18n.ts            # Internationalization helper
│   │   ├── logger.ts          # Winston logger
│   │   ├── greeting.ts        # Greeting messages
│   │   ├── lmStudio.ts        # LM Studio integration
│   │   ├── codebaseContext.ts # Codebase context for LLM
│   │   └── helpDetector.ts    # Help question detection
│   ├── index.ts               # Main entry point
│   └── types.d.ts             # TypeScript type definitions
├── data.db                    # SQLite database (not in git)
├── drizzle.config.json        # Drizzle configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

* **[Architecture.md](docs/Architecture.md)** - System architecture, design patterns, and data flow
* **[Database-Schema.md](docs/Database-Schema.md)** - Complete database schema documentation
* **[Conversation-Flows.md](docs/Conversation-Flows.md)** - Detailed conversation flow documentation
* **[API-Reference.md](docs/API-Reference.md)** - Repository API and utility function reference
* **[Coding Style and Conventions.md](docs/Coding%20Style%20and%20Conventions.md)** - Code style guidelines
* **[Project Setup and Running Instructions.md](docs/Project%20Setup%20and%20Running%20Instructions.md)** - Setup guide

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure environment**:
   Create a `.env` file:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   LOG_LEVEL=info
   LM_STUDIO_URL=http://localhost:1234  # Optional: for AI-powered help
   LM_STUDIO_MODEL=local-model          # Optional: model name for LM Studio
   ```
   
   **Note**: To use the AI-powered help feature (`/help` command), you need to have LM Studio running locally with a model loaded. The bot will automatically detect help questions and use LM Studio to provide answers based on the codebase.

3. **Run the bot**:
   ```bash
   bun run dev
   ```

For detailed setup instructions, see [Project Setup and Running Instructions.md](docs/Project%20Setup%20and%20Running%20Instructions.md).

## Development

### Database Migrations

To apply schema changes:
```bash
bun run drizzle
```

### Adding New Features

1. Create conversation in appropriate `src/conversations/` directory
2. Register conversation in `src/index.ts`
3. Add command handler
4. Add i18n keys to `src/locales/en.ts` and `src/locales/ar.ts`

See [Conversation-Flows.md](docs/Conversation-Flows.md) for detailed guidance.

## License

[Add your license here]
