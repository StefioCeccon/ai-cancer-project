"""
Prepare uploaded DICOM paths for Sybil inference.

Uploads often contain multiple series (scout, reformatted, screen saves, etc.).
Sybil expects a single primary axial CT series with spatial metadata.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

import pydicom

# CT Image Storage
PRIMARY_CT_SOP = "1.2.840.10008.5.1.4.1.1.2"
# Secondary Capture Image Storage (screen saves, thumbnails, etc.)
SECONDARY_CAPTURE_SOP = "1.2.840.10008.5.1.4.1.1.7"

EXCLUDED_IMAGE_TYPES = {"SECONDARY", "SCREEN SAVE", "REFORMATTED", "LOCALIZER", "SCOUT"}
MAX_SLICE_THICKNESS_MM = 5.0
PREFERRED_SLICE_THICKNESS_MM = 2.5


@dataclass(frozen=True)
class SliceMeta:
    path: str
    series_number: int
    instance_number: int
    z_position: float
    slice_thickness: float


@dataclass(frozen=True)
class PreparedSeries:
    paths: list[str]
    series_number: int
    slice_count: int
    slice_thickness_mm: float
    excluded_count: int


@dataclass(frozen=True)
class SeriesInfo:
    series_number: int
    slice_count: int
    description: str
    image_type: str
    slice_thickness_mm: Optional[float]
    sybil_suitable: bool
    unsuitability_reason: Optional[str]


def _read_header(path: str) -> Optional[pydicom.dataset.FileDataset]:
    try:
        return pydicom.dcmread(path, stop_before_pixels=True)
    except Exception:
        return None


def _image_type_label(ds: pydicom.dataset.FileDataset) -> str:
    return "\\".join(str(v) for v in getattr(ds, "ImageType", []))


def _sybil_unsuitability(ds: pydicom.dataset.FileDataset) -> Optional[str]:
    if getattr(ds, "Modality", None) != "CT":
        return "Not a CT series"

    sop = getattr(ds, "SOPClassUID", "")
    if sop == SECONDARY_CAPTURE_SOP:
        return "Secondary capture / screen save"
    if sop != PRIMARY_CT_SOP:
        return "Not a primary CT image"

    image_type = {str(v).upper() for v in getattr(ds, "ImageType", [])}
    matched = image_type & EXCLUDED_IMAGE_TYPES
    if matched:
        return f"Derived image ({', '.join(sorted(matched)).title()})"

    required = ("ImagePositionPatient", "SliceThickness", "PixelSpacing")
    missing = [tag for tag in required if not hasattr(ds, tag)]
    if missing:
        return f"Missing spatial metadata ({', '.join(missing)})"

    thickness = float(ds.SliceThickness)
    if thickness > MAX_SLICE_THICKNESS_MM:
        return f"Slice thickness {thickness:g} mm exceeds Sybil limit ({MAX_SLICE_THICKNESS_MM:g} mm)"

    return None


def _is_primary_ct_slice(ds: pydicom.dataset.FileDataset) -> bool:
    return _sybil_unsuitability(ds) is None


def _slice_meta(path: str, ds: pydicom.dataset.FileDataset) -> SliceMeta:
    return SliceMeta(
        path=path,
        series_number=int(getattr(ds, "SeriesNumber", 0) or 0),
        instance_number=int(getattr(ds, "InstanceNumber", 0) or 0),
        z_position=float(ds.ImagePositionPatient[-1]),
        slice_thickness=float(ds.SliceThickness),
    )


def _series_score(slices: list[SliceMeta]) -> tuple:
    """Higher is better. Prefer more slices, then thickness near 2.5 mm."""
    thickness = slices[0].slice_thickness
    thickness_penalty = abs(thickness - PREFERRED_SLICE_THICKNESS_MM)
    return (len(slices), -thickness_penalty)


def _group_slices_by_series(dicom_paths: list[str]) -> tuple[dict[int, list[SliceMeta]], dict[int, list[str]], int]:
    """Return Sybil-ready slices, all slices grouped by series, and excluded count."""
    sybil_by_series: dict[int, list[SliceMeta]] = defaultdict(list)
    all_by_series: dict[int, list[tuple[int, str]]] = defaultdict(list)
    excluded = 0

    for path in dicom_paths:
        ds = _read_header(path)
        if ds is None:
            excluded += 1
            continue

        series_number = int(getattr(ds, "SeriesNumber", 0) or 0)
        instance_number = int(getattr(ds, "InstanceNumber", 0) or 0)
        all_by_series[series_number].append((instance_number, path))

        if not _is_primary_ct_slice(ds):
            excluded += 1
            continue

        sybil_by_series[series_number].append(_slice_meta(path, ds))

    return sybil_by_series, all_by_series, excluded


def list_study_series(dicom_paths: list[str]) -> tuple[list[SeriesInfo], Optional[int]]:
    """
    List every DICOM series in a study with Sybil suitability metadata.

    Returns:
        (series_list, recommended_series_number)
    """
    if not dicom_paths:
        return [], None

    sybil_by_series, all_by_series, _ = _group_slices_by_series(dicom_paths)
    series_numbers = sorted(set(all_by_series) | set(sybil_by_series))
    results: list[SeriesInfo] = []

    for series_number in series_numbers:
        sample_path = sorted(all_by_series.get(series_number, []))[0][1]
        ds = _read_header(sample_path)
        if ds is None:
            continue

        sybil_slices = sybil_by_series.get(series_number, [])
        reason = _sybil_unsuitability(ds)
        thickness = float(ds.SliceThickness) if hasattr(ds, "SliceThickness") else None

        results.append(
            SeriesInfo(
                series_number=series_number,
                slice_count=len(all_by_series.get(series_number, [])),
                description=str(getattr(ds, "SeriesDescription", "") or "").strip(),
                image_type=_image_type_label(ds),
                slice_thickness_mm=thickness,
                sybil_suitable=reason is None and len(sybil_slices) > 0,
                unsuitability_reason=reason if reason or not sybil_slices else None,
            )
        )

    recommended = None
    if sybil_by_series:
        recommended = max(sybil_by_series.items(), key=lambda item: _series_score(item[1]))[0]

    return results, recommended


def prepare_sybil_series(
    dicom_paths: list[str],
    series_number: Optional[int] = None,
) -> PreparedSeries:
    """
    Filter and order DICOM paths for Sybil.

    Raises ValueError with a user-facing message when no suitable series exists.
    """
    if not dicom_paths:
        raise ValueError("No DICOM files provided")

    sybil_by_series, _, excluded = _group_slices_by_series(dicom_paths)

    if not sybil_by_series:
        raise ValueError(
            "No suitable primary CT series found. "
            "Sybil needs axial CT slices with spatial metadata — "
            "screen saves, reformatted views, and scout images are excluded."
        )

    if series_number is not None:
        if series_number not in sybil_by_series:
            available = ", ".join(str(n) for n in sorted(sybil_by_series))
            raise ValueError(
                f"Series {series_number} is not suitable for Sybil analysis. "
                f"Available primary series: {available}"
            )
        selected_number = series_number
        selected_slices = sybil_by_series[series_number]
    else:
        selected_number, selected_slices = max(
            sybil_by_series.items(),
            key=lambda item: _series_score(item[1]),
        )

    selected_slices = sorted(selected_slices, key=lambda s: (s.z_position, s.instance_number))

    return PreparedSeries(
        paths=[s.path for s in selected_slices],
        series_number=selected_number,
        slice_count=len(selected_slices),
        slice_thickness_mm=selected_slices[0].slice_thickness,
        excluded_count=excluded,
    )
