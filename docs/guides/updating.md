# Updating EvoNexus

## Check your current version

Your version is shown in the sidebar footer of the dashboard. You can also check it via API:

```bash
curl http://localhost:8080/api/version
```

Or directly from `pyproject.toml` at the workspace root:

```bash
grep '^version' pyproject.toml
```

## Update via Git (recommended)

```bash
cd /path/to/your/workspace
git pull origin main
```

Then rebuild the frontend and restart the backend:

```bash
cd dashboard/frontend
npm install
npm run build

# Restart the backend (or the full stack)
cd ../backend
# If running directly:
kill $(lsof -ti :8080) 2>/dev/null
python app.py &
```

## Update via Docker

If you're running EvoNexus with Docker Compose:

```bash
cd /path/to/your/workspace
git pull origin main
docker compose build
docker compose up -d
```

To rebuild without cache (useful if dependencies changed):

```bash
docker compose build --no-cache
docker compose up -d
```

## Custom routines and skills are safe

Your custom routines (`ADWs/scripts/`), skills (`.claude/skills/`), and workspace configuration files are **gitignored** and will not be overwritten by `git pull`. The same applies to:

- `.env` files
- `dashboard/data/` (database, secrets)
- `config/workspace.yaml`
- `memory/` directory contents
- Session logs in `01 Daily Logs/`

If you've modified a tracked file, `git pull` may show a merge conflict. In that case, stash your changes first:

```bash
git stash
git pull origin main
git stash pop
```

## Checking for updates programmatically

The dashboard checks for updates automatically (cached for 1 hour). You can also call:

```bash
curl http://localhost:8080/api/version/check
```

Returns:

```json
{
  "current": "0.3.2",
  "latest": "0.4.0",
  "update_available": true,
  "release_url": "https://github.com/EvolutionAPI/evo-nexus/releases/tag/v0.4.0",
  "release_notes": "..."
}
```

## Changelog

See all releases and changelogs on GitHub:
https://github.com/EvolutionAPI/evo-nexus/releases
