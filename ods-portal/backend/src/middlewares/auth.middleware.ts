import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { Role, User } from '@prisma/client';

type UserWithRole = User & { role: Role | null };

declare global {
  namespace Express {
    interface Request { user: UserWithRole; }
  }
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token =
    req.cookies?.accessToken ||
    req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Не авторизовано' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user)         return res.status(401).json({ error: 'Користувача не знайдено' });
    if (user.isBanned) return res.status(403).json({ error: 'Акаунт заблоковано', reason: user.banReason });

    req.user = user as UserWithRole;
    next();
  } catch {
    res.status(401).json({ error: 'Токен недійсний або прострочений' });
  }
};

// ─── requirePermission (RBAC) ─────────────────────────────────────────────────
export const requirePermission = (permission: keyof Role) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role)                return res.status(403).json({ error: 'Роль не призначено' });
    if (role.isOwner)         return next();            // Owner bypasses all checks
    if (!role[permission])    return res.status(403).json({ error: `Недостатньо прав: ${permission}` });
    next();
  };
};

// ─── logAction helper ─────────────────────────────────────────────────────────
export const logAction = async (
  userId: string,
  action: string,
  details?: object,
  ipAddress?: string,
) => {
  await prisma.systemLog.create({ data: { userId, action, details, ipAddress } });
};
