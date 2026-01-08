## Build do frontend (Vite)
FROM node:20-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

## Runtime do backend (Flask) + serve dist
FROM python:3.11-slim AS runtime
WORKDIR /app

# Dependências mínimas para matplotlib/numpy/pandas em ambiente slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libfreetype6 \
    libpng16-16 \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Código do backend + assets
COPY . .

# Copia o build do frontend para /app/dist
COPY --from=web-build /app/dist ./dist

ENV PYTHONUNBUFFERED=1

# Railway expõe a porta em $PORT
CMD ["sh", "-lc", "gunicorn -b 0.0.0.0:${PORT:-8000} servidor_proposta:app"]


