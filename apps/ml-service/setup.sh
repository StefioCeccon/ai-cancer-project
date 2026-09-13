#!/bin/bash
# One-time setup for the ML service. Run once from apps/ml-service/.
set -e

echo "==> Checking for Python 3.10 (required by Sybil, which caps at <3.11)..."
if ! command -v python3.10 &>/dev/null; then
  echo "Python 3.10 not found. Install it with: brew install python@3.10"
  exit 1
fi

echo "==> Creating Python 3.10 virtual environment..."
python3.10 -m venv .venv
source .venv/bin/activate

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing PyTorch (CPU build for Intel Mac)..."
# Intel Mac: use the standard CPU build. AMD GPU is not supported by PyTorch on macOS.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "==> Installing Sybil (lung cancer risk model from MIT/MGH)..."
# Sybil 1.4.0 is not on PyPI and pins torch==1.13.1+cu117 (CUDA/Linux, unavailable on macOS).
# We install --no-deps first, then manually install its remaining deps at the pinned versions.
pip install git+https://github.com/reginabarzilaygroup/Sybil.git --no-deps

echo "==> Installing Sybil's pinned dependencies (except torch which we supply above)..."
# numpy and pydicom must be downgraded — Sybil 1.4.0 uses numpy 1.x API and pydicom 2.x API.
pip install "numpy==1.24.1" "pydicom==2.3.0" --force-reinstall
# Remaining Sybil deps — opencv-python-headless only (server env, no display; both variants conflict)
pip install \
  "imageio==2.34.1" \
  "importlib-metadata" \
  "tqdm==4.62.3" \
  "pylibjpeg==2.0.0" \
  "torchio==0.18.74" \
  "opencv-python-headless>=4.8.0"   # 4.5.4 is binary-incompatible with numpy 1.24 on Python 3.10
# NOTE: pylibjpeg installed WITHOUT [all] extras — pylibjpeg-libjpeg/openjpeg/rle 2.x all require
# numpy>=2.0 which conflicts with Sybil's numpy 1.x requirement. Base pylibjpeg is sufficient.

echo "==> Installing FastAPI and other service deps..."
pip install fastapi uvicorn Pillow

echo ""
echo "Optional — anatomy segmentation (Phase 8/9, separate venv):"
echo "  ./setup-segmentation.sh   # creates .venv-segmentation — do not pip install into .venv"
echo ""
echo "✓ Setup complete. To start the service run: ./start.sh"
echo "  The first analysis will take extra time to download Sybil model weights (~2 GB)."
