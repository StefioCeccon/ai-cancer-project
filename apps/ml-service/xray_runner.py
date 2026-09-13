"""TorchXRayVision stub — install optional deps to enable (Phase 8)."""

INSTALL_HINT = (
    "TorchXRayVision is not installed. This endpoint is a stub until "
    "torchxrayvision is added to requirements-segmentation.txt"
)


def is_available() -> bool:
    try:
        import torchxrayvision  # noqa: F401
        return True
    except ImportError:
        return False


def run_xray(_image_path: str) -> dict:
    if not is_available():
        raise RuntimeError(INSTALL_HINT)
    raise NotImplementedError("TorchXRayVision integration pending")
