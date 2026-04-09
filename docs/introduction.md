# What is OpenClaude

> **Note:** OpenClaude is an independent, **unofficial open-source project**. It is **not affiliated with, endorsed by, or sponsored by Anthropic**. "Claude" and "Claude Code" are trademarks of Anthropic, PBC. This project integrates with Claude Code as a third-party tool and requires users to provide their own installation and credentials.

## The Problem

Running a business means juggling dozens of tools, dashboards, and communication channels every day. Email, calendar, project management, financial tracking, community moderation, social media — each one demands attention, and none of them talk to each other.

Most "AI assistants" are chatbots. You ask a question, you get an answer, and then you're back to manually copying data between tools. That doesn't scale.

## What OpenClaude Is

OpenClaude is a multi-agent workspace compatible with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other LLM tooling. It turns a single Claude Code installation into a team of specialized agents that handle real operational work — not just answer questions.

Each agent owns a domain (finance, projects, community, social media, strategy, sales, courses, personal wellness) and has the skills, memory, and integrations needed to operate independently. A scheduler runs routines on a daily, weekly, and monthly cadence, producing real outputs: HTML reports, triaged inboxes, synced meeting notes, financial snapshots, community health checks.

**This is not a chatbot.** It's an operating layer for your business.

## Who It's For

- **Solo founders** who need to run operations without hiring an ops team
- **CEOs of small companies** managing multiple products and communities
- **Small teams** that want automated reporting and coordination
- **Developers** who already use Claude Code and want to extend it

## How It's Different

| Chatbot | OpenClaude |
|---------|------------|
| You ask, it answers | Agents run routines on schedule |
| Forgets between sessions | Persistent memory across sessions |
| One conversation thread | 9 agents with isolated domains |
| No integrations | 18+ integrations (Google, GitHub, Stripe, Discord, etc.) |
| Text output | HTML reports, dashboards, structured data |
| Manual every time | Automated daily/weekly/monthly workflows |

## Key Concepts

### Agents

Nine specialized agents, each with a system prompt, slash command, persistent memory, and domain-specific skills:

| Agent | Domain | Command |
|-------|--------|---------|
| Clawdia | Operations — agenda, emails, tasks, decisions | `/clawdia` |
| Flux | Finance — Stripe, ERP, cash flow, reports | `/flux` |
| Atlas | Projects — Linear, GitHub, sprints | `/atlas` |
| Pulse | Community — Discord, WhatsApp, sentiment | `/pulse` |
| Pixel | Social media — content, calendar, analytics | `/pixel` |
| Sage | Strategy — OKRs, roadmap, prioritization | `/sage` |
| Nex | Sales — pipeline, proposals, qualification | `/nex` |
| Mentor | Courses — learning paths, modules | `/mentor` |
| Kai | Personal — health, habits, routine | `/kai` |

### Skills

~80 reusable capabilities organized by prefix (`fin-`, `social-`, `int-`, `prod-`, etc.). Skills are markdown files that teach agents how to perform specific tasks — no plugins, no code.

### Routines

Automated workflows (ADWs) that run on schedule via a Python scheduler. Morning briefings, email triage, financial snapshots, community monitoring, end-of-day consolidation. Each routine logs execution metrics (tokens, cost, duration) in JSONL format.

### Dashboard

A web UI (React + Flask) for managing everything: view reports, start/stop services, browse agents and skills, manage users and roles, and interact with Claude Code through an embedded terminal.

![Web Dashboard](imgs/doc-overview.png)

### Knowledge Base

Optional semantic search powered by [MemPalace](https://github.com/milla-jovovich/mempalace). Index your project code, documentation, and knowledge for natural-language search — everything runs locally with ChromaDB. Enable it with one click in the Dashboard.

### Memory

Two-tier persistence. `CLAUDE.md` holds working memory (who you are, active projects, key people). The `memory/` directory stores deeper context (people profiles, glossary, project history). Both survive across sessions.

## Open Source

OpenClaude is MIT-licensed, built by [Evolution Foundation](https://evolutionfoundation.com.br). The source is at [github.com/EvolutionAPI/open-claude](https://github.com/EvolutionAPI/open-claude). This is an unofficial community project — not affiliated with or endorsed by Anthropic.

It's designed to be forked and adapted. Add your own agents, skills, routines, and integrations. The architecture is markdown-first — no complex plugin systems, just files that Claude Code reads.
