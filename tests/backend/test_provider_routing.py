"""Tests for provider routing fallback and Anthropic config semantics."""

import json
import sys
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "dashboard" / "backend"
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def temp_provider_config(tmp_path):
    """Create an isolated providers.json and point runner/routes at it."""
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "providers.json"

    import ADWs.runner as runner
    import routes.providers as providers_route

    runner.WORKSPACE = tmp_path
    providers_route.PROVIDERS_CONFIG = config_path

    return config_path


def _write_provider_config(config_path: Path, payload: dict):
    config_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def test_build_provider_candidates_skips_blocked_primary_and_uses_fallback(temp_provider_config):
    import ADWs.runner as runner

    _write_provider_config(temp_provider_config, {
        "active_provider": "anthropic",
        "provider_order": ["anthropic", "openai"],
        "fallback_enabled": True,
        "provider_runtime": {
            "anthropic": {
                "status": "blocked",
                "reason": "credit_exhausted",
                "cooldown_until": 4102444800,
                "last_failure_at": 1700000000,
            }
        },
        "providers": {
            "anthropic": {
                "cli_command": "claude",
                "env_vars": {
                    "ANTHROPIC_API_KEY": "sk-ant"
                },
            },
            "openai": {
                "cli_command": "openclaude",
                "env_vars": {
                    "CLAUDE_CODE_USE_OPENAI": "1",
                    "OPENAI_API_KEY": "sk-openai",
                },
            },
        },
    })

    candidates = runner._build_provider_candidates()

    assert [provider_id for provider_id, _, _ in candidates] == ["openai"]
    assert candidates[0][1] == "openclaude"


def test_build_provider_candidates_filters_env_vars_to_allowlist(temp_provider_config):
    import ADWs.runner as runner

    _write_provider_config(temp_provider_config, {
        "active_provider": "openai",
        "provider_order": ["openai"],
        "fallback_enabled": False,
        "provider_runtime": {},
        "providers": {
            "openai": {
                "cli_command": "openclaude",
                "env_vars": {
                    "CLAUDE_CODE_USE_OPENAI": "1",
                    "OPENAI_API_KEY": "sk-openai",
                    "OPENAI_MODEL": "gpt-4.1",
                    "UNSAFE_VAR": "should-not-pass",
                },
            },
        },
    })

    candidates = runner._build_provider_candidates()

    assert len(candidates) == 1
    _, _, env_vars = candidates[0]
    assert env_vars["OPENAI_API_KEY"] == "sk-openai"
    assert env_vars["OPENAI_MODEL"] == "gpt-4.1"
    assert "UNSAFE_VAR" not in env_vars


def test_build_provider_candidates_returns_empty_when_all_providers_blocked(temp_provider_config):
    import ADWs.runner as runner

    _write_provider_config(temp_provider_config, {
        "active_provider": "anthropic",
        "provider_order": ["anthropic", "openai"],
        "fallback_enabled": True,
        "provider_runtime": {
            "anthropic": {
                "status": "blocked",
                "reason": "credit_exhausted",
                "cooldown_until": 4102444800,
                "last_failure_at": 1700000000,
            },
            "openai": {
                "status": "blocked",
                "reason": "rate_limited",
                "cooldown_until": 4102444800,
                "last_failure_at": 1700000000,
            },
        },
        "providers": {
            "anthropic": {"cli_command": "claude", "env_vars": {}},
            "openai": {"cli_command": "openclaude", "env_vars": {"CLAUDE_CODE_USE_OPENAI": "1"}},
        },
    })

    assert runner._build_provider_candidates() == []


def test_build_provider_candidates_skips_coming_soon_providers(temp_provider_config):
    import ADWs.runner as runner

    _write_provider_config(temp_provider_config, {
        "active_provider": "anthropic",
        "provider_order": ["anthropic", "gemini", "openai"],
        "fallback_enabled": True,
        "provider_runtime": {
            "anthropic": {
                "status": "blocked",
                "reason": "credit_exhausted",
                "cooldown_until": 4102444800,
                "last_failure_at": 1700000000,
            }
        },
        "providers": {
            "anthropic": {"cli_command": "claude", "env_vars": {}},
            "gemini": {
                "cli_command": "openclaude",
                "coming_soon": True,
                "env_vars": {
                    "CLAUDE_CODE_USE_GEMINI": "1",
                    "GEMINI_API_KEY": "future-key",
                },
            },
            "openai": {
                "cli_command": "openclaude",
                "env_vars": {
                    "CLAUDE_CODE_USE_OPENAI": "1",
                    "OPENAI_API_KEY": "sk-openai",
                },
            },
        },
    })

    candidates = runner._build_provider_candidates()

    assert [provider_id for provider_id, _, _ in candidates] == ["openai"]


def test_run_claude_raises_clear_error_when_no_provider_is_healthy(monkeypatch):
    import ADWs.runner as runner

    monkeypatch.setattr(runner, "_build_provider_candidates", lambda: [])

    with pytest.raises(RuntimeError, match="No available AI providers are currently healthy"):
        runner.run_claude("hello", log_name="provider-health-check")


def test_provider_has_config_allows_native_anthropic_without_api_key():
    import routes.providers as providers_route

    assert providers_route._provider_has_config("anthropic", {
        "ANTHROPIC_API_KEY": "",
    }) is True


def test_provider_has_config_still_requires_non_optional_openai_key():
    import routes.providers as providers_route

    assert providers_route._provider_has_config("openai", {
        "CLAUDE_CODE_USE_OPENAI": "1",
        "OPENAI_API_KEY": "",
    }) is False
