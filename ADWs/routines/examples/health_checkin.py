#!/usr/bin/env python3
"""ADW: Health Check-in — Weekly health check-in via Kai"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from runner import run_claude, banner, summary

PROMPT = """Run the weekly health check-in:

1. Read the most recent data in 'workspace/personal/' (last check-in, progress, baseline)
2. Ask about:
   - Current weight (if a scale is nearby)
   - How nutrition has been this week
   - Exercise frequency (how many days trained)
   - Hydration (estimated liters/day)
   - Sleep quality (1-10)
   - General energy/mood level (1-10)
   - Medication (if applicable this week)
3. Compare with the last check-in and identify trends
4. Generate a short report with traffic light (green/yellow/red) for each item
5. Save the check-in as HTML: read the template '.claude/templates/html/custom/health-checkin.html', fill all {{PLACEHOLDER}} with collected data, and save the complete HTML to 'workspace/personal/health-checkins/reports/[C] YYYY-MM-DD-health.html'. Create the directory if it doesn't exist.
6. Also save the markdown version to 'workspace/personal/health-checkins/reports/YYYY-MM-DD.md'
7. Update the progress file if there are relevant changes

Be direct and practical — focus on habit progress and consistency."""

def main():
    banner("🏥 Health Check-in", "Health • Habits • Progress | @kai")
    results = []
    results.append(run_claude(PROMPT, log_name="health-checkin", timeout=600, agent="kai-personal-assistant"))
    summary(results, "Health Check-in")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠ Cancelled.")
