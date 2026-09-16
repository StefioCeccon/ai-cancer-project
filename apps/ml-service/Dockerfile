# syntax=docker/dockerfile:1
# Optional Sybil / ML service. Large image (PyTorch). Build from repo root:
#   docker build -f apps/ml-service/Dockerfile -t ai-cancer-project-ml .

FROM python:3.10-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY apps/ml-service/requirements.txt apps/ml-service/constraints-sybil.txt ./

# CPU torch first, then the rest of the stack.
RUN pip install --no-cache-dir \
      torch torchvision --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements.txt \
  && pip install --no-cache-dir --no-deps \
      "git+https://github.com/reginabarzilaygroup/Sybil.git"

COPY apps/ml-service/*.py ./

ENV OMP_NUM_THREADS=4
ENV MKL_NUM_THREADS=4
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
