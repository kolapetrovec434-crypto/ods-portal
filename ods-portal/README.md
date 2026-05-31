# ODS Portal — Moderation Portal 2026

Повноцінний портал команди модерації з Moderation Pass, кастомним RBAC, інвентарем та Glassmorphism-дизайном.

## Стек
| Шар | Технологія |
|-----|-----------|
| Frontend | Next.js 15, Tailwind CSS, Framer Motion, Zustand |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| БД | PostgreSQL 16 |
| Auth | JWT (15m) + Refresh Token (7d, httpOnly cookie) |
| Розгортання | Docker Compose |

---

## 🚀 Швидкий старт (Docker — 1 команда)

```bash
# 1. Клонуй та перейди в папку
git clone <repo> && cd ods-portal

# 2. Запусти всі сервіси
docker-compose up --build

# Портал: http://localhost:3000
# API:     http://localhost:3001
# Admin:   discordId=000000000000000001  password=admin123
```

---

## 🛠 Локальний розвиток (без Docker)

### Backend
```bash
cd backend

# 1. Встанови залежності
npm install

# 2. Скопіюй .env
cp .env.example .env
# Відредагуй DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Ініціалізуй БД
npx prisma db push
npx ts-node prisma/seed.ts

# 4. Запуск (з hot-reload)
npm run dev
```

### Frontend
```bash
cd frontend

# 1. Встанови залежності
npm install

# 2. Env
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local

# 3. Запуск
npm run dev
```

---

## 📁 Структура проєкту

```
ods-portal/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Схема БД (усі моделі)
│   │   └── seed.ts           # Початкові дані
│   └── src/
│       ├── controllers/      # auth, user, point, modpass
│       ├── middlewares/      # requireAuth, requirePermission (RBAC)
│       ├── routes/           # Express маршрути
│       └── index.ts
└── frontend/
    └── src/
        ├── lib/
        │   ├── api.ts        # Axios + silent token refresh
        │   └── auth.store.ts # Zustand auth стан
        └── app/              # Next.js App Router сторінки
```

---

## 🔐 RBAC — Ролі та дозволи

| Дозвіл | Молодший мод | Модератор | Головний мод | Власник |
|--------|:---:|:---:|:---:|:---:|
| Видавати бали | ✓ | ✓ | ✓ | ✓ |
| Знімати бали  | — | — | ✓ | ✓ |
| Попереджати   | — | ✓ | ✓ | ✓ |
| Банити        | — | — | ✓ | ✓ |
| Керувати ролями | — | — | — | ✓ |
| Mod Pass адмін | — | — | — | ✓ |

---

## 🎮 Mod Pass API

```
GET  /api/modpass/active              — Поточний сезон + рівні + завдання
GET  /api/modpass/tasks/progress      — Прогрес завдань для поточного юзера
POST /api/modpass/xp/add              — Додати XP (автолевелап + нагороди)
POST /api/modpass/tasks/:id/progress  — Оновити прогрес завдання
POST /api/modpass/seasons             — Створити сезон (canManageModPass)
POST /api/modpass/seasons/:id/levels  — Додати рівень із нагородами
```

---

## 📡 Повне API

```
POST /api/auth/login      — Вхід
POST /api/auth/refresh    — Оновлення токена (silent)
POST /api/auth/logout     — Вихід

GET/POST        /api/users           — Список / Створити
GET/PATCH       /api/users/:id       — Профіль / Редагувати
POST            /api/users/:id/ban   — Бан (canBan)
POST            /api/users/:id/unban — Розбан (canUnban)
POST            /api/users/:id/warn  — Попередження (canWarn)
POST            /api/users/:id/reprimand — Догана (canReprimand)
POST            /api/users/:id/inventory/:itemId/use — Активувати нагороду

POST /api/points/give              — Видати бали (canGivePoints)
POST /api/points/take              — Зняти бали (canTakePoints)
GET  /api/points/history/:userId   — Історія балів
GET  /api/points/leaderboard       — Топ-50

GET/POST  /api/roles               — Ролі
PATCH/DELETE /api/roles/:id        — Редагувати роль

GET  /api/logs                     — Журнал дій (canViewStats)
```

---

## 🔑 Змінні середовища

```env
# backend/.env
DATABASE_URL="postgresql://user:pass@localhost:5432/ods_portal"
JWT_SECRET="your-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# frontend/.env.local
NEXT_PUBLIC_API_URL="http://localhost:3001"
```
