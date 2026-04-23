#!/usr/bin/env python3
"""
Core runner for ADWs — executes Claude Code CLI with agents, visual output, logs and Telegram notification.
"""

import subprocess
import os
import sys
import json
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.theme import Theme

theme = Theme({
    "info": "cyan",
    "success": "bold green",
    "warning": "yellow",
    "error": "bold red",
    "step": "bold blue",
    "dim": "dim white",
})

console = Console(theme=theme)

WORKSPACE = Path(__file__).parent.parent
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

def _timestamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _parse_usage(json_result: dict) -> dict:
    """Extract token and cost data from Claude CLI JSON result."""
    usage = json_result.get("usage", {})
    return {
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cache_creation_tokens": usage.get("cache_creation_input_tokens", 0),
        "cache_read_tokens": usage.get("cache_read_input_tokens", 0),
        "cost_usd": json_result.get("total_cost_usd", 0),
    }


def _save_metrics(log_name, duration, returncode, agent, stdout, usage=None):
    """Save accumulated metrics per routine in metrics.json."""
    metrics_file = LOGS_DIR / "metrics.json"
    try:
        metrics = json.loads(metrics_file.read_text()) if metrics_file.exists() else {}
    except (json.JSONDecodeError, OSError):
        metrics = {}

    key = log_name
    if key not in metrics:
        metrics[key] = {
            "runs": 0, "successes": 0, "failures": 0,
            "total_seconds": 0, "avg_seconds": 0,
            "last_run": None, "agent": agent or "none",
            "total_input_tokens": 0, "total_output_tokens": 0,
            "total_cache_creation_tokens": 0, "total_cache_read_tokens": 0,
            "total_cost_usd": 0, "avg_cost_usd": 0,
        }

    m = metrics[key]
    m["runs"] += 1
    m["total_seconds"] = round(m["total_seconds"] + duration, 1)
    m["avg_seconds"] = round(m["total_seconds"] / m["runs"], 1)
    m["last_run"] = datetime.now().isoformat()
    m["agent"] = agent or "none"

    if returncode == 0:
        m["successes"] += 1
    else:
        m["failures"] += 1

    m["success_rate"] = round((m["successes"] / m["runs"]) * 100, 1)

    if usage:
        m["total_input_tokens"] = m.get("total_input_tokens", 0) + usage["input_tokens"]
        m["total_output_tokens"] = m.get("total_output_tokens", 0) + usage["output_tokens"]
        m["total_cache_creation_tokens"] = m.get("total_cache_creation_tokens", 0) + usage["cache_creation_tokens"]
        m["total_cache_read_tokens"] = m.get("total_cache_read_tokens", 0) + usage["cache_read_tokens"]
        m["total_cost_usd"] = round(m.get("total_cost_usd", 0) + usage["cost_usd"], 5)
        m["avg_cost_usd"] = round(m["total_cost_usd"] / m["runs"], 5)
        m["last_input_tokens"] = usage["input_tokens"]
        m["last_output_tokens"] = usage["output_tokens"]
        m["last_cost_usd"] = round(usage["cost_usd"], 5)

    metrics_file.write_text(json.dumps(metrics, indent=2, ensure_ascii=False))


