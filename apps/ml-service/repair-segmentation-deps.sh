#!/bin/bash
# Fix NumPy 2.x in .venv-segmentation (breaks PyTorch: "Numpy is not available").
set -e

cd "$(dirname "$0")"

if [[ ! -d .venv-segmentation ]]; then
  echo "No .venv-segmentation found. Run ./setup-segmentation.sh first."
  exit 1
fi

source .venv-segmentation/bin/activate

echo "==> Downgrading NumPy to 1.x for PyTorch compatibility..."
pip install "numpy>=1.26.4,<2.0" --force-reinstall

python -c "import numpy; import torch; print('numpy', numpy.__version__); print('torch', torch.__version__); x = torch.from_numpy(numpy.zeros(2)); print('torch.from_numpy ok')"

echo "✓ Segmentation venv repaired. Restart the ML service: ./start.sh"
