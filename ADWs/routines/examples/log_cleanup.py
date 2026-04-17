#!/usr/bin/env python3
"""ADW: Log Cleanup — Delete old detail logs and compress JSONL. Type: systematic"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from runner import run_script, banner, summary

from pathlib import Path
from datetime import datetime, timedelta

LOGS_DIR = Path(__file__).resolve().parent.parent / "logs"
MAX_AGE_DAYS = 30


def cleanup_logs():
    """Remove detail logs older than 30 days and count what was cleaned."""
    detail_dir = LOGS_DIR / "detail"
    if not detail_dir.exists():
        return {"ok": True, "summary": "No detail/ dir found, nothing to clean"}

    cutoff = datetime.now() - timedelta(days=MAX_AGE_DAYS)
    deleted = 0
    freed_bytes = 0

    for f in detail_dir.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff.timestamp():
            freed_bytes += f.stat().st_size
            f.unlink()
            deleted += 1

    # Also clean old JSONL files
    for f in LOGS_DIR.glob("*.jsonl"):
        if f.is_file() and f.stat().st_mtime < cutoff.timestamp():
            freed_bytes += f.stat().st_size
            f.unlink()
            deleted += 1

    freed_mb = freed_bytes / (1024 * 1024)
    return {
        "ok": True,
        "summary": f"Deleted {deleted} files, freed {freed_mb:.1f}MB",
        "data": {"deleted": deleted, "freed_bytes": freed_bytes},
    }


def main():
    banner("Log Cleanup", f"Remove logs older than {MAX_AGE_DAYS}d | systematic")
    results = []
    results.append(run_script(cleanup_logs, log_name="log-cleanup", timeout=60))
    summary(results, "Log Cleanup")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
