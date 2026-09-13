#!/bin/bash
# Optional TotalSegmentator install (Phase 8/9). Creates .venv-segmentation — separate from Sybil.
set -e

cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  echo "No Sybil venv (.venv). Run ./setup.sh first."
  exit 1
fi

if ! command -v python3.10 &>/dev/null; then
  echo "Python 3.10 not found. Install with: brew install python@3.10"
  exit 1
fi

NUMPY_PIN="numpy>=1.26.4,<2.0"

echo "==> Creating segmentation venv (.venv-segmentation)..."
rm -rf .venv-segmentation
python3.10 -m venv .venv-segmentation
source .venv-segmentation/bin/activate

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Pinning NumPy 1.x (required by PyTorch CPU on macOS)..."
pip install "$NUMPY_PIN"

echo "==> Installing PyTorch (CPU) into segmentation venv..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "==> Installing TotalSegmentator and deps..."
pip install -r requirements-segmentation.txt

echo "==> Re-pinning NumPy 1.x (TotalSegmentator may try to upgrade it)..."
pip install "$NUMPY_PIN" --force-reinstall

echo ""
echo "✓ TotalSegmentator installed in .venv-segmentation"
echo "  Sybil is unchanged in .venv"
echo "  Restart the ML service: ./start.sh"
echo "  First segmentation run downloads model weights (~1–2 GB)."
