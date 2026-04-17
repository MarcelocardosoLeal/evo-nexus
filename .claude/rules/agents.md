# Agents (16 core + custom)

Defined in `.claude/agents/`. Each agent has an isolated domain and can be invoked via command. Custom agents use `custom-` prefix (gitignored).

| Agent | Command | Domain |
|--------|---------|---------|
| **Clawdia** | `/clawdia` | Operational hub — calendar, emails, tasks, decisions |
| **Flux** | `/flux` | Finance — cash flow, metrics, Stripe, Omie |
| **Atlas** | `/atlas` | Projects — status, milestones, blockers, Linear, GitHub, Licensing |
| **Kai** | `/kai` | Personal — health, habits, routine (isolated domain) |
| **Pulse** | `/pulse` | Community — Discord, WhatsApp, sentiment, FAQ |
| **Sage** | `/sage` | Strategy — OKRs, roadmap, prioritization, scenarios |
| **Pixel** | `/pixel` | Social media — content, calendar, analysis, reports |
| **Nex** | `/nex` | Sales — pipeline, proposals, qualification |
| **Mentor** | `/mentor` | Courses — learning paths, modules, Evo Academy |
| **Oracle** | `/oracle` | Workspace knowledge — docs, how-to, configuration |
| **Mako** | `/mako` | Marketing — campaigns, content strategy, SEO, email, brand |
| **Aria** | `/aria` | HR / People — recruiting, onboarding, performance, compensation |
| **Zara** | `/zara` | Customer Success — triage, escalation, health scores, KB |
| **Lex** | `/lex` | Legal / Compliance — contracts, NDA, LGPD, risk assessment |
| **Nova** | `/nova` | Product — specs, roadmaps, metrics, research, prioritization |
| **Dex** | `/dex` | Data / BI — analysis, SQL, dashboards, visualizations |

## Custom Agents

Users can create custom agents with `custom-` prefix:
- Files: `.claude/agents/custom-{name}.md` + `.claude/commands/custom-{name}.md`
- Memory: `.claude/agent-memory/custom-{name}/`
- All gitignored (personal to workspace)
- Use the `create-agent` skill to create one

## How to Use

- Use the correct agent for each domain. Do not mix responsibilities.
- Each agent has a dedicated `agent-memory/` for persistence between sessions.
- Agents use `model: sonnet` and have defined personality and anti-patterns.
- To invoke, use the corresponding command (e.g., `/clawdia`, `/flux`).
