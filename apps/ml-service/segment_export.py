"""Export TotalSegmentator multilabel volumes to per-slice web PNG masks."""
from __future__ import annotations

import json
import os
import shutil
from typing import Dict, List

import nibabel as nib
import numpy as np
import pydicom
from PIL import Image


def segment_output_paths(study_id: str) -> tuple[str, str]:
    web_public = os.environ.get(
        "WEB_PUBLIC_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public")),
    )
    rel = f"uploads/segments/{study_id}"
    return os.path.join(web_public, rel), f"/{rel}"


def load_label_map() -> Dict[str, str]:
    try:
        from totalsegmentator.map_to_binary import class_map  # type: ignore

        total = class_map.get("total", {})
        return {str(k): str(v) for k, v in total.items()}
    except Exception:
        return {}


def _infer_plane(iop: list[float] | tuple[float, ...]) -> str:
    """Infer image plane from ImageOrientationPatient (matches TotalSegmentator)."""
    if len(iop) != 6:
        return "oblique"

    rx, ry, rz, cx, cy, cz = (float(x) for x in iop)
    nx = ry * cz - rz * cy
    ny = rz * cx - rx * cz
    nz = rx * cy - ry * cx
    ax, ay, az = abs(nx), abs(ny), abs(nz)
    dominant = max(ax, ay, az)
    if dominant < 0.9:
        return "oblique"
    if az == dominant:
        return "axial"
    if ay == dominant:
        return "coronal"
    return "sagittal"


def _slice_sort_key(dicom_path: str, plane: str) -> float:
    ds = pydicom.dcmread(dicom_path, stop_before_pixels=True)
    ipp = getattr(ds, "ImagePositionPatient", None)
    if ipp is None:
        return 0.0
    axis = {"axial": 2, "coronal": 1, "sagittal": 0}.get(plane, 2)
    return float(ipp[axis])


def _align_volume_axes(
    vol: np.ndarray,
    rows: int,
    cols: int,
    n_slices: int,
    plane: str,
) -> np.ndarray:
    """Match TotalSegmentator DICOM-SEG axis permutations only (no RTStruct reorientation).

    TotalSegmentator multilabel output is already in the same voxel grid as the converted
    NIfTI (img_in_orig). RTStruct/DICOM-SEG apply an extra in-plane flip/transpose for
    DICOM SEG writers; applying that here misaligns labels vs pydicom pixel arrays.
    """
    shape = vol.shape

    if shape == (cols, rows, n_slices) and plane == "axial":
        return np.transpose(vol, (1, 0, 2))
    if shape == (cols, n_slices, rows) and plane == "coronal":
        return np.transpose(vol, (0, 2, 1))
    if shape == (n_slices, rows, cols) and plane == "sagittal":
        return np.transpose(vol, (1, 2, 0))
    if shape != (rows, cols, n_slices):
        raise ValueError(
            f"Segmentation shape {shape} does not match DICOM dimensions ({rows}, {cols}, {n_slices})",
        )
    return vol


def _orient_slice_to_dicom_pixels(sl: np.ndarray, plane: str) -> np.ndarray:
    """Map NIfTI slice rows/cols to pydicom + radiological axial display (Cornerstone)."""
    if plane == "axial":
        return np.fliplr(sl)
    return sl


def export_slice_masks(
    multilabel_path: str,
    dicom_paths: list[str],
    output_dir: str,
    web_prefix: str,
) -> tuple[Dict[str, str], Dict[str, List[int]], Dict[str, str]]:
    if os.path.isdir(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    if not dicom_paths:
        raise ValueError("No DICOM paths provided")

    seg_img = nib.load(multilabel_path)
    vol = seg_img.get_fdata()

    ds0 = pydicom.dcmread(dicom_paths[0], stop_before_pixels=True)
    rows = int(getattr(ds0, "Rows", vol.shape[0]))
    cols = int(getattr(ds0, "Columns", vol.shape[1]))
    n_slices = len(dicom_paths)
    plane = _infer_plane(getattr(ds0, "ImageOrientationPatient", []))

    aligned = _align_volume_axes(vol, rows, cols, n_slices, plane)

    sorted_paths = sorted(dicom_paths, key=lambda path: _slice_sort_key(path, plane))
    path_to_slice = {path: index for index, path in enumerate(sorted_paths)}

    mask_by_file: Dict[str, str] = {}
    labels_on_slice: Dict[str, List[int]] = {}
    label_map = load_label_map()

    for dicom_path in dicom_paths:
        slice_idx = path_to_slice[dicom_path]
        sl = np.clip(aligned[:, :, slice_idx], 0, 255).astype(np.uint8)
        sl = _orient_slice_to_dicom_pixels(sl, plane)

        if sl.shape != (rows, cols):
            raise ValueError(
                f"Mask shape {sl.shape} does not match DICOM {rows}x{cols} for {dicom_path}",
            )

        basename = os.path.basename(dicom_path)
        stem, _ = os.path.splitext(basename)
        out_name = f"{stem}_seg.png"
        out_path = os.path.join(output_dir, out_name)

        Image.fromarray(sl, mode="L").save(out_path, optimize=True)

        present = sorted(int(v) for v in np.unique(sl) if int(v) > 0)
        mask_by_file[basename] = f"{web_prefix}/{out_name}"
        labels_on_slice[basename] = present

    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "labels": label_map,
                "labels_on_slice": labels_on_slice,
                "export_version": 4,
            },
            f,
            indent=2,
        )

    return mask_by_file, labels_on_slice, label_map
