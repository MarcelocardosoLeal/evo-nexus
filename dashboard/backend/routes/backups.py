"""Backups endpoint — list, create, restore, download, delete workspace backups."""

import json
import os
import threading
from flask import Blueprint, jsonify, request, send_file, abort
from flask_login import current_user
from models import has_permission, audit
from routes._helpers import WORKSPACE

bp = Blueprint("backups", __name__)

BACKUPS_DIR = WORKSPACE / "backups"

# Track running backup jobs
_running_jobs = {}


def _require(resource: str, action: str):
    if not has_permission(current_user.role, resource, action):
        return jsonify({"error": "Forbidden"}), 403
    return None


@bp.route("/api/backups")
def list_backups():
    """List all local backup files with manifest info."""
    denied = _require("config", "view")
    if denied:
        return denied

    if not BACKUPS_DIR.exists():
        return jsonify({"backups": [], "total": 0})

    backups = []
    for z in sorted(BACKUPS_DIR.glob("openclaude-backup-*.zip"), reverse=True):
        info = {
            "filename": z.name,
            "size": z.stat().st_size,
            "modified": z.stat().st_mtime,
            "manifest": None,
        }
        # Try to read manifest from ZIP
        try:
            import zipfile
            with zipfile.ZipFile(z, "r") as zf:
                if "manifest.json" in zf.namelist():
                    info["manifest"] = json.loads(zf.read("manifest.json"))
        except Exception:
            pass
        backups.append(info)

    return jsonify({"backups": backups, "total": len(backups)})


@bp.route("/api/backups", methods=["POST"])
def create_backup():
    """Trigger a new backup. Runs in background thread."""
    denied = _require("config", "manage")
    if denied:
        return denied

    if _running_jobs.get("backup"):
        return jsonify({"error": "A backup is already running"}), 409

    target = request.get_json(silent=True) or {}
    s3_upload = target.get("target") == "s3"

    def _run():
        try:
            import sys
            sys.path.insert(0, str(WORKSPACE))
            import backup as backup_module
            backup_module.backup_local(s3_upload=s3_upload)
            _running_jobs["backup"] = {"status": "done"}
        except Exception as e:
            _running_jobs["backup"] = {"status": "error", "error": str(e)}

    _running_jobs["backup"] = {"status": "running"}
    t = threading.Thread(target=_run, daemon=True)
    t.start()

    audit(current_user, "create", "backups", f"Started backup (target={'s3' if s3_upload else 'local'})")
    return jsonify({"status": "started", "target": "s3" if s3_upload else "local"}), 202


@bp.route("/api/backups/status")
def backup_status():
    """Check status of running backup job."""
    denied = _require("config", "view")
    if denied:
        return denied
    job = _running_jobs.get("backup", {"status": "idle"})
    return jsonify(job)


@bp.route("/api/backups/<filename>/restore", methods=["POST"])
def restore_backup(filename):
    """Restore from a specific backup file."""
    denied = _require("config", "manage")
    if denied:
        return denied

    zip_path = BACKUPS_DIR / filename
    if not zip_path.exists() or not filename.endswith(".zip"):
        abort(404, description="Backup not found")

    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "merge")
    if mode not in ("merge", "replace"):
        return jsonify({"error": "Invalid mode. Use 'merge' or 'replace'"}), 400

    def _run():
        try:
            import sys
            sys.path.insert(0, str(WORKSPACE))
            import backup as backup_module
            backup_module.restore_local(zip_path, mode=mode)
            _running_jobs["restore"] = {"status": "done", "mode": mode}
        except Exception as e:
            _running_jobs["restore"] = {"status": "error", "error": str(e)}

    _running_jobs["restore"] = {"status": "running"}
    t = threading.Thread(target=_run, daemon=True)
    t.start()

    audit(current_user, "restore", "backups", f"Restoring {filename} (mode={mode})")
    return jsonify({"status": "started", "mode": mode}), 202


@bp.route("/api/backups/<filename>/download")
def download_backup(filename):
    """Download a backup ZIP file."""
    denied = _require("config", "view")
    if denied:
        return denied

    zip_path = BACKUPS_DIR / filename
    if not zip_path.exists() or not filename.endswith(".zip"):
        abort(404, description="Backup not found")

    return send_file(str(zip_path), as_attachment=True, download_name=filename)


@bp.route("/api/backups/<filename>", methods=["DELETE"])
def delete_backup(filename):
    """Delete a backup file."""
    denied = _require("config", "manage")
    if denied:
        return denied

    zip_path = BACKUPS_DIR / filename
    if not zip_path.exists() or not filename.endswith(".zip"):
        abort(404, description="Backup not found")

    zip_path.unlink()
    audit(current_user, "delete", "backups", f"Deleted backup {filename}")
    return jsonify({"status": "deleted"})


@bp.route("/api/backups/config")
def backup_config():
    """Return backup configuration (S3 status, etc)."""
    denied = _require("config", "view")
    if denied:
        return denied

    s3_configured = bool(os.environ.get("BACKUP_S3_BUCKET"))
    s3_bucket = os.environ.get("BACKUP_S3_BUCKET", "")

    try:
        import boto3
        boto3_available = True
    except ImportError:
        boto3_available = False

    return jsonify({
        "s3_configured": s3_configured,
        "s3_bucket": s3_bucket,
        "boto3_available": boto3_available,
        "backups_dir": str(BACKUPS_DIR.relative_to(WORKSPACE)),
    })
