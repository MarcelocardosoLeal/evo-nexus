# Fork Upgrade Guide: v0.24.x -> v0.29.0

This fork previously tracked a custom line based on `v0.24.x`.

The branch `feature/provider-routing-fallback-v029` is the new upgrade line and includes:

- upstream `v0.29.0`;
- the fork's Docker/runtime fixes needed for the local dashboard container;
- provider routing;
- automatic provider fallback;
- optional `ANTHROPIC_API_KEY` storage in the Anthropic provider card;
- documentation updates aligned with EvoNexus conventions.

## Why this ships as a PR instead of a direct push to `main`

The existing `fork/main` is not a fast-forward target:

- it still contains custom commits on top of the older `v0.24.x` line;
- the local workspace was upgraded to `v0.29.0`;
- the new provider-routing work was built on top of that upgraded base.

Updating `main` directly would make review, rollback, and blame harder.

Using a PR keeps the migration professional:

- clear review surface;
- explicit upgrade checkpoint;
- safer rollback path;
- auditable documentation of why the fork moved from `v0.24.x` to `v0.29.0`.

## Validation performed before opening the PR

- local repository updated to `v0.29.0`;
- provider routing and fallback implemented;
- dashboard rebuilt locally with Docker;
- container reached `healthy` state;
- `/api/version` returned `0.29.0`;
- Python syntax validation passed inside the container for the modified backend files;
- terminal-server JavaScript passed `node --check`.

## Recommended merge strategy

Use a normal GitHub PR merge from:

- `feature/provider-routing-fallback-v029`

into:

- `main`

After merge:

1. pull the updated `main` locally;
2. rebuild the dashboard container;
3. validate provider order / fallback settings in `System -> Providers`;
4. confirm the active workspace is on `v0.29.0`.

## Post-merge note

Because this fork now carries product-level behavior that diverges from upstream provider handling, future upstream pulls should review these files carefully:

- `dashboard/backend/routes/providers.py`
- `dashboard/terminal-server/src/claude-bridge.js`
- `ADWs/runner.py`
- `dashboard/frontend/src/pages/Providers.tsx`
- `config/providers.example.json`
