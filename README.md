# 🎮 Connect4 AI — Puissance 4 avec CNN AlphaZero & Minimax

> Une IA complète pour le jeu Puissance 4 (variante 9x9), combinant un moteur **Minimax avec élagage alpha-bêta** hautement optimisé et un **réseau de neurones convolutif (CNN) inspiré d'AlphaZero** de DeepMind. Application web déployée en production.

🌐 **[Jouer en ligne](https://connect4-site-1.onrender.com)** — *Disponible 24/7 sur Render*

📄 *Projet académique noté **18/20** en Licence 3 Informatique — Université Paris-Saclay*

---

## 🎯 Objectif du projet

Construire une IA réellement compétitive pour le Puissance 4 (variante 9x9) en explorant deux paradigmes fondamentaux de l'IA de jeu — la **recherche arborescente classique** et l'**apprentissage profond** — puis les rendre accessibles à tous via une application web déployée en production.

---

## 🏗️ Architecture

Le projet se compose de **4 modules complémentaires** qui couvrent une chaîne data complète, de la collecte à la mise en production :

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. SCRAPING    │ ──▶ │  2. ENTRAÎNEMENT │ ──▶ │  3. INFÉRENCE    │
│  Selenium       │     │  CNN AlphaZero   │     │  Minimax + CNN   │
│  BoardGameArena │     │  (PyTorch / GPU) │     │                  │
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                          ▼
                                                 ┌──────────────────┐
                                                 │  4. APPLICATION  │
                                                 │  Flask + Render  │
                                                 └──────────────────┘
```

---

## 🧠 1. Moteur Minimax optimisé

Implémentation d'un Minimax hautement optimisé permettant d'analyser jusqu'à **profondeur 20** en quelques secondes :

- **Élagage alpha-bêta** pour réduire l'arbre de recherche
- **Iterative deepening** : approfondissement progressif
- **Table de transposition** avec hashing **Zobrist 64 bits** pour mémoïser les positions déjà évaluées
- **Détection de doubles menaces (forks)** via heuristique personnalisée
- **Tri intelligent des coups** pour maximiser l'efficacité de l'élagage
- Capable d'indiquer si une position est **gagnante, perdante ou nulle**, avec le nombre exact de coups jusqu'au mat

---

## 🤖 2. Réseau de neurones CNN AlphaZero

Architecture inspirée du modèle AlphaZero de DeepMind :

| Caractéristique | Valeur |
|---|---|
| Type d'architecture | ResNet à 10 blocs résiduels |
| Canaux | 128 |
| Paramètres | ~1.5M |
| Têtes de sortie | Policy + Value |
| Données d'entraînement | 11 millions de positions |
| GPU utilisé | Tesla T4 (Kaggle) |
| Data augmentation | Symétrie horizontale |
| Pondération | Par qualité des parties |

- **Policy head** : prédit la probabilité de chaque coup possible
- **Value head** : estime la probabilité de victoire à partir de la position

---

## 🕸️ 3. Pipeline de collecte de données

Pour entraîner le CNN, j'ai construit un pipeline complet de collecte de parties :

- **Bot Selenium** automatisé pour scraper la plateforme **BoardGameArena**
- **Multi-comptes parallèles** via multiprocessing (plusieurs sessions simultanées)
- **Générateur Minimax-vs-Minimax** pour produire des parties supplémentaires
- **Stockage PostgreSQL** hébergé sur Render
- **Volume collecté** : plus de **32 000 parties** → **11M de positions** d'entraînement après transformation

---

## 🌐 4. Application web

Site Flask déployé en production sur Render permettant à tous de jouer contre l'IA :

- 🎮 **Mode 1 joueur** : humain vs IA, plusieurs niveaux de difficulté
- 🤖 **Mode IA vs IA** : observe deux versions de l'IA s'affronter
- 🔍 **Mode Analyse** : résout n'importe quelle position et indique le résultat optimal
- 📜 **Historique** des parties jouées
- ⚙️ Choix du **niveau de difficulté** et de la **vitesse d'affichage**
- 🔄 **Multi-sessions** simultanées

---

## 🛠️ Stack technique

**Intelligence artificielle**
- Python, PyTorch, NumPy

**Backend**
- Flask, PostgreSQL

**Data engineering**
- Selenium, Multiprocessing

**DevOps**
- Docker, Kaggle GPU (Tesla T4), Render

**Frontend**
- JavaScript, HTML/CSS

---

## 🚀 Lancement en local

```bash
# Cloner le repo
git clone https://github.com/HICHAMBOUMZGOU123/connect4-ai.git
cd connect4-ai

# Installer les dépendances
pip install -r requirements.txt

# Initialiser la base de données
python init_db.py

# Lancer l'application Flask
python app.py
```

L'application sera accessible sur **http://localhost:5000**

---

## 📚 Compétences mises en pratique

- **Recherche arborescente** (Minimax, alpha-beta pruning, iterative deepening)
- **Deep learning appliqué aux jeux** (architectures de type AlphaZero)
- **Optimisation algorithmique** (Zobrist hashing, mémoïsation)
- **Web scraping à grande échelle** (Selenium multi-sessions)
- **Entraînement distribué sur GPU** (PyTorch sur Tesla T4)
- **Bases de données relationnelles** (PostgreSQL sur Render)
- **Déploiement web en production** (Flask + Render + Gunicorn multi-workers)

---

## 👤 Auteur

**Hicham BOUMZGOU**
Étudiant en Licence 3 Informatique — Université Paris-Saclay
🎯 En recherche d'alternance Data Engineering / Data Science (M1 ISD — Sept. 2026)

📧 [hicham5boumzgou@gmail.com](mailto:hicham5boumzgou@gmail.com)
💼 [LinkedIn](https://www.linkedin.com/in/hicham-boumzgou-892a32333/)
🌐 [Portfolio](https://hichamboumzgou123.github.io)

---

⭐ Si ce projet vous a intéressé, n'hésitez pas à mettre une étoile au repo !
