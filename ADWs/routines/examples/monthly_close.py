#!/usr/bin/env python3
"""ADW: Monthly Close Kickoff — Monthly close via Flux"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from runner import run_skill, banner, summary

def main():
    banner("📋 Monthly Close Kickoff", "P&L • Checklist • Invoices • Pending Items Finance Team | @flux")
    results = []
    results.append(run_skill("fin-monthly-close-kickoff", log_name="monthly-close", timeout=900, agent="flux-finance"))
    summary(results, "Monthly Close Kickoff")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠ Cancelled.")
