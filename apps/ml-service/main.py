"""
Cancer Monitor ML Inference Service
Runs locally on your machine — no data leaves your network.
Start with: ./start.sh
"""
from contextlib import asynccontextmanager
from typing import Optional
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load Sybil at startup so the first request isn't extra slow
    try:
        from sybil_runner import load_model
        load_model()
    except Exception as e:
        print(f"Warning: Sybil model failed to pre-load: {e}")
        print("It will be loaded on first request instead.")
    yield


app = FastAPI(
    title="Cancer Monitor ML Service",
    description="Local ML inference — data stays on your machine",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow calls from Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SybilInstance(BaseModel):
    file_path: str       # absolute path on this machine
    instance_number: int


class SybilRequest(BaseModel):
    study_id: str
    instances: list[SybilInstance]
    series_number: Optional[int] = None


class SeriesInfoResponse(BaseModel):
    series_number: int
    slice_count: int
    description: str
    image_type: str
    slice_thickness_mm: Optional[float]
    sybil_suitable: bool
    unsuitability_reason: Optional[str]


class StudySeriesRequest(BaseModel):
    instances: list[SybilInstance]


class StudySeriesResponse(BaseModel):
    series: list[SeriesInfoResponse]
    recommended_series_number: Optional[int]


class SybilResponse(BaseModel):
    study_id: str
    model: str
    risk_scores: dict[str, float]
    risk_level: str
    high_risk_instances: list[int]
    slice_count: int
    processing_time_seconds: float
    series_number: Optional[int] = None
    slice_thickness_mm: Optional[float] = None
    excluded_slice_count: Optional[int] = None
    high_risk_file_paths: Optional[list[str]] = None
    heatmap_by_file: Optional[dict[str, str]] = None


class SybilJobStartResponse(BaseModel):
    job_id: str
    status: str


class SybilJobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[SybilResponse] = None
    error: Optional[str] = None


class SegmentRequest(BaseModel):
    study_id: str
    instances: list[SybilInstance]
    series_number: Optional[int] = None
    task: str = "total"


class SegmentResponse(BaseModel):
    study_id: str
    model: str
    task: str
    series_number: Optional[int] = None
    slice_count: int
    processing_time_seconds: float
    labels: dict[str, str]
    mask_by_file: dict[str, str]
    labels_on_slice: dict[str, list[int]]


class SegmentJobStartResponse(BaseModel):
    job_id: str
    status: str


class SegmentJobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[SegmentResponse] = None
    error: Optional[str] = None


class XrayRequest(BaseModel):
    image_path: str


class StubResponse(BaseModel):
    status: str
    message: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "cancer-monitor-ml"}


@app.post("/study/series", response_model=StudySeriesResponse)
def list_study_series(request: StudySeriesRequest):
    if not request.instances:
        raise HTTPException(status_code=400, detail="No instances provided")

    paths = [i.file_path for i in request.instances]
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} DICOM file(s) not found on disk. First missing: {missing[0]}",
        )

    from dicom_prep import list_study_series as discover_series

    series, recommended = discover_series(paths)
    return StudySeriesResponse(
        series=[
            SeriesInfoResponse(
                series_number=s.series_number,
                slice_count=s.slice_count,
                description=s.description,
                image_type=s.image_type,
                slice_thickness_mm=s.slice_thickness_mm,
                sybil_suitable=s.sybil_suitable,
                unsuitability_reason=s.unsuitability_reason,
            )
            for s in series
        ],
        recommended_series_number=recommended,
    )


