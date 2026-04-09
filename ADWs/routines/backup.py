#!/usr/bin/env python3
"""ADW: Daily Backup — Export workspace gitignored data to local ZIP (+ S3 if configured)"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from runner import run_script, banner, summary

# Import backup logic from root backup.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import backup as backup_module


def _do_backup():
    """Run backup and return structured result for runner."""
    files = backup_module.collect_files()
    if not files:
        return {"ok": True, "summary": "No files to backup"}

    # Check if S3 is configured
    s3_bucket = os.environ.get("BACKUP_S3_BUCKET")
    s3_upload = bool(s3_bucket)

    zip_path = backup_module.backup_local(s3_upload=s3_upload)
    zip_size = zip_path.stat().st_size
    size_str = backup_module._format_size(zip_size)
    target = f"local + s3://{s3_bucket}" if s3_upload else "local"
    return {"ok": True, "summary": f"{len(files)} files → {zip_path.name} ({size_str}) [{target}]"}


def main():
    banner("💾 Daily Backup", "Workspace data export | systematic")
    results = []
    results.append(run_script(_do_backup, log_name="backup", timeout=300))
    summary(results, "Daily Backup")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠ Cancelado.")
