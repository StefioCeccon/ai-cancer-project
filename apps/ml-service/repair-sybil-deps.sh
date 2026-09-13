#!/bin/bash
# Restore Sybil venv after TotalSegmentator was accidentally installed into .venv.
set -e

cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  echo "No .venv found. Run ./setup.sh first."
  exit 1
fi

source .venv/bin/activate

echo "==> Removing segmentation packages from Sybil venv (if present)..."
pip uninstall -y \
  TotalSegmentator nnunetv2 dicom2nifti blosc2 acvl-utils \
  batchgenerators batchgeneratorsv2 dynamic-network-architectures \
  SimpleITK pyarrow xmltodict xvfbwrapper nibabel \
  2>/dev/null || true

CONSTRAINTS="$(pwd)/constraints-sybil.txt"

echo "==> Restoring Sybil-compatible numpy, pydicom, opencv..."
pip install -c "$CONSTRAINTS" \
  "numpy==1.24.1" \
  "pydicom==2.3.0" \
  "opencv-python-headless>=4.8.0,<4.14" \
  --force-reinstall

echo ""
echo "✓ Sybil venv repaired."
echo "  For segmentation, use the separate venv: ./setup-segmentation.sh
If segmentation fails with NumPy errors: ./repair-segmentation-deps.sh"
echo "  Restart the ML service: ./start.sh"
