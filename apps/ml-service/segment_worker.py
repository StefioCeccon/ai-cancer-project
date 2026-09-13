"""Subprocess entry point — runs inside .venv-segmentation only."""
from __future__ import annotations

import contextlib
import json
import sys
from pathlib import Path

ML_SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_SERVICE_DIR))


def main() -> None:
    payload = json.load(sys.stdin)
    from totalsegmentator_runner import run_totalsegmentator

    # TotalSegmentator/tqdm prints to stdout — keep stdout clean for JSON IPC.
    with contextlib.redirect_stdout(sys.stderr):
        result = run_totalsegmentator(
            payload["sorted_dicom_paths"],
            study_id=payload["study_id"],
            series_number=payload.get("series_number"),
            task=payload.get("task", "total"),
        )

    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
