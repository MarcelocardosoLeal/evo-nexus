---
name: pulse-faq-sync
description: "Sync and update the community FAQ from Discord conversations, WhatsApp groups, and GitHub issues. Identifies recurring questions, adds new entries, and keeps the FAQ as a living knowledge base. Use when user says 'update faq', 'sync faq', 'community faq', 'frequently asked questions', or when running community routines that detect unanswered/recurring questions."
---

# FAQ Sync — Living Knowledge Base

Routine that keeps the community FAQ always updated, fed by questions from Discord, WhatsApp, and GitHub issues.

**Always respond in English.**

## Main file

```
workspace/community/[C] FAQ.md
```

This is the single source of truth file. All agents and support bots should consult this file.

## FAQ Structure

The file follows this format:

```markdown
# FAQ — Community

> Automatically updated. Last sync: {YYYY-MM-DD HH:MM}
> Sources: Discord (#help, #feedback) + GitHub Issues
> Total: {N} questions

---

## Installation & Setup
<!-- tag: installation, setup, docker, deploy -->

### How to install the main API via Docker?
**Answer:** [clear and direct answer]
**Source:** Discord #help (recurring) | [Official doc link if available]
**Added:** YYYY-MM-DD

### How to configure SSL/HTTPS?
**Answer:** [...]
**Source:** GitHub YOUR_ORG/main-api#123
**Added:** YYYY-MM-DD

---

## Configuration
<!-- tag: config, env, variables, webhook -->

### How to configure webhooks?
...

---

## Integrations
<!-- tag: whatsapp, telegram, typebot, n8n, chatwoot -->

...

## Evo CRM
<!-- tag: crm, agents, pipeline, leads -->

...

## Evo Go
<!-- tag: evogo, go, manager -->

...

## Billing & Licenses
<!-- tag: license, plan, price, payment -->

...

## Common Errors
<!-- tag: error, bug, 503, 401, timeout -->

...
```

## Workflow

### Step 1 — Read current FAQ

Read `workspace/community/[C] FAQ.md`. If it does not exist, create it with the base structure.

Count how many entries exist and which categories.

### Step 2 — Collect new questions

**From Discord (last 24h):**
Use `/discord-get-messages` on channels:
- `🆘・help` (ID do canal de help)
- `🆘・feedback`
- `💬・chat-pt`

Identify messages that are **questions** (end in ?, ask for help, report errors).

**From GitHub (last 24h):**
```bash
# Issues abertas recentemente nos 5 repos
gh issue list --repo YOUR_ORG/main-api --state open --json title,body,labels,createdAt --limit 10
gh issue list --repo YOUR_ORG/crm-product --state open --json title,body,labels,createdAt --limit 10
gh issue list --repo YOUR_ORG/go-service --state open --json title,body,labels,createdAt --limit 10
gh issue list --repo YOUR_ORG/crm-community --state open --json title,body,labels,createdAt --limit 10
gh issue list --repo YOUR_ORG/methodology --state open --json title,body,labels,createdAt --limit 5
```

Filter issues that are questions or recurring bugs.

**From WhatsApp (last 24h):**
Use `/int-whatsapp` to fetch messages from groups:

```bash
python3 {project-root}/.claude/skills/int-whatsapp/scripts/whatsapp_client.py messages_24h
```

Filter messages that are questions (end in ?, ask for help, report errors, ask for configuration guidance). Mark source as "WhatsApp {group name}".

**From Linear — "Evolution Suporte" Project:**
Use Linear MCP to fetch recently resolved issues from the paid support project:
```
list_issues(project="Evolution Suporte", state="Done", updatedAt="-P1D")
```

Resolved issues from paid support are a gold mine for the FAQ — these are real client problems with validated solutions. For each resolved issue:
- Extract the reported problem as a question
- Extract the resolution as an answer
- Mark source as "Linear — Paid Support"
- Prioritize inclusion in FAQ (paying clients = high relevance)

### Step 3 — Analyze and classify

For each question found:

1. **Already in the FAQ?** → If yes, check if the answer needs updating
2. **Is it recurring?** → If it appeared 2+ times (Discord or GitHub), add with priority
3. **Has an answer?** → If someone answered on Discord/GitHub, use as a base
4. **Which category?** → Classify in the correct FAQ category

### Step 4 — Update FAQ

For each new question to be added:
- Formulate a clear question in PT-BR
- Write an objective and actionable answer
- Include source (Discord/GitHub + link if possible)
- Include date
- Add to the correct category

For existing questions:
- Update the answer if there is new information
- Mark as "updated" with new date

### Step 5 — Update header

Update the FAQ header with:
- Date/time of last sync
- Total questions
- Existing categories

### Step 6 — Report

Present a short summary:

```
## FAQ Sync — {date}

Questions in FAQ: {total}
New added: {N}
Updated: {N}
Sources: Discord ({N} questions) + GitHub ({N} issues)

New:
- {question 1} → {category}
- {question 2} → {category}
```

## Rules

- **Quality > quantity** — only add questions that are truly recurring or useful
- **Actionable answers** — do not copy generic text, write answers that solve the problem
- **PT-BR** — all questions and answers in Portuguese
- **Do not duplicate** — always check if it already exists before adding
- **Source required** — every entry must have its origin
- **Do not fabricate answers** — if there is no clear answer, mark as "pending documentation"
- **Tags in comments** — keep HTML comment tags for easy searching
- **Keep organized** — categories in logical order (installation -> config -> integrations -> product -> billing -> errors)


### Notify via Telegram

Upon completion, send a short summary via Telegram to the user:
- Use the Telegram MCP: `reply(chat_id="YOUR_CHAT_ID", text="...")`
- Format: emoji + routine name + main result (1-3 lines)
- If the routine had no updates, send anyway with "no updates"
