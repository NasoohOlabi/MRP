# MRP Telegram Bot

A comprehensive, AI-powered Telegram bot for managing student and teacher records, attendance tracking, and memorization progress for mosques and educational institutions. Built with modern web technologies for performance and scalability.

## 🚀 Features

### Core Management
*   **Student Management**: Full CRUD operations with fuzzy search capabilities.
*   **Teacher Management**: Manage teacher profiles and assignments.
*   **Attendance Tracking**: Flexible attendance taking (by group, name, or search).
*   **Memorization Tracking**: Record and track Quran memorization progress (pages 0-604).

### User Experience
*   **Conversational Interface**: Intuitive, tree-based conversation flows.
*   **Multi-language Support**: Full support for English and Arabic (extensible).
*   **Smart Search**: Fuzzy search using Fuse.js to find records quickly.
*   **AI Assistant**: Integrated with LM Studio for intelligent help and query resolution.

### Technical
*   **Data Persistence**: SQLite database with Drizzle ORM for type-safe queries.
*   **Logging**: Comprehensive logging with Winston and daily rotation.
*   **Architecture**: Modular, feature-based architecture for easy maintenance.

## 🛠️ Tech Stack

*   **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime & package manager.
*   **Language**: [TypeScript](https://www.typescriptlang.org/) - Static typing for robustness.
*   **Framework**: [Grammy.js](https://grammy.dev/) - Next-gen Telegram Bot framework.
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - Lightweight and type-safe.
*   **Database**: SQLite (via `@libsql/client`).
*   **Search**: [Fuse.js](https://www.fusejs.io/) - Powerful fuzzy-search library.
*   **AI/LLM**: Integration with local LLMs via LM Studio.

## 📋 Prerequisites

*   **Bun**: v1.0.0 or higher.
*   **Telegram Bot Token**: From [@BotFather](https://t.me/BotFather).
*   **LM Studio** (Optional): For AI help features.

## ⚡ Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/mrp.git
    cd mrp
    ```

2.  **Install dependencies**
    ```bash
    bun install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    BOT_TOKEN=your_telegram_bot_token
    LOG_LEVEL=info
    LM_STUDIO_URL=http://localhost:1234
    LM_STUDIO_MODEL=local-model
    ```

4.  **Run Migrations**
    Initialize the database schema:
    ```bash
    bun run drizzle
    ```

5.  **Start the Bot**
    Development mode with hot-reload:
    ```bash
    bun run dev
    ```
    Production build:
    ```bash
    bun run build
    bun start
    ```

## 📂 Project Structure

```
MRP/
├── src/
│   ├── bot/                 # Bot initialization and core logic
│   ├── db/                  # Database schema and connection
│   ├── features/            # Feature modules (students, teachers, etc.)
│   ├── locales/             # i18n translation files
│   ├── utils/               # Shared utilities (logger, helpers)
│   └── index.ts             # Entry point
├── docs/                    # Detailed documentation
├── tests/                   # Unit and integration tests
└── drizzle.config.json      # ORM configuration
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

Please ensure you add tests for new features and update documentation as needed.

## 🗺️ Roadmap & Todo

We have an ambitious plan to evolve MRP into a full-fledged educational management platform.

### Phase 1: Enhanced Management & UI
- [ ] **Web Dashboard**: Admin panel for easier data management.
- [ ] **Analytics Dashboard**: Visual charts for attendance and memorization.
- [ ] **Role-Based Access Control (RBAC)**: Fine-grained permissions system.
- [ ] **Bulk Import/Export**: Enhanced CSV/Excel support for data migration.

### Phase 2: Automation & Reliability
- [ ] **Automated Backups**: Scheduled DB backups to cloud storage.
- [ ] **Notifications System**: Automated reminders for attendance/events.
- [ ] **Docker Support**: Containerization for easy deployment.
- [ ] **CI/CD Pipeline**: Automated testing and deployment workflows.
- [ ] **Rate Limiting**: Prevent abuse of the bot.

### Phase 3: Advanced Features
- [ ] **Multi-Tenancy**: Support for multiple masjids/organizations.
- [ ] **Student Performance Reports**: PDF generation for progress reports.
- [ ] **Gamification**: Badges and points for memorization milestones.
- [ ] **QR Code Attendance**: Fast check-in for students.
- [ ] **Audit Logging**: Track who changed what and when.

### Phase 4: Integration & Expansion
- [ ] **API Access**: REST/GraphQL API for external integrations.
- [ ] **Webhook Support**: Trigger external events on bot actions.
- [ ] **Localization Editor**: UI for managing translations.
- [ ] **Interactive Onboarding**: Guided tour for new admins.
- [ ] **Dark Mode**: For the web dashboard.

### Phase 5: Future Concepts
- [ ] **Student ID Cards**: Generate printable ID cards.
- [ ] **Advanced Search**: Filter by multiple criteria (age, level, etc.).
- [ ] **Teacher Performance Metrics**: Track teacher activity/effectiveness.
- [ ] **Class Scheduling**: Manage class times and locations.
- [ ] **Feedback System**: Allow users to report bugs/suggestions.

## 📄 License

[MIT](LICENSE)
