# ============================================================
# ADW Rotinas — Makefile
# ============================================================
# Usage: make <routine>
# Logs: ADWs/logs/
# ============================================================

PYTHON := uv run python
ADW_DIR := ADWs/rotinas

# Load .env if it exists
ifneq (,$(wildcard .env))
include .env
export
endif

# --- Daily routines ---

morning:            ## ☀️  Morning briefing — agenda, emails, tasks (@clawdia)
	$(PYTHON) $(ADW_DIR)/good_morning.py

sync:               ## 🎙️  Sync Fathom meetings → Todoist (@clawdia)
	$(PYTHON) $(ADW_DIR)/sync_meetings.py

triage:             ## 📧 Email triage (@clawdia)
	$(PYTHON) $(ADW_DIR)/email_triage.py

review:             ## 📋 Organize tasks in Todoist (@clawdia)
	$(PYTHON) $(ADW_DIR)/review_todoist.py

memory:             ## 🧠 Consolidate memory (@clawdia)
	$(PYTHON) $(ADW_DIR)/memory_sync.py

eod:                ## 🌙 End of day consolidation — memory, logs, learnings (@clawdia)
	$(PYTHON) $(ADW_DIR)/end_of_day.py

dashboard:          ## 📊 Consolidated dashboard — 360 business view (@clawdia)
	$(PYTHON) $(ADW_DIR)/dashboard.py

fin-pulse:          ## 💰 Financial Pulse — daily financial snapshot (@flux)
	$(PYTHON) $(ADW_DIR)/financial_pulse.py

youtube:            ## 📺 YouTube Report — channel analytics (@pixel)
	$(PYTHON) $(ADW_DIR)/youtube_report.py

instagram:          ## 📸 Instagram Report — profile analytics (@pixel)
	$(PYTHON) $(ADW_DIR)/instagram_report.py

linkedin:           ## 💼 LinkedIn Report — profile analytics (@pixel)
	$(PYTHON) $(ADW_DIR)/linkedin_report.py

social:             ## 📊 Social Analytics — consolidated cross-platform report (@pixel)
	$(PYTHON) $(ADW_DIR)/social_analytics.py

licensing:          ## 📊 Licensing Daily — daily open source growth (@atlas)
	$(PYTHON) $(ADW_DIR)/licensing_daily.py

# --- Weekly financial routines ---

fin-weekly:         ## 📊 Financial Weekly — weekly financial report (@flux)
	$(PYTHON) $(ADW_DIR)/financial_weekly.py

licensing-weekly:   ## 📊 Licensing Weekly — weekly open source growth (@atlas)
	$(PYTHON) $(ADW_DIR)/licensing_weekly.py

# --- Monthly routines ---

fin-close:          ## 📋 Monthly Close — monthly close kickoff (@flux)
	$(PYTHON) $(ADW_DIR)/monthly_close.py

community-month:    ## 📊 Community Monthly — monthly community report (@pulse)
	$(PYTHON) $(ADW_DIR)/community_monthly.py

licensing-month:    ## 📊 Licensing Monthly — monthly open source growth (@atlas)
	$(PYTHON) $(ADW_DIR)/licensing_monthly.py

# --- Weekly routines ---

weekly:             ## 📊 Full weekly review (@clawdia)
	$(PYTHON) $(ADW_DIR)/weekly_review.py

health:             ## 🏥 Weekly health check-in (@kai)
	$(PYTHON) $(ADW_DIR)/health_checkin.py

trends:             ## 📈 Weekly trend analysis — community, GitHub, financial (@clawdia)
	$(PYTHON) $(ADW_DIR)/trends.py

linear:             ## 🗂️  Linear review — issues in review, blockers, stale (@atlas)
	$(PYTHON) $(ADW_DIR)/linear_review.py

community:          ## 📣 Daily Discord community pulse (@pulse)
	$(PYTHON) $(ADW_DIR)/community_daily.py

community-week:     ## 📊 Weekly Discord community report (@pulse)
	$(PYTHON) $(ADW_DIR)/community_weekly.py

strategy:           ## 🎯 Weekly Strategy Digest — consolidated business view (@sage)
	$(PYTHON) $(ADW_DIR)/strategy_digest.py

github:             ## 🐙 GitHub repos review — PRs, issues, stars (@atlas)
	$(PYTHON) $(ADW_DIR)/github_review.py

faq:                ## FAQ Sync — update community FAQ (Discord + GitHub) (@pulse)
	$(PYTHON) $(ADW_DIR)/faq_sync.py

