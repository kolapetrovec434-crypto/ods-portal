import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { logAction } from '../middlewares/auth.middleware';

const genAccessToken  = (userId: string) =>
  jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });

const genRefreshToken = (userId: string) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  const { discordId, password } = req.body;
  if (!discordId || !password) return res.status(400).json({ error: 'Заповніть всі поля' });

  const user = await prisma.user.findUnique({
    where: { discordId },
    include: { role: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Невірний Discord ID або пароль' });

  if (user.isBanned)
    return res.status(403).json({ error: 'Акаунт заблоковано', reason: user.banReason });

  const accessToken  = genAccessToken(user.id);
  const refreshToken = genRefreshToken(user.id);

  // Persist refresh token in DB
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
  await logAction(user.id, 'USER_LOGIN', { discordId }, req.ip);

  const { passwordHash: _, ...safeUser } = user;
  res.json({ accessToken, user: safeUser });
};

// POST /api/auth/refresh
export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Немає токена' });

  try {
    const { userId } = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const stored = await prisma.refreshToken.findFirst({ where: { token, userId } });
    if (!stored || stored.expiresAt < new Date())
      return res.status(401).json({ error: 'Токен прострочено або відкликано' });

    // Rotate token
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const newRefresh = genRefreshToken(userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: newRefresh, userId, expiresAt } });

    res.cookie('refreshToken', newRefresh, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ accessToken: genAccessToken(userId) });
  } catch {
    res.status(401).json({ error: 'Недійсний токен' });
  }
};

// POST /api/auth/logout
export const logout = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
  res.clearCookie('refreshToken', COOKIE_OPTS);
  res.json({ message: 'Вихід виконано' });
};
