"""Workspace file browser — browse and view files in workspace/."""

import os
from flask import Blueprint, jsonify, request, Response, abort
from routes._helpers import WORKSPACE, safe_read

bp = Blueprint("reports", __name__)

VIEWABLE_EXTENSIONS = {".html", ".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".log"}
ICON_MAP = {
    ".html": "file-code",
    ".md": "file-text",
    ".txt": "file-text",
    ".json": "file-json",
    ".csv": "table",
    ".yaml": "file-cog",
    ".yml": "file-cog",
    ".log": "scroll-text",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".pdf": "file",
}


@bp.route("/api/workspace/tree")
def workspace_tree():
    """Return directory tree for a given path inside workspace/."""
    rel_path = request.args.get("path", "")
    target = (WORKSPACE / "workspace" / rel_path).resolve()

    # Security: ensure we stay inside workspace/
    try:
        target.relative_to((WORKSPACE / "workspace").resolve())
    except ValueError:
        abort(403, description="Access denied")

    if not target.is_dir():
        abort(404, description="Directory not found")

    items = []
    for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
        if entry.name.startswith("."):
            continue

        rel = str(entry.relative_to((WORKSPACE / "workspace").resolve()))
        item = {
            "name": entry.name,
            "path": rel,
            "is_dir": entry.is_dir(),
        }

        if entry.is_dir():
            # Count children
            try:
                children = [c for c in entry.iterdir() if not c.name.startswith(".")]
                item["children_count"] = len(children)
            except PermissionError:
                item["children_count"] = 0
        else:
            item["size"] = entry.stat().st_size
            item["modified"] = entry.stat().st_mtime
            item["extension"] = entry.suffix.lower()
            item["icon"] = ICON_MAP.get(entry.suffix.lower(), "file")
            item["viewable"] = entry.suffix.lower() in VIEWABLE_EXTENSIONS

        items.append(item)

    # Build breadcrumb parts
    breadcrumbs = [{"name": "workspace", "path": ""}]
    if rel_path:
        parts = rel_path.split("/")
        for i, part in enumerate(parts):
            breadcrumbs.append({
                "name": part,
                "path": "/".join(parts[:i + 1]),
            })

    return jsonify({"items": items, "breadcrumbs": breadcrumbs, "current_path": rel_path})


# Keep old API for backwards compatibility (Overview page uses it)
@bp.route("/api/reports")
def list_reports():
    """Legacy: flat list of HTML/MD reports."""
    import re
    reports = []
    workspace_dir = WORKSPACE / "workspace"
    if not workspace_dir.is_dir():
        return jsonify(reports)

    for f in workspace_dir.rglob("*"):
        if not f.is_file() or f.suffix.lower() not in (".html", ".md") or f.name.startswith("."):
            continue
        rel = str(f.relative_to(WORKSPACE))
        name = f.stem
        m = re.search(r"(\d{4}-\d{2}-\d{2})", name)
        date = m.group(1) if m else None
        reports.append({"path": rel, "name": name, "date": date, "extension": f.suffix, "modified": f.stat().st_mtime})

    reports.sort(key=lambda x: x.get("modified", 0), reverse=True)
    return jsonify(reports[:20])  # Only latest 20 for overview


@bp.route("/api/reports/<path:filepath>")
def get_report(filepath):
    """View a file's content."""
    full = WORKSPACE / filepath
    if not full.is_file():
        abort(404, description="File not found")
    try:
        full.resolve().relative_to(WORKSPACE.resolve())
    except ValueError:
        abort(403, description="Access denied")

    content = safe_read(full)
    if content is None:
        abort(500, description="Could not read file")

    mime_map = {".html": "text/html", ".md": "text/markdown", ".json": "application/json",
                ".csv": "text/csv", ".yaml": "text/yaml", ".yml": "text/yaml",
                ".txt": "text/plain", ".log": "text/plain"}
    mime = mime_map.get(full.suffix.lower(), "text/plain")
    return Response(content, mimetype=mime)
