# NeoCortex AI

NeoCortex AI est une application avancée de système multi-agents conçue pour exécuter des tâches complexes en utilisant une équipe d'agents spécialisés. Ce projet combine un backend Python basé sur Flask et un frontend React avec Vite.

## Fonctionnalités principales

- **Système multi-agents** : Coordination et exécution de tâches via des agents spécialisés (recherche, analyse, création, critique, etc.).
- **Modèle Llama** : Intégration avec des modèles de langage avancés pour la génération de contenu et l'analyse.
- **Gestion de mémoire** : Stockage et récupération d'informations pertinentes pour améliorer les performances des agents.
- **Interface utilisateur moderne** : Frontend interactif construit avec React et Vite.

## Structure du projet

```
NeoCortex AI
├── api/                # Backend Flask
├── config/             # Fichiers de configuration
├── data/               # Données persistantes (sessions, tâches, etc.)
├── frontend/           # Frontend React avec Vite
├── modules/            # Modules Python pour les agents et les intégrations
├── tests/              # Tests unitaires
├── Dockerfile          # Fichier Docker pour le déploiement
├── requirements.txt    # Dépendances Python
└── README.md           # Documentation du projet
```

## Prérequis

- **Python** : Version 3.12 ou supérieure
- **Node.js** : Version 16 ou supérieure
- **Git** : Pour le contrôle de version
- **Docker** (optionnel) : Pour exécuter l'application dans un conteneur

## Installation et Exécution

### Installation locale

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/ziryge/Cortex.git
   cd Cortex
   ```

2. Installez les dépendances Python :
   ```bash
   pip install -r requirements.txt
   ```

3. Installez les dépendances Node.js pour le frontend :
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Exécution de l'application

#### Méthode 1 : Exécution complète (recommandée)

Cette méthode construit le frontend et démarre le serveur backend qui sert automatiquement les fichiers du frontend.

1. Construisez le frontend :
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. Lancez le serveur backend :
   ```bash
   python api/app.py
   ```

3. Accédez à l'application via votre navigateur à l'adresse : `http://localhost:5000`

#### Méthode 2 : Mode développement (serveurs séparés)

Cette méthode lance le serveur de développement frontend et le backend séparément, utile pour le développement.

1. Terminal 1 - Lancez le serveur backend :
   ```bash
   python api/app.py
   ```

2. Terminal 2 - Lancez le serveur de développement frontend :
   ```bash
   cd frontend
   npm run dev
   ```

3. Accédez à l'application via votre navigateur à l'adresse affichée dans le terminal du frontend (généralement `http://localhost:5173`)

### Exécution dans GitHub Codespaces

Si vous utilisez GitHub Codespaces, suivez ces étapes supplémentaires :

1. Construisez le frontend :
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. Lancez le serveur backend :
   ```bash
   python api/app.py
   ```

3. Dans l'onglet "Ports" de votre Codespace, recherchez le port 5000. Cliquez sur l'icône du globe à côté de ce port pour ouvrir l'application dans un nouvel onglet.

4. Si le port est configuré en "privé", changez sa visibilité en "public" pour y accéder :
   ```bash
   gh codespace ports visibility 5000:public
   ```

## Utilisation

Une fois l'application lancée, vous pouvez :

- Utiliser le **Chat** pour interagir directement avec NeoCortex AI
- Explorer le **Tableau de bord** pour obtenir des statistiques et des informations sur le système
- Créer et gérer des **Tâches** pour des besoins spécifiques
- Utiliser le **Système Multi-Agents** pour résoudre des problèmes complexes avec des agents spécialisés

## Dépannage

Si vous rencontrez des difficultés à vous connecter à l'application :

1. Vérifiez que le serveur backend est bien en cours d'exécution
2. Examinez les journaux du serveur pour détecter d'éventuelles erreurs
3. Assurez-vous que votre connexion réseau fonctionne correctement
4. Si vous utilisez Docker, vérifiez que le conteneur est en cours d'exécution avec `docker ps`
5. Dans un environnement Codespaces, assurez-vous que le port 5000 est configuré en "public"
