# Deployment Guide

## Overview

This guide covers deploying the MRP Telegram Bot to production. The bot can be deployed on various platforms including VPS, cloud providers, or containerized environments.

## Prerequisites

- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Server/VPS with Node.js/Bun runtime support
- Domain name (optional, for webhooks)
- SSL certificate (if using webhooks)

## Environment Setup

### Required Environment Variables

Create a `.env` file with the following variables:

```env
BOT_TOKEN=your_telegram_bot_token_here
LOG_LEVEL=info
```

**Optional Variables**:
- `LOG_LEVEL`: Set logging level (`error`, `warn`, `info`, `debug`). Default: `info`

### Database

The bot uses SQLite (`data.db`), which is file-based. Ensure:
- The `data.db` file has proper write permissions
- The directory containing `data.db` is writable
- Consider regular backups of `data.db`

## Deployment Options

### Option 1: Direct Deployment (VPS/Server)

#### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

#### 2. Clone Repository

```bash
git clone <repository-url>
cd MRP
```

#### 3. Install Dependencies

```bash
bun install
```

#### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your BOT_TOKEN
```

#### 5. Initialize Database

The database will be created automatically on first run. To ensure schema is up to date:

```bash
bun run drizzle
```

#### 6. Run Bot

**Development mode** (with auto-reload):
```bash
bun run dev
```

**Production mode** (using PM2 or similar):
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start bun --name "mrp-bot" -- run src/index.ts

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Option 2: Docker Deployment

#### Dockerfile

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port (if needed for webhooks)
EXPOSE 3000

# Run bot
CMD ["bun", "run", "src/index.ts"]
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  bot:
    build: .
    env_file:
      - .env
    volumes:
      - ./data.db:/app/data.db
      - ./logs:/app/logs
    restart: unless-stopped
```

#### Build and Run

```bash
docker-compose up -d
```

### Option 3: Cloud Platforms

#### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Railway will auto-detect Bun and deploy

#### Render

1. Create new Web Service
2. Connect repository
3. Build command: `bun install`
4. Start command: `bun run src/index.ts`
5. Set environment variables

#### Heroku

1. Create `Procfile`:
   ```
   web: bun run src/index.ts
   ```

2. Add buildpack:
   ```bash
   heroku buildpacks:add https://github.com/oven-sh/bun.git
   ```

3. Deploy:
   ```bash
   git push heroku main
   ```

## Webhook vs Long Polling

### Long Polling (Default)

The bot uses long polling by default. This is simpler to set up but requires the bot to be running continuously.

### Webhooks (Optional)

For better scalability, you can use webhooks:

```typescript
// In src/index.ts, replace bot.start() with:
bot.api.setWebhook('https://yourdomain.com/webhook');

// Add webhook handler (using Express or similar)
import express from 'express';
const app = express();
app.use(express.json());
app.post('/webhook', async (req, res) => {
  await bot.handleUpdate(req.body);
  res.sendStatus(200);
});
app.listen(3000);
```

**Requirements for Webhooks**:
- HTTPS endpoint (SSL certificate)
- Public domain name
- Webhook handler server

## Monitoring

### Logs

Logs are automatically written to:
- `logs/app-YYYY-MM-DD.jsonl` - Application logs
- `logs/exceptions-YYYY-MM-DD.jsonl` - Exceptions
- `logs/rejections-YYYY-MM-DD.jsonl` - Unhandled rejections

Logs are rotated daily and kept for 7 days.

### Health Checks

Create a simple health check endpoint (if using webhooks):

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### Monitoring Tools

- **PM2**: Built-in monitoring with `pm2 monit`
- **Docker**: Use `docker stats` or monitoring tools
- **Cloud Platforms**: Use platform-specific monitoring

## Backup Strategy

### Database Backups

SQLite database (`data.db`) should be backed up regularly:

```bash
# Manual backup
cp data.db backups/data-$(date +%Y%m%d).db

# Automated backup script (cron)
0 2 * * * cp /path/to/MRP/data.db /path/to/backups/data-$(date +\%Y\%m\%d).db
```

### Log Backups

Logs are automatically rotated, but consider archiving:
- Keep logs for at least 30 days
- Archive older logs to cold storage

## Security Considerations

1. **Environment Variables**: Never commit `.env` file
2. **Bot Token**: Keep bot token secure, rotate if compromised
3. **Database**: Restrict file permissions on `data.db`
4. **Logs**: Don't log sensitive information (phone numbers, etc.)
5. **Access Control**: Consider adding user authentication/authorization

## Troubleshooting

### Bot Not Responding

1. Check if bot is running: `pm2 list` or `docker ps`
2. Check logs: `pm2 logs` or `docker logs`
3. Verify BOT_TOKEN is correct
4. Check database permissions

### Database Errors

1. Ensure `data.db` has write permissions
2. Check disk space
3. Verify database schema is up to date: `bun run drizzle`

### Memory Issues

- Monitor memory usage
- Consider increasing server resources
- Check for memory leaks in logs

## Updates and Maintenance

### Updating the Bot

```bash
git pull origin main
bun install
pm2 restart mrp-bot
```

### Database Migrations

```bash
bun run drizzle
pm2 restart mrp-bot
```

### Zero-Downtime Deployment

1. Use PM2 cluster mode or Docker with multiple instances
2. Implement graceful shutdown
3. Use load balancer for webhooks

## Production Checklist

- [ ] Environment variables configured
- [ ] Database initialized and backed up
- [ ] Logging configured and monitored
- [ ] Bot token secured
- [ ] Process manager configured (PM2/systemd)
- [ ] Auto-restart on failure enabled
- [ ] Backup strategy implemented
- [ ] Monitoring set up
- [ ] SSL certificate configured (if using webhooks)
- [ ] Error handling tested

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review documentation in `docs/`
3. Check GitHub issues
4. Contact maintainers