# --- Combos ---

daily: sync review  ## Combo: sync meetings + review todoist

# --- Servers ---

scheduler:          ## ⏰ Start routine scheduler (runs in background)
	$(PYTHON) scheduler.py

dashboard-app:      ## 🖥️  Start Dashboard App (React + Flask, localhost:8080) — includes Social Auth
	cd dashboard/frontend && npm run build && cd ../backend && $(PYTHON) app.py

telegram:           ## 📨 Start Telegram bot in background (screen)
	@if screen -list | grep -q '\.telegram'; then \
		echo "⚠ Telegram bot is already running. Use 'make telegram-stop' first or 'make telegram-attach' to connect."; \
	else \
		screen -dmS telegram claude --channels plugin:telegram@claude-plugins-official --dangerously-skip-permissions; \
		echo "✅ Telegram bot running in background (screen: telegram)"; \
		echo "📺 Ver: screen -r telegram"; \
		echo "🛑 Parar: make telegram-stop"; \
	fi

telegram-stop:      ## 🛑 Stop the Telegram bot
	@screen -S telegram -X quit 2>/dev/null && echo "✅ Telegram bot stopped" || echo "⚠ Was not running"

telegram-attach:    ## 📺 Connect to Telegram terminal (Ctrl+A D to detach)
	@screen -r telegram

# --- Utilities ---

logs:               ## 📝 Show latest logs (JSONL)
	@tail -20 ADWs/logs/$$(ls -t ADWs/logs/*.jsonl 2>/dev/null | head -1) 2>/dev/null || echo "No logs yet."

logs-detail:        ## 📝 List detailed logs
	@ls -lt ADWs/logs/detail/ 2>/dev/null | head -11 || echo "No logs yet."

logs-tail:          ## 📝 Show latest full log
	@cat ADWs/logs/detail/$$(ls -t ADWs/logs/detail/ 2>/dev/null | head -1) 2>/dev/null || echo "No logs yet."

metrics:            ## 📈 Show accumulated metrics per routine (tokens + cost)
	@python3 -c "\
	import json; d=json.load(open('ADWs/logs/metrics.json'));\
	total_runs=0; total_cost=0; total_tok=0;\
	[(\
	  print(f'  {k:22s} runs:{v[\"runs\"]:3d}  ok:{v[\"success_rate\"]:5.1f}%  avg:{v[\"avg_seconds\"]:5.0f}s  cost:\$${v.get(\"total_cost_usd\",0):7.2f}  avg:\$${v.get(\"avg_cost_usd\",0):.2f}  tok:{v.get(\"total_input_tokens\",0)+v.get(\"total_output_tokens\",0):>9,}  last:{v[\"last_run\"][:16]}'),\
	  total_runs:=total_runs+v['runs'],\
	  total_cost:=total_cost+v.get('total_cost_usd',0),\
	  total_tok:=total_tok+v.get('total_input_tokens',0)+v.get('total_output_tokens',0)\
	) for k,v in sorted(d.items())];\
	print(f'\n  {\"TOTAL\":22s} runs:{total_runs:3d}  {\" \":18s}  cost:\$${total_cost:7.2f}  {\" \":10s}  tok:{total_tok:>9,}')\
	" 2>/dev/null || echo "No metrics yet."

clean-logs:         ## 🗑️  Remove logs older than 30 days
	@find ADWs/logs/ -name "*.log" -mtime +30 -delete 2>/dev/null; find ADWs/logs/ -name "*.jsonl" -mtime +30 -delete 2>/dev/null; echo "Old logs removed."

# --- Docker (VPS) ---

docker-up:          ## 🐳 Start scheduler + telegram in Docker
	docker compose up -d scheduler telegram

docker-down:        ## 🐳 Stop all containers
	docker compose down

docker-logs:        ## 🐳 Container logs
	docker compose logs -f --tail=50

docker-run:         ## 🐳 Run routine manually (ex: make docker-run ADW=good_morning.py)
	docker compose run --rm runner ADWs/rotinas/$(ADW)

docker-build:       ## 🐳 Build the image
	docker compose build

help:               ## 📖 Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' Makefile | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: morning sync triage review memory eod dashboard youtube instagram linkedin social fin-pulse licensing weekly health trends linear community community-week community-month github faq strategy fin-weekly licensing-weekly fin-close licensing-month daily scheduler social-auth telegram telegram-stop telegram-attach logs logs-detail logs-tail metrics clean-logs docker-up docker-down docker-logs docker-run docker-build help
.DEFAULT_GOAL := help
