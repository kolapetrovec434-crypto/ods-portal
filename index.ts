import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes    from './routes/auth.routes';
import userRoutes    from './routes/user.routes';
import roleRoutes    from './routes/role.routes';
import pointRoutes   from './routes/point.routes';
import modpassRoutes from './routes/modpass.routes';
import logRoutes     from './routes/log.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/roles',   roleRoutes);
app.use('/api/points',  pointRoutes);
app.use('/api/modpass', modpassRoutes);
app.use('/api/logs',    logRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Внутрішня помилка сервера' });
});

app.listen(PORT, () => console.log(`✅ ODS Portal backend running on port ${PORT}`));
export default app;
