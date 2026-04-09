# Licensing Integration

The Evolution Licensing API provides telemetry and growth metrics for the open source ecosystem. The @atlas agent uses it to track active instances, geographic distribution, version adoption, and commercial alerts.

## Setup

### 1. Get Your Admin Token

Contact the Evolution team to obtain a Licensing API admin token.

### 2. Configure .env

```env
LICENSING_ADMIN_TOKEN=your_token_here
```

### 3. Test the Connection

```bash
make licensing
```

This runs the daily licensing report, querying 24-hour telemetry data.

## Available Commands

The `int-licensing` skill queries the Licensing API via a Python client:

| Command | What it does |
|---|---|
| `keys [--status --tier]` | List license keys with optional filters |
| `instances [--status --tier --geo --heartbeat]` | List active instances |
| `instance_detail ID` | Detailed info for a specific instance |
| `telemetry --period 24h/7d/30d` | Telemetry summary for a period |
| `activation_log [--api_key KEY]` | Activation history |
| `alerts [--resolved false]` | Commercial alerts (expiring, overuse) |
| `customers [--search --country --tier]` | Customer list with filters |
| `customer_detail ID` | Detailed customer info |
| `products` | List available products |

## Key Metrics

| Metric | What it measures |
|---|---|
| Active instances | Total adoption (heartbeat coverage) |
| Heartbeat 24h | Instances actually running right now |
| Geographic distribution | Where users are located |
| Version distribution | Adoption of new releases |
| Messages sent | Real usage volume |
| Feature usage | Which features matter most |
| Daily message trend | Growth curve over time |
| Commercial alerts | License issues requiring attention |

## Skills That Use Licensing

| Skill | What it does |
|---|---|
| `int-licensing` | Direct Licensing API queries |
| `prod-licensing-daily` | Daily open source growth report (HTML) |
| `prod-licensing-weekly` | Weekly growth report with trend analysis |
| `prod-licensing-monthly` | Monthly comprehensive growth report |

## Automated Routines

| Routine | Schedule | Make command |
|---|---|---|
| Licensing Daily | 18:30 BRT daily | `make licensing` |
| Licensing Weekly | Friday 07:45 BRT | `make licensing-weekly` |
| Licensing Monthly | 1st of month | `make licensing-month` |