def _log_to_file(log_name, prompt, stdout, stderr, returncode, duration, usage=None):
    """Save structured log in JSONL + detailed file."""
    log_file = LOGS_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.jsonl"
    entry = {
        "timestamp": datetime.now().isoformat(),
        "run": log_name,
        "prompt": prompt[:500],
        "returncode": returncode,
        "duration_seconds": round(duration, 1),
        "stdout_lines": len(stdout.splitlines()),
        "stderr_lines": len(stderr.splitlines()),
    }
    if usage:
        entry["input_tokens"] = usage["input_tokens"]
        entry["output_tokens"] = usage["output_tokens"]
        entry["cost_usd"] = round(usage["cost_usd"], 5)
    with open(log_file, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    detail_dir = LOGS_DIR / "detail"
    detail_dir.mkdir(exist_ok=True)
    detail_file = detail_dir / f"{_timestamp()}-{log_name}.log"
    with open(detail_file, "w") as f:
        f.write(f"TIMESTAMP: {datetime.now().isoformat()}\n")
        f.write(f"DURATION: {duration:.1f}s\n")
        f.write(f"RETURNCODE: {returncode}\n")
        f.write(f"PROMPT:\n{prompt}\n\n")
        f.write(f"{'='*60}\nSTDOUT:\n{'='*60}\n{stdout}\n\n")
        if stderr:
            f.write(f"{'='*60}\nSTDERR:\n{'='*60}\n{stderr}\n")


_ALLOWED_CLI_COMMANDS = frozenset({"claude", "openclaude"})
_DEFAULT_PROVIDER_ORDER = ["anthropic", "codex_auth", "openrouter", "openai", "gemini", "bedrock", "vertex"]
_PROVIDER_ERROR_PATTERNS = [
    ("credit_exhausted", ["credit balance is too low", "insufficient credits", "quota exceeded"]),
    ("usage_window_exhausted", ["usage limit reached", "try again in", "5 hours", "hours remaining"]),
    ("rate_limited", ["rate limit", "too many requests", "429"]),
    ("auth_invalid", ["invalid api key", "authentication failed", "unauthorized", "forbidden"]),
    ("provider_unreachable", ["connection error", "network error", "temporarily unavailable", "timed out"]),
]


def _spawn_cli(cli_command: str, prompt: str, agent: str | None, provider_env: dict) -> subprocess.Popen:
    """Spawn a CLI process using only hardcoded command strings.

    Uses a dictionary lookup so that the subprocess argument is always
    a static string, satisfying semgrep/opengrep subprocess injection rules.
    """
    base_args = ["--print", "--dangerously-skip-permissions", "--output-format", "json"]
    if agent:
        base_args.extend(["--agent", agent])
    base_args.append(prompt)

    env = {**os.environ, **provider_env, "TERM": "dumb"}
    popen_kwargs = dict(
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(WORKSPACE),
        env=env,
    )

    # Hardcoded dispatch — each branch uses a literal string for the executable
    if cli_command == "openclaude":
        return subprocess.Popen(["openclaude"] + base_args, **popen_kwargs)  # noqa: S603
    else:
        return subprocess.Popen(["claude"] + base_args, **popen_kwargs)  # noqa: S603
_ALLOWED_ENV_VARS = frozenset({
    "ANTHROPIC_API_KEY",
    "CLAUDE_CODE_USE_OPENAI", "CLAUDE_CODE_USE_GEMINI", "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX", "OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL",
    # Codex OAuth support (OpenClaude 0.3+ auto-reads ~/.codex/auth.json)
    "CODEX_AUTH_JSON_PATH", "CODEX_API_KEY",
    "GEMINI_API_KEY", "GEMINI_MODEL", "AWS_REGION", "AWS_BEARER_TOKEN_BEDROCK",
    "ANTHROPIC_VERTEX_PROJECT_ID", "CLOUD_ML_REGION",
})


def _sanitize_provider_env_vars(env_vars: dict) -> dict:
    return {
        k: v for k, v in env_vars.items()
        if v and k in _ALLOWED_ENV_VARS
    }


def _read_provider_config() -> dict:
    config_path = WORKSPACE / "config" / "providers.json"
    if not config_path.is_file():
        return {
            "active_provider": "anthropic",
            "providers": {},
            "provider_order": [],
            "fallback_enabled": True,
            "auto_return_to_primary": True,
            "provider_runtime": {},
        }
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        providers = config.get("providers", {}) or {}
        order = []
        for provider_id in config.get("provider_order", []) or []:
            if provider_id in providers and provider_id not in order:
                order.append(provider_id)
        for provider_id in _DEFAULT_PROVIDER_ORDER:
            if provider_id in providers and provider_id not in order:
                order.append(provider_id)
        for provider_id in providers:
            if provider_id not in order:
                order.append(provider_id)
        return {
            "active_provider": config.get("active_provider", "anthropic"),
            "providers": providers,
            "provider_order": order,
            "fallback_enabled": bool(config.get("fallback_enabled", True)),
            "auto_return_to_primary": bool(config.get("auto_return_to_primary", True)),
            "provider_runtime": config.get("provider_runtime", {}) or {},
        }
    except (json.JSONDecodeError, OSError):
        return {
            "active_provider": "anthropic",
            "providers": {},
            "provider_order": [],
            "fallback_enabled": True,
            "auto_return_to_primary": True,
            "provider_runtime": {},
        }


def _write_provider_config(config: dict):
    config_path = WORKSPACE / "config" / "providers.json"
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _provider_runtime_blocked(runtime_state: dict | None) -> bool:
    if not runtime_state:
        return False
    if runtime_state.get("status") == "healthy":
        return False
    cooldown_until = runtime_state.get("cooldown_until")
    if cooldown_until is None:
        return runtime_state.get("status") == "blocked"
    try:
        return int(cooldown_until) > int(datetime.now().timestamp())
    except (TypeError, ValueError):
        return runtime_state.get("status") == "blocked"


def _classify_provider_failure(stdout: str, stderr: str) -> str | None:
    haystack = f"{stdout}\n{stderr}".lower()
    for reason, patterns in _PROVIDER_ERROR_PATTERNS:
        if any(pattern in haystack for pattern in patterns):
            return reason
    return None


def _mark_provider_runtime(provider_id: str, status: str, reason: str | None = None):
    config = _read_provider_config()
    runtime = config.setdefault("provider_runtime", {})
    if status == "healthy":
        runtime[provider_id] = {
            "status": "healthy",
            "reason": None,
            "cooldown_until": None,
            "last_failure_at": None,
        }
    else:
        cooldown_seconds = 6 * 3600 if reason in {"credit_exhausted", "usage_window_exhausted"} else 15 * 60
        runtime[provider_id] = {
            "status": "blocked",
            "reason": reason or "unknown",
            "cooldown_until": int(datetime.now().timestamp()) + cooldown_seconds,
            "last_failure_at": int(datetime.now().timestamp()),
        }
    _write_provider_config(config)


def _build_provider_candidates() -> list[tuple[str, str, dict]]:
    """Return ordered providers (id, cli, env) honoring active provider, order, and runtime state."""
    config = _read_provider_config()
    providers = config.get("providers", {})
    active = config.get("active_provider", "anthropic")
    order = config.get("provider_order", [])
    fallback_enabled = config.get("fallback_enabled", True)
    runtime = config.get("provider_runtime", {})

    chain = []
    if active in providers:
        chain.append(active)
    if fallback_enabled:
        for provider_id in order:
            if provider_id not in chain and provider_id in providers:
                chain.append(provider_id)

    candidates = []
    for provider_id in chain:
        provider = providers.get(provider_id, {})
        runtime_state = runtime.get(provider_id, {})
        if _provider_runtime_blocked(runtime_state):
            continue
        cli = provider.get("cli_command", "claude")
        if cli not in _ALLOWED_CLI_COMMANDS:
            cli = "claude"
        env_vars = _sanitize_provider_env_vars(provider.get("env_vars", {}))
        if not env_vars.get("OPENAI_MODEL"):
            if provider_id == "codex_auth":
                env_vars["OPENAI_MODEL"] = "codexplan"
            elif provider_id == "openai":
                env_vars["OPENAI_MODEL"] = "gpt-4.1"
        candidates.append((provider_id, cli, env_vars))

    if not candidates and not _provider_runtime_blocked(runtime.get(active, {})):
        candidates.append((active or "anthropic", "claude", {}))
    return candidates


def run_claude(prompt: str, log_name: str = "unnamed", timeout: int = 600, agent: str = None) -> dict:
    """
    Execute AI CLI (claude or openclaude) with streaming output.

    Uses the active provider from config/providers.json to determine
    which binary to run and which env vars to inject.

    Args:
        prompt: The prompt to execute
        log_name: Name for logs
        timeout: Timeout in seconds
        agent: Agent name (.claude/agents/*.md) — if None, runs without agent
    """
    if agent:
        agent_label = f"@{agent}"
    else:
        agent_label = ""
    console.print(f"  [step]▶[/step] {log_name} [dim]{agent_label}[/dim]", end="")

    start_time = datetime.now()
    candidates = _build_provider_candidates()
    attempted = []

    if not candidates:
        raise RuntimeError("No available AI providers are currently healthy. Review Providers in the dashboard and reset or reconfigure a blocked provider.")

    for index, (provider_id, cli_command, provider_env) in enumerate(candidates):
        attempted.append(provider_id)
        provider_label = f"[{provider_id}/{cli_command}]"
        if index == 0:
            console.print(f"\r  [step]▶[/step] {log_name} [dim]{agent_label} {provider_label}[/dim]", end="")
        else:
            console.print(f"\n  [warning]↺[/warning] {log_name} [dim]fallback -> {provider_label}[/dim]")

        try:
            process = _spawn_cli(cli_command, prompt, agent, provider_env)

            stdout_lines = []

            for line in process.stdout:
                stdout_lines.append(line)

            process.wait(timeout=timeout)

            stderr = process.stderr.read() if process.stderr else ""
            stdout = "".join(stdout_lines)
            duration = (datetime.now() - start_time).total_seconds()

            # Parse JSON output to extract result and usage
            usage = None
            result_text = stdout
            try:
                json_result = json.loads(stdout)
                usage = _parse_usage(json_result)
                result_text = json_result.get("result", stdout)
            except (json.JSONDecodeError, TypeError):
                pass

            full_prompt = f"[agent:{agent}] {prompt}" if agent else prompt
            _log_to_file(log_name, full_prompt, result_text, stderr, process.returncode, duration, usage)

            if process.returncode == 0:
                _mark_provider_runtime(provider_id, "healthy")
                _save_metrics(log_name, duration, process.returncode, agent, result_text, usage)
                cost_str = ""
                if usage:
                    tokens_total = usage["input_tokens"] + usage["output_tokens"]
                    cost_str = f" | {tokens_total:,}tok | ${usage['cost_usd']:.2f}"
                console.print(f"\r  [success]✓[/success] {log_name} [dim]({duration:.0f}s{cost_str} | {provider_id})[/dim]")
                return {
                    "success": True,
                    "stdout": result_text,
                    "stderr": stderr,
                    "returncode": process.returncode,
                    "duration": duration,
                    "usage": usage,
                    "provider_id": provider_id,
                    "attempted_providers": attempted,
                }

            failure_reason = _classify_provider_failure(result_text, stderr)
            if failure_reason and index < len(candidates) - 1:
                _mark_provider_runtime(provider_id, "blocked", failure_reason)
                console.print(f"\n    [warning]Provider {provider_id} blocked ({failure_reason}); trying next fallback[/warning]")
                continue

            _save_metrics(log_name, duration, process.returncode, agent, result_text, usage)
            console.print(f"\r  [error]✗[/error] {log_name} [dim](exit {process.returncode}, {duration:.0f}s | {provider_id})[/dim]")
            if stderr:
                for err_line in stderr.strip().splitlines()[:3]:
                    console.print(f"    [error]{err_line}[/error]")
            return {
                "success": False,
                "stdout": result_text,
                "stderr": stderr,
                "returncode": process.returncode,
                "duration": duration,
                "usage": usage,
                "provider_id": provider_id,
                "attempted_providers": attempted,
            }

        except subprocess.TimeoutExpired:
            process.kill()
            duration = (datetime.now() - start_time).total_seconds()
            console.print(f"\r  [error]✗[/error] {log_name} [warning](timeout {timeout}s | {provider_id})[/warning]")
            _log_to_file(log_name, prompt, "", f"Timeout after {timeout}s", -1, duration)
            return {"success": False, "stdout": "", "stderr": f"Timeout after {timeout}s", "returncode": -1, "duration": duration, "provider_id": provider_id, "attempted_providers": attempted}

        except KeyboardInterrupt:
            process.kill()
            duration = (datetime.now() - start_time).total_seconds()
            console.print(f"\n  [warning]⚠ Cancelled by user[/warning]")
            _log_to_file(log_name, prompt, "", "Cancelled by user", -2, duration)
            raise

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            console.print(f"\r  [error]✗[/error] {log_name} [error]({e})[/error]")
            _log_to_file(log_name, prompt, "", str(e), -3, duration)
            return {"success": False, "stdout": "", "stderr": str(e), "returncode": -3, "duration": duration, "provider_id": provider_id, "attempted_providers": attempted}

    duration = (datetime.now() - start_time).total_seconds()
    return {"success": False, "stdout": "", "stderr": "No provider candidates available", "returncode": -4, "duration": duration, "attempted_providers": attempted}


def run_skill(
    skill_name: str,
    args: str = "",
    log_name: str = None,
    timeout: int = 600,
    agent: str = None,
    notify_telegram: bool | str = False,
) -> dict:
    """Execute a skill via CLI, optionally with an agent.

    Args:
        notify_telegram: Controls post-skill Telegram notification.
            False (default) — no notification (skill must NOT call reply() either).
            True            — appends notification instruction; reads chat_id from
                              TELEGRAM_CHAT_ID env var.
            "<chat_id>"     — same as True but overrides the chat_id.
    """
    prompt = f"Execute the skill /{skill_name} {args}".strip()
    if notify_telegram:
        chat_id = (
            notify_telegram
            if isinstance(notify_telegram, str)
            else os.environ.get("TELEGRAM_CHAT_ID", "")
        )
        if chat_id:
            prompt += (
                f"\n\nAo concluir TODOS os passos acima, envie UMA única mensagem Telegram via:"
                f'\nreply(chat_id="{chat_id}", text="...")'
                f"\nFormato: emoji + nome da rotina + principais resultados em 2-3 linhas."
                f"\nCRÍTICO: chame reply() EXATAMENTE UMA VEZ, somente aqui no final."
                f" Não envie mensagens intermediárias nem de progresso."
            )
    return run_claude(prompt, log_name or skill_name, timeout, agent=agent)


def run_script(func, log_name: str = "unnamed", timeout: int = 120) -> dict:
    """
    Execute a pure Python function (no Claude CLI, no AI, no tokens).
    Same logging/metrics as run_claude but with cost=0.

    Args:
        func: Callable that returns {"ok": bool, "summary": str, "data": ...}
        log_name: Name for logs
        timeout: Timeout in seconds
    """
    console.print(f"  [step]▶[/step] {log_name} [dim]systematic[/dim]", end="")
    start_time = datetime.now()

    try:
        import signal

        def _timeout_handler(signum, frame):
            raise TimeoutError(f"Timeout after {timeout}s")

        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(timeout)

        try:
            result = func()
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)

        duration = (datetime.now() - start_time).total_seconds()
        ok = result.get("ok", True) if isinstance(result, dict) else bool(result)
        summary_text = result.get("summary", str(result)) if isinstance(result, dict) else str(result)
        returncode = 0 if ok else 1

        _log_to_file(log_name, f"[systematic] {log_name}", summary_text, "", returncode, duration)
        _save_metrics(log_name, duration, returncode, "system", summary_text)

        if ok:
            console.print(f"\r  [success]✓[/success] {log_name} [dim]({duration:.1f}s | {summary_text})[/dim]")
        else:
            console.print(f"\r  [error]✗[/error] {log_name} [dim]({duration:.1f}s | {summary_text})[/dim]")

        return {
            "success": ok,
            "stdout": summary_text,
            "stderr": "",
            "returncode": returncode,
            "duration": duration,
            "usage": None,
        }

    except TimeoutError:
        duration = (datetime.now() - start_time).total_seconds()
        console.print(f"\r  [error]✗[/error] {log_name} [warning](timeout {timeout}s)[/warning]")
        _log_to_file(log_name, f"[systematic] {log_name}", "", f"Timeout after {timeout}s", -1, duration)
        return {"success": False, "stdout": "", "stderr": f"Timeout after {timeout}s", "returncode": -1, "duration": duration}

    except KeyboardInterrupt:
        duration = (datetime.now() - start_time).total_seconds()
        console.print(f"\n  [warning]⚠ Cancelled by user[/warning]")
        raise

    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        console.print(f"\r  [error]✗[/error] {log_name} [error]({e})[/error]")
        _log_to_file(log_name, f"[systematic] {log_name}", "", str(e), -3, duration)
        _save_metrics(log_name, duration, -3, "system", str(e))
        return {"success": False, "stdout": "", "stderr": str(e), "returncode": -3, "duration": duration}


