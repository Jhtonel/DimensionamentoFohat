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

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fonts-dejavu-core \
    # Puppeteer/Chromium (PDF idêntico ao template)
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatk1.0-0 \
    libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*

# Node.js (para rodar Puppeteer)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

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
CMD ["sh", "-lc", "gunicorn -b 0.0.0.0:${PORT:-8000} servidor_proposta:app"]


