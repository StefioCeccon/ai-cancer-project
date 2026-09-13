"""Run TotalSegmentator in a separate venv so Sybil pins stay intact."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Optional

ML_SERVICE_DIR = Path(__file__).resolve().parent
SEG_VENV_PYTHON = ML_SERVICE_DIR / ".venv-segmentation" / "bin" / "python"
WORKER_SCRIPT = ML_SERVICE_DIR / "segment_worker.py"

INSTALL_HINT = (
    "TotalSegmentator is not installed. Run: "
    "cd apps/ml-service && ./setup-segmentation.sh"
)


def segmentation_python() -> Optional[Path]:
    return SEG_VENV_PYTHON if SEG_VENV_PYTHON.is_file() else None


def is_available() -> bool:
    py = segmentation_python()
    if not py:
        return False
    try:
        proc = subprocess.run(
            [str(py), "-c", "import totalsegmentator, nibabel"],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(ML_SERVICE_DIR),
        )
        return proc.returncode == 0
    except Exception:
        return False


def _parse_worker_json(stdout: str) -> dict:
    text = stdout.strip()
    if not text:
        raise RuntimeError("Segmentation worker returned empty output")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback if progress output leaked onto stdout before JSON.
        for line in reversed(text.splitlines()):
            candidate = line.strip()
            if candidate.startswith("{"):
                return json.loads(candidate)
        raise RuntimeError(
            "Segmentation worker returned invalid JSON. "
            f"Last stdout line: {text.splitlines()[-1][:200]}"
        )


def run_totalsegmentator(
    sorted_dicom_paths: list[str],
    study_id: str,
    series_number: Optional[int] = None,
    task: str = "total",
) -> dict:
    py = segmentation_python()
    if not py:
        raise RuntimeError(INSTALL_HINT)

    payload = {
        "study_id": study_id,
        "sorted_dicom_paths": sorted_dicom_paths,
        "series_number": series_number,
        "task": task,
    }

    env = os.environ.copy()
    env.setdefault("OMP_NUM_THREADS", "8")
    env.setdefault("MKL_NUM_THREADS", "8")
    # nnU-Net spawns worker processes; keep preprocessing light on macOS CPU.
    env.setdefault("nnUNet_def_n_proc", "2")

    proc = subprocess.run(
        [str(py), str(WORKER_SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(ML_SERVICE_DIR),
        env=env,
    )

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(detail or "Segmentation worker failed")

    return _parse_worker_json(proc.stdout)
