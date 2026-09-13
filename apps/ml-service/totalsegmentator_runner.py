"""TotalSegmentator wrapper for CT organ segmentation (Phase 8/9)."""
from __future__ import annotations

import glob
import os
import shutil
import tempfile
import time
from typing import Optional


def _resolve_multilabel_path(output_dir: str, seg_img) -> str:
    """TotalSegmentator with ml=True writes to a file path, not a directory."""
    expected = os.path.join(output_dir, "multilabel.nii.gz")
    if os.path.isfile(expected):
        return expected

    if seg_img is not None:
        import nibabel as nib

        nib.save(seg_img, expected)
        return expected

    matches = sorted(glob.glob(os.path.join(output_dir, "**", "*.nii.gz"), recursive=True))
    if matches:
        return matches[0]

    raise RuntimeError(
        "TotalSegmentator finished but multilabel.nii.gz was not found. "
        f"Checked: {expected}"
    )


def run_totalsegmentator(
    sorted_dicom_paths: list[str],
    study_id: str,
    series_number: Optional[int] = None,
    task: str = "total",
) -> dict:
    from dicom_prep import prepare_sybil_series
    from segment_export import export_slice_masks, segment_output_paths
    from totalsegmentator.python_api import totalsegmentator

    if not sorted_dicom_paths:
        raise ValueError("No DICOM paths provided")

    prepared = prepare_sybil_series(sorted_dicom_paths, series_number=series_number)
    t0 = time.time()

    tmp_input = tempfile.mkdtemp(prefix="ts-input-")
    tmp_output = tempfile.mkdtemp(prefix="ts-output-")
    multilabel_path = os.path.join(tmp_output, "multilabel.nii.gz")
    try:
        for src in prepared.paths:
            shutil.copy2(src, os.path.join(tmp_input, os.path.basename(src)))

        seg_img = totalsegmentator(
            tmp_input,
            multilabel_path,
            task=task,
            ml=True,
            fast=True,
            device="cpu",
            quiet=True,
            preview=False,
        )

        multilabel_path = _resolve_multilabel_path(tmp_output, seg_img)

        out_dir, web_prefix = segment_output_paths(study_id)
        mask_by_file, labels_on_slice, label_map = export_slice_masks(
            multilabel_path,
            prepared.paths,
            out_dir,
            web_prefix,
        )

        return {
            "model": "TotalSegmentator",
            "task": task,
            "series_number": prepared.series_number,
            "slice_count": prepared.slice_count,
            "processing_time_seconds": round(time.time() - t0, 1),
            "labels": label_map,
            "mask_by_file": mask_by_file,
            "labels_on_slice": labels_on_slice,
        }
    finally:
        shutil.rmtree(tmp_input, ignore_errors=True)
        shutil.rmtree(tmp_output, ignore_errors=True)
