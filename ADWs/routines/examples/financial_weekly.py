#!/usr/bin/env python3
"""ADW: Financial Weekly — Weekly financial report via Flux"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from runner import run_skill, banner, summary

def main():
    banner("📊 Financial Weekly", "Revenue • Expenses • Cash Flow • Delinquency | @flux")
    results = []
    results.append(run_skill("fin-weekly-report", log_name="financial-weekly", timeout=900, agent="flux-finance"))
    summary(results, "Financial Weekly")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠ Cancelled.")
