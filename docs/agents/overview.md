# Agents Overview

Agents are the core of EvoNexus. Each agent is a specialized AI persona with its own domain, system prompt, skills, and persistent memory.

## What Is an Agent?

An agent is a markdown file in `.claude/agents/` that contains:

- **Frontmatter** with metadata (name, description, model, color, memory scope)
- **System prompt** that defines the agent's identity, responsibilities, tone, and behavior

When invoked, Claude Code loads the agent's system prompt and operates within that persona for the duration of the task.

## How to Invoke an Agent

### Slash commands

Each agent has a corresponding command in `.claude/commands/`:

```
/clawdia    — Ops hub: agenda, emails, tasks, decisions
/flux       — Finance: Stripe, ERP, cash flow, reports
/atlas      — Projects: Linear, GitHub, sprints, milestones
/pulse      — Community: Discord, WhatsApp, sentiment, FAQ
/pixel      — Social media: content, calendar, analytics
/sage       — Strategy: OKRs, roadmap, competitive analysis
/nex        — Sales: pipeline, proposals, qualification
/mentor     — Courses: learning paths, modules
/kai        — Personal: health, habits, routine
/oracle     — Workspace knowledge: docs, how-to, configuration
/mako       — Marketing: campaigns, SEO, email, brand
/aria       — HR / People: recruiting, onboarding, performance
/zara       — Customer Success: triage, escalation, KB
/lex        — Legal / Compliance: contracts, NDA, LGPD
/nova       — Product: specs, roadmaps, metrics, research
/dex        — Data / BI: analysis, SQL, dashboards
```

Usage in Claude Code:

```
/clawdia check my emails
/flux what is the company's financial status?
/pulse how is the community doing?
```

### Auto-routing

You do not need to pick the right agent manually. Just describe what you need and Claude routes to the correct agent based on the `description` field in each agent's frontmatter.

Examples:

| You say | Agent activated |
|---------|----------------|
| "good morning" | Clawdia |
| "monthly closing" | Flux |
| "check github PRs" | Atlas |
| "community sentiment" | Pulse |
| "write a LinkedIn post" | Pixel |
| "should we prioritize X or Y?" | Sage |
| "prepare a proposal for client Z" | Nex |
| "create a course module" | Mentor |
| "how is my health progress?" | Kai |

The routing logic uses example interactions in each agent's `description` field to match user intent.

## Agent Memory

Every agent has persistent, file-based memory at:

```
.claude/agent-memory/<agent-name>/
```

Memory is organized by type:

| Type | Purpose |
|------|---------|
| `user` | Who the user is, their role, preferences |
| `feedback` | Corrections and confirmed approaches |
| `project` | Ongoing work, deadlines, decisions |
| `reference` | Pointers to external systems |

Each memory file uses frontmatter (`name`, `description`, `type`) and a `MEMORY.md` index file tracks all entries. Agents read memory at the start of each session and update it as they learn.

## Custom Agents

You can create your own agents with the `custom-` prefix. Custom agents are gitignored (personal to your workspace) and appear in the dashboard with a gray "custom" badge.

To create a custom agent, use the `create-agent` skill or see [Creating Agents](creating-agents.md).

```
.claude/agents/custom-devops.md      # Agent prompt
.claude/commands/custom-devops.md    # Slash command
.claude/agent-memory/custom-devops/  # Persistent memory
```

## All 16 Core Agents

| Agent | Command | Domain | Color |
|-------|---------|--------|-------|
| [**Clawdia**](clawdia.md) | `/clawdia` | Ops: agenda, emails, tasks, meetings, decisions | cyan |
| [**Flux**](flux.md) | `/flux` | Finance: Stripe, Omie, cash flow, monthly close | orange |
| [**Atlas**](atlas.md) | `/atlas` | Projects: Linear, GitHub, sprints, licensing | green |
| [**Pulse**](pulse.md) | `/pulse` | Community: Discord, WhatsApp, sentiment, FAQ | blue |
| [**Pixel**](pixel.md) | `/pixel` | Social: content, calendar, cross-platform analytics | yellow |
| [**Sage**](sage.md) | `/sage` | Strategy: OKRs, roadmap, competitive analysis | orange |
| [**Nex**](nex.md) | `/nex` | Sales: pipeline, proposals, qualification | red |
| [**Mentor**](mentor.md) | `/mentor` | Courses: learning paths, modules, academy | purple |
| [**Kai**](kai.md) | `/kai` | Personal: health, habits, routine (isolated) | blue |
| [**Oracle**](oracle.md) | `/oracle` | Workspace knowledge: docs, how-to, configuration | amber |
| [**Mako**](mako.md) | `/mako` | Marketing: campaigns, SEO, email sequences, brand | orange |
| [**Aria**](aria.md) | `/aria` | HR / People: recruiting, onboarding, performance | pink |
| [**Zara**](zara.md) | `/zara` | Customer Success: triage, escalation, health scores | cyan |
| [**Lex**](lex.md) | `/lex` | Legal / Compliance: contracts, NDA, LGPD, risk | purple |
| [**Nova**](nova.md) | `/nova` | Product: specs, roadmaps, metrics, research | blue |
| [**Dex**](dex.md) | `/dex` | Data / BI: analysis, SQL, dashboards, visualizations | yellow |

### Agent Roles in Detail

**Clawdia** is the default agent and operational hub. Morning briefings, email triage, task management, meeting summaries, and end-of-day consolidation all run through Clawdia.

**Flux** acts as a virtual CFO. It queries Stripe for MRR/churn and Omie for payables/receivables, generates financial reports, and manages the monthly close process.

**Atlas** tracks development work across Linear and GitHub. Sprint status, PR reviews, issue tracking, and open source licensing telemetry are its domain.

**Pulse** monitors community health across Discord and WhatsApp. It generates daily/weekly/monthly pulse reports, tracks sentiment, identifies recurring questions, and maintains the FAQ.

**Pixel** manages social media across YouTube, Instagram, and LinkedIn. Content creation, calendar planning, cross-platform analytics, and engagement tracking.

**Sage** handles high-level strategy. OKR reviews, competitive analysis, strategy digests, and decision frameworks.

**Nex** manages the sales pipeline. Lead qualification, proposals, and commercial workflows.

**Mentor** handles the course platform (Evo Academy). Learning paths, module creation, and educational content.

**Kai** is the personal assistant with an isolated domain. Health tracking, habits, personal appointments, and routines. It does not handle professional matters.

**Oracle** is the workspace knowledge agent. It answers questions about how EvoNexus works — agents, skills, routines, integrations, dashboard, configuration, and architecture — by reading the actual documentation before responding. No RAG or vector DB needed.

**Mako** handles marketing. Campaign planning, content creation, brand reviews, SEO audits, email sequences, and performance reports.

**Aria** manages HR and People Operations. Recruiting pipeline, performance reviews, onboarding checklists, compensation analysis, and org planning.

**Zara** handles customer success. Ticket triage, escalation packaging, customer research, draft responses, and knowledge base articles.

**Lex** manages legal and compliance. Contract review, NDA triage, LGPD compliance checks, risk assessment, and legal briefs.

**Nova** handles product management. Feature specs/PRDs, metrics reviews, roadmap updates, product brainstorming, and stakeholder updates.

**Dex** is the data and BI agent. Data analysis, SQL queries, interactive dashboards, statistical analysis, and data validation.

## Preloaded Skills

Each agent has a `skills` field in its frontmatter that pre-loads domain-specific skills into the agent's context at startup. This means the agent doesn't need to discover or load skills during execution — they're immediately available.

```yaml
---
name: "flux-finance"
skills:
  - fin-daily-pulse
  - fin-weekly-report
  - int-stripe
  - int-omie
---
```

## Agent Teams (Experimental)

For consolidation tasks that span multiple domains (strategy digest, dashboard, weekly review), Agent Teams can run domain-specific agents in parallel. Each teammate collects data from their domain simultaneously, then the lead agent synthesizes results.

Agent Teams are opt-in and cost ~3-5x more tokens. Run manually:

```bash
make team-strategy    # @sage leads, @atlas + @flux + @pulse + @pixel as teammates
make team-dashboard   # @clawdia leads, @atlas + @flux + @pulse + @dex as teammates
make team-weekly      # @clawdia leads, @atlas + @flux + @pulse as teammates
```

See [Routines Overview](../routines/overview.md) for details on Agent Teams.
