---
name: pulse-daily
description: "Daily community pulse report — reads Discord AND WhatsApp messages from the last 24h, analyzes activity, sentiment, support questions, and top topics. Generates an HTML report using the Evolution brand. Use when user says 'community pulse', 'daily community report', or any reference to daily community health check."
---

# Daily Community Pulse

Daily routine that reads Discord and WhatsApp messages from the last 24h and generates an HTML community health report.

**Always respond in English.**

## Workflow

### Step 1 — Collect Discord data

Use the `/discord-get-messages` skill to fetch messages from the last 24h in the main channels:

Channels to monitor (Guild ID: `YOUR_GUILD_ID`):
- `💬・chat-pt` — chat principal PT
- `💬・chat-en` — chat principal EN
- `💬・chat-es` — chat principal ES
- `🆘・help` — suporte
- `🆘・feedback` — feedback
- `💡・suggestions` — suggestions
- `💎・showcase` — showcase
- `📢・news` — news

For each channel, fetch the last 100 messages and filter those from the last 24h.

### Step 1b — Collect WhatsApp data

Use the `/int-whatsapp` skill to fetch messages from the last 24h:

```bash
python3 {project-root}/.claude/skills/int-whatsapp/scripts/whatsapp_client.py messages_24h
```

And also the statistics:
```bash
python3 {project-root}/.claude/skills/int-whatsapp/scripts/whatsapp_client.py stats --start $(date -u -v-1d '+%Y-%m-%d') --end $(date -u '+%Y-%m-%d')
```

Extract: total messages, active groups, unique participants, discussed topics, support questions.

### Step 2 — Analyze

From the collected messages, calculate:

1. **Activity**: total messages (Discord + WhatsApp separate), unique active members, most active channel/group
2. **New members**: check `🆕・new-members` for entries today
3. **Support**: unanswered questions in `🆘・help` (Discord) + questions in WhatsApp groups, time without response
4. **Sentiment**: analyze the overall tone (positive/neutral/negative) based on content from both platforms
5. **Top topics**: group by theme the most frequent discussions from Discord + WhatsApp (maximum 6)
6. **WhatsApp**: active groups, total messages, unique participants, topics — separate section in the report
7. **Overall health**: Normal (>80% positive, <3 open questions), Attention (mixed sentiment or 3-5 open questions), Critical (negative sentiment or >5 unanswered questions)

### Step 3 — Generate HTML report

Read the template at `.claude/templates/html/custom/community-daily-pulse.html`.

Replace the placeholders `{{...}}` with the actual collected data.

Evolution logo available at: `workspace/projects/Evolution Foundation/Logos finais/Favicon logo/SVG/Favicon Color 500.svg`

Save the filled HTML to:
```
workspace/community/reports/daily/[C] YYYY-MM-DD-community-pulse.html
```

Create directory if it does not exist.

### Step 4 — Terminal summary

Present a short summary in the terminal:

```
## Daily Pulse — {date}

Health: {Normal/Attention/Critical}
Messages: {N} | Active: {N} | New: {N}
Support: {N} unanswered
Sentiment: {emoji} {label}
Top: {topic 1}, {topic 2}, {topic 3}

Report saved to workspace/community/reports/daily/
```

## Rules

- **Do not reply to messages on Discord** — only read and analyze
- **Sentiment based on real content** — do not guess, analyze the messages
- **Unanswered questions = priority** — always highlight
- **Compare with average** — if previous reports exist in the directory, compare metrics
- **Empty channels = OK** — if a channel had no activity, do not report as a problem


### Notify via Telegram

Upon completion, send a short summary via Telegram to the user:
- Use the Telegram MCP: `reply(chat_id="YOUR_CHAT_ID", text="...")`
- Format: emoji + routine name + main result (1-3 lines)
- If the routine had no updates, send anyway with "no updates"
