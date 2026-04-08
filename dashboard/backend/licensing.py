"""OpenClaude Licensing — silent registration, heartbeat, and telemetry."""

import hashlib
import socket
import uuid
import time
import threading
import logging
import requests
from datetime import datetime, timezone

logger = logging.getLogger("licensing")

LICENSING_SERVER = "https://licensing.evolutionfoundation.com.br"
PRODUCT = "open-claude"
VERSION = "0.1.0"
HEARTBEAT_INTERVAL = 1800  # 30 minutes


# ── Instance ID ──────────────────────────────

def generate_instance_id() -> str:
    """Generate unique ID based on hardware (hostname + MAC)."""
    hostname = socket.gethostname()
    mac = uuid.getnode()
    raw = f"{hostname}-{mac}-{PRODUCT}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ── RuntimeConfig persistence ────────────────

def get_runtime_config(key: str) -> str | None:
    """Read a runtime config value from DB."""
    from models import db, RuntimeConfig
    try:
        row = RuntimeConfig.query.filter_by(key=key).first()
        return row.value if row else None
    except Exception:
        return None


def set_runtime_config(key: str, value: str):
    """Write a runtime config value to DB."""
    from models import db, RuntimeConfig
    try:
        row = RuntimeConfig.query.filter_by(key=key).first()
        if row:
            row.value = value
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = RuntimeConfig(key=key, value=value)
            db.session.add(row)
        db.session.commit()
    except Exception as e:
        logger.warning(f"Failed to save runtime config {key}: {e}")


# ── Licensing Client ─────────────────────────

class LicensingClient:
    def __init__(self, instance_id: str, api_key: str | None = None):
        self.instance_id = instance_id
        self.api_key = api_key
        self.session = requests.Session()
        self.session.timeout = 10
        self.session.headers["Content-Type"] = "application/json"
        self.session.headers["User-Agent"] = f"OpenClaude/{VERSION}"

    def register(self, data: dict) -> dict:
        """Silent registration during setup. Returns {api_key, tier, customer_id}."""
        payload = {
            "instance_id": self.instance_id,
            "version": VERSION,
            "product": PRODUCT,
            "owner_name": data.get("owner_name", ""),
            "company_name": data.get("company_name", ""),
            "email": data.get("email", ""),
            "timezone": data.get("timezone", ""),
            "language": data.get("language", ""),
            "agents": data.get("agents", []),
            "integrations": data.get("integrations", []),
            "geo": data.get("geo", {}),
        }
        try:
            resp = self.session.post(f"{LICENSING_SERVER}/api/register", json=payload)
            if resp.ok:
                result = resp.json()
                self.api_key = result.get("api_key")
                return result
            logger.warning(f"Licensing register failed: {resp.status_code}")
        except Exception as e:
            logger.warning(f"Licensing register error (server may be offline): {e}")
        return {}

    def heartbeat(self, stats: dict) -> dict:
        """Periodic heartbeat with telemetry."""
        payload = {
            "instance_id": self.instance_id,
            "api_key": self.api_key,
            "version": VERSION,
            "product": PRODUCT,
            "uptime_seconds": stats.get("uptime", 0),
            "active_agents": stats.get("agents", 0),
            "active_routines": stats.get("routines", 0),
            "user_count": stats.get("users", 0),
        }
        try:
            resp = self.session.post(f"{LICENSING_SERVER}/api/heartbeat", json=payload)
            if resp.ok:
                return resp.json()
        except Exception:
            pass  # Silent failure — don't break the app
        return {}

    def deactivate(self):
        """Called on shutdown."""
        try:
            self.session.post(
                f"{LICENSING_SERVER}/api/deactivate",
                json={"instance_id": self.instance_id, "api_key": self.api_key},
                timeout=5,
            )
        except Exception:
            pass  # Best effort


# ── Registration (called from setup) ─────────

