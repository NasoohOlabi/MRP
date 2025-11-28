# Project Setup and Running Instructions

## 1. Prerequisites

* **Bun.js**: This project uses Bun as its JavaScript runtime and package manager. Ensure you have Bun installed. You can find installation instructions at [https://bun.sh/](https://bun.sh/).

## 2. Installation

1. **Clone the Repository** (if you haven't already):

    ```bash
    git clone <repository-url>
    cd MRP # Or your project directory name
    ```

2. **Install Dependencies**:
    Open your terminal in the project root directory (`d:\Masjid\MRP`) and run:

    ```bash
    bun install
    ```

    This will install all the necessary packages defined in `package.json`.

## 3. Configuration

The application requires certain environment variables to function correctly, particularly API tokens and service IDs.

1. **Create `.env` file**:
    In the root directory of the project (`d:\Masjid\MRP`), create a file named `.env`.

2. **Add Environment Variables**:
    Open the `.env` file and add the following variables, replacing the placeholder values with your actual credentials:

    ```env
    BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
    WARTAQI_BOT_TOKEN="YOUR_WARTAQI_TELEGRAM_BOT_TOKEN"
    SHEET_DB="YOUR_SHEETDB_API_ENDPOINT_OR_SPREADSHEET_ID"
    SHEET_DB_TOKEN="YOUR_SHEETDB_API_TOKEN" # Optional, if your SheetDB API requires authentication

    # Optional:
    # LOG_LEVEL="info" # Example, if you implement more granular logging
    ```

    * `BOT_TOKEN`: Your Telegram Bot token obtained from BotFather.
    * `SHEET_DB`: The API endpoint or ID for your SheetDB instance (which connects to your Google Sheet).
    * `SHEET_DB_TOKEN`: If your SheetDB API is protected by a token, provide it here.

## 4. Running the Bot

Once the dependencies are installed and the `.env` file is configured, you can start the bot.

1. **Run the start script**:
    In your terminal, from the project root directory, execute:

    ```bash
    bun run ./src/index.ts
    ```

    Alternatively, if you have a script defined in `package.json` (e.g., `"run": "bun run ./src/index.ts"`), you can use:

    ```bash
    bun run
    ```

The bot should now start, connect to Telegram, and be ready to process commands and messages. Check your terminal for any startup logs or error messages.

2. **Run the Wartaqi bot**:
    ```bash
    bun run start:wartaqi
    ```
    This script launches the standalone Wartaqi bot that uses the `WARTAQI_BOT_TOKEN` and persists data to `WartaqiDB.db`.

## 5. Development

* **TypeScript Compilation**: Bun handles TypeScript compilation automatically when you run the `.ts` files.
* **Nodemon (Optional)**: For a better development experience with automatic restarts on file changes, you might consider using a tool like `nodemon`:

    ```bash
    bun add -d nodemon # Install as dev dependency
    # Then update your package.json script or run directly:
    # "dev": "nodemon --exec bun run ./src/index.ts --watch src"
    # bun run dev
    ```
