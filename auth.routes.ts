// ── auth.routes.ts ──────────────────────────────────────────────────────────
import { Router } from 'express';
import { login, refresh, logout } from '../controllers/auth.controller';
export default Object.assign(Router(), {
  routes: [
    ['post', '/login',   login],
    ['post', '/refresh', refresh],
    ['post', '/logout',  logout],
  ],
}).post('/login', login).post('/refresh', refresh).post('/logout', logout);