def register_instance(setup_data: dict, email: str | None = None):
    """Register this instance with the licensing server. Called once during setup."""
    instance_id = generate_instance_id()
    client = LicensingClient(instance_id)

    reg_data = {
        "owner_name": setup_data.get("owner_name", ""),
        "company_name": setup_data.get("company_name", ""),
        "email": email or "",
        "timezone": setup_data.get("timezone", ""),
        "language": setup_data.get("language", ""),
        "agents": setup_data.get("agents", []),
        "integrations": setup_data.get("integrations", []),
        "geo": setup_data.get("geo", {}),
    }

    result = client.register(reg_data)

    # Persist to DB
    set_runtime_config("instance_id", instance_id)
    set_runtime_config("version", VERSION)
    set_runtime_config("activated_at", datetime.now(timezone.utc).isoformat())

    if result.get("api_key"):
        set_runtime_config("api_key", result["api_key"])
    if result.get("tier"):
        set_runtime_config("tier", result["tier"])
    if result.get("customer_id"):
        set_runtime_config("customer_id", str(result["customer_id"]))

    # Even if server is offline, we save instance_id so heartbeat can retry later
    set_runtime_config("tier", result.get("tier", "free"))

    return instance_id


# ── Heartbeat thread ─────────────────────────

_heartbeat_thread = None
_start_time = time.time()


def start_heartbeat(app):
    """Start background heartbeat thread. Call after app is initialized."""
    global _heartbeat_thread

    def _run():
        while True:
            time.sleep(HEARTBEAT_INTERVAL)
            try:
                with app.app_context():
                    instance_id = get_runtime_config("instance_id")
                    api_key = get_runtime_config("api_key")
                    if not instance_id:
                        continue

                    from models import User
                    client = LicensingClient(instance_id, api_key)
                    stats = {
                        "uptime": int(time.time() - _start_time),
                        "agents": 9,
                        "routines": 27,
                        "users": User.query.count(),
                    }
                    result = client.heartbeat(stats)

                    # If revoked, update local state (but don't block)
                    if result.get("status") == "revoked":
                        set_runtime_config("tier", "revoked")
            except Exception as e:
                logger.debug(f"Heartbeat error: {e}")

    _heartbeat_thread = threading.Thread(target=_run, daemon=True, name="licensing-heartbeat")
    _heartbeat_thread.start()


# ── Shutdown hook ────────────────────────────

def on_shutdown(app):
    """Deactivate instance on server shutdown."""
    try:
        with app.app_context():
            instance_id = get_runtime_config("instance_id")
            api_key = get_runtime_config("api_key")
            if instance_id:
                client = LicensingClient(instance_id, api_key)
                client.deactivate()
    except Exception:
        pass


# ── Auto-register for existing installs ───────

def auto_register_if_needed():
    """If there are users but no instance_id, register retroactively.
    This handles installs that existed before licensing was added."""
    try:
        instance_id = get_runtime_config("instance_id")
        if instance_id:
            return  # Already registered

        from models import User
        if User.query.count() == 0:
            return  # No setup done yet, will register during setup

        # Existing install — register now
        instance_id = generate_instance_id()
        client = LicensingClient(instance_id)

        # Get basic info from first admin user
        admin = User.query.filter_by(role="admin").first()
        reg_data = {
            "owner_name": admin.display_name if admin else "",
            "email": admin.email if admin else "",
            "company_name": "",
            "timezone": "",
            "language": "",
            "agents": [],
            "integrations": [],
            "geo": {},
        }

        result = client.register(reg_data)

        # Persist
        set_runtime_config("instance_id", instance_id)
        set_runtime_config("version", VERSION)
        set_runtime_config("activated_at", datetime.now(timezone.utc).isoformat())
        set_runtime_config("tier", result.get("tier", "free"))

        if result.get("api_key"):
            set_runtime_config("api_key", result["api_key"])
        if result.get("customer_id"):
            set_runtime_config("customer_id", str(result["customer_id"]))

        logger.info(f"Auto-registered existing install: {instance_id[:8]}...")
    except Exception as e:
        logger.debug(f"Auto-register skipped: {e}")


# ── License status ───────────────────────────

def get_license_status() -> dict:
    """Get current license status for the admin dashboard."""
    instance_id = get_runtime_config("instance_id")
    tier = get_runtime_config("tier")
    activated_at = get_runtime_config("activated_at")

    return {
        "active": instance_id is not None,
        "instance_id": instance_id,
        "tier": tier or "free",
        "version": VERSION,
        "activated_at": activated_at,
        "product": PRODUCT,
    }
