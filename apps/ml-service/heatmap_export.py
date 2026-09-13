"""Export Sybil attention volumes as web-served PNG heatmaps."""
from __future__ import annotations

import os
import shutil
from typing import Dict

import numpy as np
from PIL import Image


def heatmap_output_paths(study_id: str) -> tuple[str, str]:
    """Return (absolute_dir, web_prefix) for a study's heatmap PNGs."""
    web_public = os.environ.get(
        "WEB_PUBLIC_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public")),
    )
    rel = f"uploads/sybil-heatmaps/{study_id}"
    return os.path.join(web_public, rel), f"/{rel}"


def export_attention_heatmaps(
    attention_vol: np.ndarray,
    dicom_paths: list[str],
    output_dir: str,
    web_prefix: str,
) -> Dict[str, str]:
    """
    Save per-slice RGBA heatmap PNGs aligned to Sybil's 512×512 attention grid.

    Returns map of DICOM basename -> web URL path (e.g. /uploads/sybil-heatmaps/…).
    """
    if os.path.isdir(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    heatmap_by_file: Dict[str, str] = {}
    slice_count = min(len(dicom_paths), attention_vol.shape[0])

    for i in range(slice_count):
        heat = attention_vol[i]
        basename = os.path.basename(dicom_paths[i])
        stem, _ = os.path.splitext(basename)
        out_name = f"{stem}_heatmap.png"
        out_path = os.path.join(output_dir, out_name)

        if heat.max() > 0:
            norm = np.clip(heat / heat.max(), 0.0, 1.0)
        else:
            norm = np.zeros_like(heat, dtype=np.float32)

        alpha = (norm * 210).astype(np.uint8)
        rgba = np.zeros((*heat.shape, 4), dtype=np.uint8)
        rgba[..., 0] = 168  # purple
        rgba[..., 1] = 85
        rgba[..., 2] = 247
        rgba[..., 3] = alpha

        Image.fromarray(rgba, mode="RGBA").save(out_path, optimize=True)
        heatmap_by_file[basename] = f"{web_prefix}/{out_name}"

    return heatmap_by_file
