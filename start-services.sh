#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"
cd /home/evonexus/evo-nexus

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Kill existing services (including scheduler)
pkill -f 'terminal-server/bin/server.js' 2>/dev/null
pkill -f 'python.*app.py' 2>/dev/null
pkill -f 'python.*scheduler.py' 2>/dev/null
sleep 1

# Start terminal-server (must run FROM the project root for agent discovery)
nohup node dashboard/terminal-server/bin/server.js > /home/evonexus/evo-nexus/logs/terminal-server.log 2>&1 &

# Start scheduler
nohup /home/evonexus/evo-nexus/.venv/bin/python scheduler.py > /home/evonexus/evo-nexus/logs/scheduler.log 2>&1 &

# Start Flask dashboard
cd dashboard/backend
nohup /home/evonexus/evo-nexus/.venv/bin/python app.py > /home/evonexus/evo-nexus/logs/dashboard.log 2>&1 &
