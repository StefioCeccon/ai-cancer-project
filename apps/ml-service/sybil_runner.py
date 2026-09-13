"""
Sybil lung cancer risk prediction wrapper.
Sybil paper: Mikhael et al., 2023 (MGH / MIT)
Official repo: https://github.com/reginabarzilaygroup/Sybil
"""
import time
import os
import numpy as np
from typing import Optional

_model = None

def load_model():
    """Load and cache the Sybil ensemble model. Called once at startup."""
    global _model
    if _model is not None:
        return _model

    from sybil import Sybil
    import torch

    print("Loading Sybil model weights...")
    t0 = time.time()

    # Force CPU — AMD GPU not supported by PyTorch on macOS
    device = "cpu"
    torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "8")))

    # "sybil_ensemble" averages predictions across 5 model seeds for robustness
    _model = Sybil("sybil_ensemble", device=device)
    print(f"Sybil loaded in {time.time() - t0:.1f}s")
    return _model


def run_sybil(
    sorted_dicom_paths: list[str],
    series_number: Optional[int] = None,
    study_id: Optional[str] = None,
) -> dict:
    """
    Run Sybil inference on a sorted list of DICOM file paths.

    Args:
        sorted_dicom_paths: DICOM files sorted by instance number (ascending).
        study_id: When set, export per-slice attention heatmap PNGs for the viewer.

    Returns:
        dict with keys: risk_scores, high_risk_instances, processing_time_seconds
    """
    from sybil import Serie
    from dicom_prep import prepare_sybil_series

    if not sorted_dicom_paths:
        raise ValueError("No DICOM paths provided")

    prepared = prepare_sybil_series(sorted_dicom_paths, series_number=series_number)
    other_files = len(sorted_dicom_paths) - prepared.slice_count - prepared.excluded_count
    if prepared.excluded_count or other_files:
        print(
            f"Sybil prep: analyzing series {prepared.series_number} "
            f"({prepared.slice_count} slices @ {prepared.slice_thickness_mm} mm). "
            f"Study total: {len(sorted_dicom_paths)} files — "
            f"{prepared.excluded_count} unsuitable, "
            f"{other_files} from other series not selected."
        )

    t0 = time.time()
    model = load_model()

    serie = Serie(prepared.paths)

    try:
        # Request attention maps to identify high-risk slices
        prediction = model.predict([serie], return_attentions=True)
        attentions = prediction.attentions  # shape: (1, n_slices) or None
    except TypeError:
        # Older Sybil versions don't support return_attentions
        prediction = model.predict([serie])
        attentions = None

    # Risk scores: 6 values (1yr through 6yr), as probabilities 0.0–1.0
    raw_scores = prediction.scores[0]
    risk_scores = {
        "1yr": round(float(raw_scores[0]), 4),
        "2yr": round(float(raw_scores[1]), 4),
        "3yr": round(float(raw_scores[2]), 4),
        "4yr": round(float(raw_scores[3]), 4),
        "5yr": round(float(raw_scores[4]), 4),
        "6yr": round(float(raw_scores[5]), 4),
    }

    # Identify high-attention slices using Sybil's attention collator
    high_risk_instances: list[int] = []
    high_risk_file_paths: list[str] = []
    heatmap_by_file: dict[str, str] = {}

    if attentions is not None:
        try:
            from sybil.utils.visualization import collate_attentions
            from heatmap_export import export_attention_heatmaps, heatmap_output_paths

            attention_vol = collate_attentions(attentions[0], prepared.slice_count)
            slice_scores = attention_vol.reshape(prepared.slice_count, -1).max(axis=1)
            if np.any(slice_scores > 0):
                threshold = float(np.percentile(slice_scores, 85))  # top ~15%
                high_risk_indices = [
                    i for i, score in enumerate(slice_scores) if score >= threshold
                ]
                high_risk_instances = [i + 1 for i in high_risk_indices]
                high_risk_file_paths = [prepared.paths[i] for i in high_risk_indices]

            if study_id:
                out_dir, web_prefix = heatmap_output_paths(study_id)
                heatmap_by_file = export_attention_heatmaps(
                    attention_vol,
                    prepared.paths,
                    out_dir,
                    web_prefix,
                )
                print(f"Exported {len(heatmap_by_file)} Sybil heatmap PNGs to {out_dir}")
        except Exception as e:
            print(f"Warning: Sybil attention extraction failed: {e}")

    return {
        "risk_scores": risk_scores,
        "high_risk_instances": high_risk_instances,
        "high_risk_file_paths": high_risk_file_paths,
        "heatmap_by_file": heatmap_by_file,
        "processing_time_seconds": round(time.time() - t0, 1),
        "slice_count": prepared.slice_count,
        "series_number": prepared.series_number,
        "slice_thickness_mm": prepared.slice_thickness_mm,
        "excluded_slice_count": prepared.excluded_count,
    }


def classify_risk(risk_scores: dict) -> str:
    """Classify overall risk level based on 6-year score."""
    score_6yr = risk_scores.get("6yr", 0)
    if score_6yr < 0.03:
        return "low"
    elif score_6yr < 0.10:
        return "elevated"
    else:
        return "high"
