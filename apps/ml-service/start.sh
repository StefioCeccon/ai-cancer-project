#!/bin/bash
# Start the ML inference service. Run from apps/ml-service/.
set -e

if [ ! -d ".venv" ]; then
  echo "Virtual environment not found. Run ./setup.sh first."
  exit 1
fi

source .venv/bin/activate

# Intel Mac: use all 8 cores for PyTorch CPU inference
export OMP_NUM_THREADS=8
export MKL_NUM_THREADS=8

echo "Starting ML service on http://localhost:8001"
echo "First request will load Sybil model weights into memory (~30s)."
echo "Press Ctrl+C to stop."
echo ""

uvicorn main:app --host 0.0.0.0 --port 8001 --log-level info
