# Supply Chain Industrielle

Application de gestion de la chaîne d'approvisionnement industrielle.

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | NestJS 10 + TypeScript |
| ORM | TypeORM 0.3 |
| Base de données | PostgreSQL 15 |
| Cache / Jobs | Redis |
| Stockage fichiers | MinIO |
| Frontend | React 18 + Vite 5 + TypeScript |
| State management | Zustand + React Query |
| Validation | Zod + React Hook Form |

## Structure du monorepo

```
supply-chain/
├── package.json              ← root workspace + scripts partagés
├── tsconfig.base.json        ← TypeScript config partagée
├── .eslintrc.js              ← ESLint config partagée
├── .prettierrc               ← Prettier config partagée
├── .gitignore
└── apps/
    ├── backend/              ← NestJS API
    │   ├── src/
    │   │   ├── main.ts       ← Entry point + Swagger
    │   │   ├── app.module.ts ← Module racine + TypeORM
    │   │   ├── app.controller.ts
    │   │   └── app.service.ts
    │   ├── .env.example      ← Variables d'environnement (copier en .env)
    │   ├── nest-cli.json
    │   ├── tsconfig.json
    │   └── package.json
    └── frontend/             ← React + Vite SPA
        ├── src/
        │   ├── main.tsx      ← Entry point + providers
        │   ├── App.tsx       ← Router racine
        │   └── index.css     ← Styles globaux
        ├── index.html
        ├── vite.config.ts    ← Proxy /api → backend :3000
        ├── tsconfig.json
        └── package.json
```

## Prérequis

- Node.js >= 20
- npm >= 10
- Docker + Docker Compose (pour PostgreSQL, Redis, MinIO)

## Installation

```bash
# 1. Cloner le projet
git clone <repo-url>
cd supply-chain

# 2. Installer toutes les dépendances (root + workspaces)
npm install

# 3. Configurer les variables d'environnement du backend
cp apps/backend/.env.example apps/backend/.env
# Éditer apps/backend/.env selon votre configuration

# 4. Démarrer l'infrastructure (PostgreSQL + Redis + MinIO)
# (voir US-001 — Docker Compose)
docker-compose up -d

# 5. Lancer les deux apps en développement
npm run dev
```

## Développement

```bash
# Les deux apps en parallèle
npm run dev

# Backend seul (port 3000)
npm run dev:backend

# Frontend seul (port 5173)
npm run dev:frontend

# Linter sur tout le monorepo
npm run lint

# Formatter
npm run format
```

## URLs de développement

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| MinIO Console | http://localhost:9001 |

## Sprints et progression

- [x] **Sprint 0** — Monorepo, Docker, DDL PostgreSQL, TypeORM entities
- [ ] **Sprint 1** — Auth JWT + RBAC + M1 Référentiels
- [ ] **Sprint 2** — M2 Stocks (mouvements, lots, alertes)
- [ ] **Sprint 3** — M3 Achats (commandes, réceptions)
- [ ] **Sprint 4** — M4 Production (OF, gammes, nomenclatures)
- [ ] **Sprint 5** — M5 Qualité (contrôles, NC)
- [ ] **Sprint 6** — M6 Expéditions (BL, traçabilité)
- [ ] **Sprint 7** — M8 Reporting (KPIs, dashboards)
