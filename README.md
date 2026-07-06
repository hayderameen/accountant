# Accountant

Personal finance app — React (Vite) + Express + MongoDB.

## Run locally

1. Copy env and set your MongoDB URI + JWT secret:

```bash
cp server/.env.example server/.env
```

2. Install and start both apps:

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000

## Stack

- `client/` — React + Vite + Tailwind + React Router
- `server/` — Express + Mongoose + JWT (httpOnly cookie, `userId` in token `sub`)
