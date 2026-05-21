FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Python settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY requirements.txt .

# Remove unsupported/private packages if needed
RUN sed -i '/^jq[>=]/d; /^emergentintegrations==/d' requirements.txt \
 && pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . .

# Dynamic hosting port
ENV PORT=8001

# Expose application port
EXPOSE 8001

# Start FastAPI production server
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 2"]