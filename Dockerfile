# Étape 1: Construction du frontend
FROM node:18 AS frontend-builder

WORKDIR /app/frontend

# Copier les fichiers package.json et installer les dépendances
COPY frontend/package*.json ./
RUN npm install

# Copier le reste des fichiers du frontend et construire l'application
COPY frontend/ ./
RUN npm run build

# Étape 2: Image Python pour le backend
FROM python:3.9-slim

WORKDIR /app

# Installation de dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install the latest SQLite version
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 libsqlite3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration
COPY requirements.txt .
COPY .env .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier les modules et l'API
COPY modules/ ./modules/
COPY api/ ./api/
COPY tests/ ./tests/

# Créer les dossiers nécessaires
RUN mkdir -p data/tasks data/memories data/sessions config

# Copier le frontend construit depuis l'étape précédente
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Exposition des ports
EXPOSE 5000

# Commande par défaut pour démarrer l'application
CMD ["python", "-m", "api.app"]