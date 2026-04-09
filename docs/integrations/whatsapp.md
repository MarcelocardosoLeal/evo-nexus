# WhatsApp Integration

WhatsApp group messages are accessed via the Evolution Foundation API. The @pulse agent uses this data alongside Discord for community analysis and sentiment tracking.

## Setup

### 1. Get Your API Key

Contact the Evolution Foundation team or configure your own Evolution API instance to get access to the WhatsApp messages API.

### 2. Configure .env

The WhatsApp integration uses the Evolution API credentials:

```env
EVOLUTION_API_URL=https://your-instance.com
EVOLUTION_API_KEY=your_api_key_here
```

### 3. Test the Connection

```bash
make community
```

This runs the community pulse, which reads WhatsApp and Discord messages from the last 24 hours.

## Available Commands

The `int-whatsapp` skill queries group messages via a Python client:

| Command | What it does |
|---|---|
| `messages_24h` | All messages from the last 24 hours |
| `messages_24h --group GROUP_ID` | Messages from a specific group |
| `messages_7d` | Messages from the last 7 days |
| `messages_30d` | Messages from the last 30 days |
| `messages --start DATE --end DATE` | Custom date range with filtering |
| `groups` | List active groups (with message counts) |
| `stats` | Statistics: messages by day, group, type, and top participants |

## Message Types

| Type | Description |
|---|---|
| `conversation` | Text message |
| `imageMessage` | Image |
| `videoMessage` | Video |
| `audioMessage` | Audio |
| `documentMessage` | Document/file |
| `stickerMessage` | Sticker |
| `reactionMessage` | Reaction |

## Skills That Use WhatsApp

| Skill | What it does |
|---|---|
| `int-whatsapp` | Direct WhatsApp API queries -- messages, groups, stats |
| `pulse-daily` | Daily community pulse (Discord + WhatsApp) |
| `pulse-weekly` | Weekly community analysis |
| `pulse-monthly` | Monthly community report |

## Automated Routines

| Routine | Schedule | Make command |
|---|---|---|
| Community Pulse | 20:00 BRT daily | `make community` |
| Community Weekly | Monday 09:30 BRT | `make community-week` |
| Community Monthly | 1st of month | `make community-month` |
