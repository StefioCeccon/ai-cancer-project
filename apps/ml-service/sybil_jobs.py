"""Background Sybil inference jobs — avoids HTTP timeouts on long CPU runs."""
from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Optional

_jobs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def create_sybil_job(
    study_id: str,
    sorted_paths: list[str],
    series_number: Optional[int],
) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "study_id": study_id,
            "status": "queued",
            "created_at": time.time(),
            "result": None,
            "error": None,
        }

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, study_id, sorted_paths, series_number),
        daemon=True,
    )
    thread.start()
    return job_id


def get_sybil_job(job_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _run_job(
    job_id: str,
    study_id: str,
    sorted_paths: list[str],
    series_number: Optional[int],
) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "running"

    try:
        from sybil_runner import run_sybil, classify_risk

        result = run_sybil(sorted_paths, series_number=series_number, study_id=study_id)
        payload = {
            "study_id": study_id,
            "model": "sybil_ensemble",
            "risk_scores": result["risk_scores"],
            "risk_level": classify_risk(result["risk_scores"]),
            "high_risk_instances": result["high_risk_instances"],
            "high_risk_file_paths": result.get("high_risk_file_paths", []),
            "heatmap_by_file": result.get("heatmap_by_file", {}),
            "slice_count": result.get("slice_count", len(sorted_paths)),
            "processing_time_seconds": result["processing_time_seconds"],
            "series_number": result.get("series_number"),
            "slice_thickness_mm": result.get("slice_thickness_mm"),
            "excluded_slice_count": result.get("excluded_slice_count"),
        }
        with _lock:
            _jobs[job_id]["status"] = "completed"
            _jobs[job_id]["result"] = payload
    except Exception as e:
        with _lock:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = str(e)