@app.post("/analyze/sybil", response_model=SybilResponse)
def analyze_sybil(request: SybilRequest):
    if not request.instances:
        raise HTTPException(status_code=400, detail="No instances provided")

    # Validate all files exist before starting inference
    missing = [i.file_path for i in request.instances if not os.path.isfile(i.file_path)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} DICOM file(s) not found on disk. "
                   f"First missing: {missing[0]}"
        )

    # Sort by instance number — Sybil expects slices in anatomical order
    sorted_instances = sorted(request.instances, key=lambda i: i.instance_number)
    sorted_paths = [i.file_path for i in sorted_instances]

    try:
        from sybil_runner import run_sybil, classify_risk
        result = run_sybil(sorted_paths, series_number=request.series_number, study_id=request.study_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sybil inference failed: {str(e)}")

    return SybilResponse(
        study_id=request.study_id,
        model="sybil_ensemble",
        risk_scores=result["risk_scores"],
        risk_level=classify_risk(result["risk_scores"]),
        high_risk_instances=result["high_risk_instances"],
        slice_count=result.get("slice_count", len(sorted_paths)),
        processing_time_seconds=result["processing_time_seconds"],
        series_number=result.get("series_number"),
        slice_thickness_mm=result.get("slice_thickness_mm"),
        excluded_slice_count=result.get("excluded_slice_count"),
        high_risk_file_paths=result.get("high_risk_file_paths"),
        heatmap_by_file=result.get("heatmap_by_file") or None,
    )


@app.post("/analyze/sybil/async", response_model=SybilJobStartResponse)
def start_analyze_sybil_async(request: SybilRequest):
    if not request.instances:
        raise HTTPException(status_code=400, detail="No instances provided")

    missing = [i.file_path for i in request.instances if not os.path.isfile(i.file_path)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} DICOM file(s) not found on disk. First missing: {missing[0]}",
        )

    sorted_instances = sorted(request.instances, key=lambda i: i.instance_number)
    sorted_paths = [i.file_path for i in sorted_instances]

    from sybil_jobs import create_sybil_job

    job_id = create_sybil_job(request.study_id, sorted_paths, request.series_number)
    return SybilJobStartResponse(job_id=job_id, status="queued")


@app.get("/analyze/sybil/jobs/{job_id}", response_model=SybilJobStatusResponse)
def get_analyze_sybil_job(job_id: str):
    from sybil_jobs import get_sybil_job

    job = get_sybil_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job["status"] == "completed" and job["result"]:
        result = SybilResponse(**job["result"])

    return SybilJobStatusResponse(
        job_id=job_id,
        status=job["status"],
        result=result,
        error=job.get("error"),
    )


def _sorted_paths_from_instances(instances: list[SybilInstance]) -> list[str]:
    missing = [i.file_path for i in instances if not os.path.isfile(i.file_path)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} DICOM file(s) not found on disk. First missing: {missing[0]}",
        )
    sorted_instances = sorted(instances, key=lambda i: i.instance_number)
    return [i.file_path for i in sorted_instances]


@app.post("/analyze/segment/async", response_model=SegmentJobStartResponse)
def start_analyze_segment_async(request: SegmentRequest):
    if not request.instances:
        raise HTTPException(status_code=400, detail="No instances provided")

    sorted_paths = _sorted_paths_from_instances(request.instances)

    from segment_jobs import create_segment_job

    job_id = create_segment_job(
        request.study_id,
        sorted_paths,
        request.series_number,
        request.task,
    )
    return SegmentJobStartResponse(job_id=job_id, status="queued")


@app.get("/analyze/segment/jobs/{job_id}", response_model=SegmentJobStatusResponse)
def get_analyze_segment_job(job_id: str):
    from segment_jobs import get_segment_job

    job = get_segment_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job["status"] == "completed" and job["result"]:
        result = SegmentResponse(**job["result"])

    return SegmentJobStatusResponse(
        job_id=job_id,
        status=job["status"],
        result=result,
        error=job.get("error"),
    )


@app.get("/models/status")
def models_status():
    from segment_subprocess import is_available as ts_available, INSTALL_HINT as ts_hint
    from xray_runner import is_available as xray_available, INSTALL_HINT as xray_hint

    return {
        "sybil": True,
        "totalsegmentator": {"available": ts_available(), "install_hint": ts_hint},
        "torchxrayvision": {"available": xray_available(), "install_hint": xray_hint},
        "nnunet_brats": {"available": False, "install_hint": "Not implemented yet"},
    }


@app.post("/analyze/xray")
def analyze_xray(request: XrayRequest):
    from xray_runner import run_xray

    if not os.path.isfile(request.image_path):
        raise HTTPException(status_code=400, detail="Image file not found")
    try:
        return run_xray(request.image_path)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/analyze/nnunet/brats")
def analyze_nnunet_brats(request: StudySeriesRequest):
    if not request.instances:
        raise HTTPException(status_code=400, detail="No instances provided")
    sorted_paths = _sorted_paths_from_instances(request.instances)
    from nnunet_runner import run_nnunet_brats

    try:
        return run_nnunet_brats(sorted_paths)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
