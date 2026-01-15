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

# Instalar dependências básicas primeiro
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    fonts-dejavu-core \
    fonts-liberation \
    wget \
  && rm -rf /var/lib/apt/lists/*

# Instalar Node.js (para rodar Puppeteer)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Instalar Chromium e suas dependências
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Instalar dependências do renderer (puppeteer-core) de forma isolada
COPY pdf_renderer/package.json /app/pdf_renderer/package.json
WORKDIR /app/pdf_renderer
RUN npm install --omit=dev --no-audit --no-fund
WORKDIR /app

# Código do backend + assets
COPY . .

# Copia o build do frontend para /app/dist
COPY --from=web-build /app/dist ./dist

ENV PYTHONUNBUFFERED=1
ENV CHROMIUM_PATH=/usr/bin/chromium

# Railway expõe a porta em $PORT
# Timeout de 120s e workers baseados em CPU, preload para carregar app antes de fork
CMD ["sh", "-lc", "gunicorn -b 0.0.0.0:${PORT:-8000} --timeout 120 --workers 2 --preload --access-logfile - --error-logfile - servidor_proposta:app"]


