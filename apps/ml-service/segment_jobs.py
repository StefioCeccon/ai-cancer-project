"""Background TotalSegmentator jobs."""
from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Optional

_jobs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def create_segment_job(
    study_id: str,
    sorted_paths: list[str],
    series_number: Optional[int],
    task: str = "total",
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
        args=(job_id, study_id, sorted_paths, series_number, task),
        daemon=True,
    )
    thread.start()
    return job_id


def get_segment_job(job_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _run_job(
    job_id: str,
    study_id: str,
    sorted_paths: list[str],
    series_number: Optional[int],
    task: str,
) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "running"

    try:
        from segment_subprocess import run_totalsegmentator

        result = run_totalsegmentator(
            sorted_paths,
            study_id=study_id,
            series_number=series_number,
            task=task,
        )
        payload = {"study_id": study_id, **result}
        with _lock:
            _jobs[job_id]["status"] = "completed"
            _jobs[job_id]["result"] = payload
    except Exception as e:
        with _lock:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = str(e)
