import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAction } from '../middlewares/auth.middleware';

// POST /api/points/give
export const givePoints = async (req: Request, res: Response) => {
  const { receiverId, amount, reason } = req.body;
  if (!receiverId || !amount || amount <= 0)
    return res.status(400).json({ error: 'Некоректні дані' });

  const [log, user] = await prisma.$transaction([
    prisma.pointLog.create({
      data: { amount, reason, issuerId: req.user.id, receiverId },
    }),
    prisma.user.update({
      where: { id: receiverId },
      data: { points: { increment: amount } },
    }),
  ]);

  await logAction(req.user.id, 'POINTS_GIVEN', { receiverId, amount, reason }, req.ip);
  res.json({ message: `+${amount} балів видано`, newBalance: user.points });
};

// POST /api/points/take
export const takePoints = async (req: Request, res: Response) => {
  const { receiverId, amount, reason } = req.body;
  if (!receiverId || !amount || amount <= 0)
    return res.status(400).json({ error: 'Некоректні дані' });

  const target = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
  if (target.points < amount)
    return res.status(400).json({ error: 'Недостатньо балів у користувача' });

  const [log, user] = await prisma.$transaction([
    prisma.pointLog.create({
      data: { amount: -amount, reason, issuerId: req.user.id, receiverId },
    }),
    prisma.user.update({
      where: { id: receiverId },
      data: { points: { decrement: amount } },
    }),
  ]);

  await logAction(req.user.id, 'POINTS_TAKEN', { receiverId, amount, reason }, req.ip);
  res.json({ message: `-${amount} балів знято`, newBalance: user.points });
};

// GET /api/points/history/:userId
export const getHistory = async (req: Request, res: Response) => {
  const { page = '1', limit = '30' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const logs = await prisma.pointLog.findMany({
    where: { receiverId: req.params.userId },
    skip, take: parseInt(limit),
    orderBy: { createdAt: 'desc' },
    include: { issuer: { select: { username: true, avatar: true } } },
  });

  res.json(logs);
};

// GET /api/points/leaderboard
export const getLeaderboard = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { isBanned: false },
    orderBy: { points: 'desc' },
    take: 50,
    select: { id: true, username: true, avatar: true, points: true, level: true, role: { select: { name: true, color: true } } },
  });
  res.json(users);
};