def banner(title: str, subtitle: str = "", color: str = "cyan"):
    content = f"[bold white]{title}[/bold white]"
    if subtitle:
        content += f"\n[dim]{subtitle}[/dim]"
    console.print(Panel(content, border_style=color, padding=(0, 2)))


def summary(results: list, title: str = "Completed"):
    """Show final summary in terminal."""
    total_duration = sum(r.get("duration", 0) for r in results)
    success = sum(1 for r in results if r.get("success"))
    failed = len(results) - success

    total_cost = sum(r.get("usage", {}).get("cost_usd", 0) for r in results if r.get("usage"))
    total_tokens = sum(
        (r.get("usage", {}).get("input_tokens", 0) + r.get("usage", {}).get("output_tokens", 0))
        for r in results if r.get("usage")
    )

    status = "[success]✅ All OK[/success]" if failed == 0 else f"[warning]⚠ {failed} failure(s)[/warning]"
    cost_line = f" | {total_tokens:,} tokens | ${total_cost:.2f}" if total_tokens > 0 else ""
    console.print(Panel(
        f"{status}\n[dim]Steps: {success}/{len(results)} | Tempo: {total_duration:.0f}s{cost_line}[/dim]",
        title=f"[bold]{title}[/bold]",
        border_style="green" if failed == 0 else "yellow",
        padding=(0, 2)
    ))


def send_telegram(text: str, chat_id: str = None) -> bool:
    """Send a Telegram message via bot API (no MCP dependency).

    Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment.
    Returns True if sent successfully, False otherwise.
    """
    import urllib.request
    import urllib.parse

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    cid = chat_id or os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not cid:
        console.print("  [warning]⚠ Telegram not configured (missing BOT_TOKEN or CHAT_ID)[/warning]")
        return False

    try:
        payload = urllib.parse.urlencode({"chat_id": cid, "text": text, "parse_mode": "HTML"}).encode()
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        req = urllib.request.Request(url, data=payload, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            ok = resp.status == 200
        if ok:
            console.print("  [success]✓[/success] Telegram enviado")
        else:
            console.print(f"  [warning]⚠ Telegram status {resp.status}[/warning]")
        return ok
    except Exception as e:
        console.print(f"  [warning]⚠ Telegram error: {e}[/warning]")
        return False
