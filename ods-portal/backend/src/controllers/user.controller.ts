import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { logAction } from '../middlewares/auth.middleware';

// GET /api/users
export const getUsers = async (req: Request, res: Response) => {
  const { search, roleId, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (search) where.username = { contains: search, mode: 'insensitive' };
  if (roleId) where.roleId = roleId;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: parseInt(limit),
      include: { role: true, tags: true },
      orderBy: { points: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const safe = users.map(({ passwordHash: _, ...u }) => u);
  res.json({ users: safe, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
};

// GET /api/users/:id
export const getUser = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      role: true, tags: true,
      inventory: { include: { reward: true } },
      pointsHistoryReceived: { take: 20, orderBy: { createdAt: 'desc' }, include: { issuer: { select: { username: true } } } },
    },
  });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  const { passwordHash: _, ...safe } = user;
  res.json(safe);
};

// POST /api/users  (create / register)
export const createUser = async (req: Request, res: Response) => {
  const { discordId, username, password, roleId } = req.body;
  if (!discordId || !username || !password)
    return res.status(400).json({ error: 'Заповніть усі обов\'язкові поля' });

  const exists = await prisma.user.findUnique({ where: { discordId } });
  if (exists) return res.status(409).json({ error: 'Користувач уже існує' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { discordId, username, passwordHash, roleId },
    include: { role: true },
  });

  await logAction(req.user.id, 'USER_CREATED', { targetId: user.id, username }, req.ip);
  const { passwordHash: _, ...safe } = user;
  res.status(201).json(safe);
};

// PATCH /api/users/:id
export const updateUser = async (req: Request, res: Response) => {
  const { bio, avatar, profileColor, banner, socialLinks, roleId, tagIds } = req.body;
  const isOwn = req.user.id === req.params.id;
  const canManage = req.user.role?.isOwner || req.user.role?.canManageRoles;

  if (!isOwn && !canManage) return res.status(403).json({ error: 'Недостатньо прав' });

  const data: any = {};
  if (bio !== undefined)          data.bio = bio;
  if (avatar !== undefined)       data.avatar = avatar;
  if (profileColor !== undefined) data.profileColor = profileColor;
  if (banner !== undefined)       data.banner = banner;
  if (socialLinks !== undefined)  data.socialLinks = socialLinks;
  if (roleId !== undefined && canManage) data.roleId = roleId;
  if (tagIds !== undefined && canManage) data.tags = { set: tagIds.map((id: string) => ({ id })) };

  const user = await prisma.user.update({
    where: { id: req.params.id }, data,
    include: { role: true, tags: true },
  });

  await logAction(req.user.id, 'USER_UPDATED', { targetId: req.params.id }, req.ip);
  const { passwordHash: _, ...safe } = user;
  res.json(safe);
};

// POST /api/users/:id/ban
export const banUser = async (req: Request, res: Response) => {
  const { reason, expiresAt } = req.body;
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Не можна забанити себе' });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: true, banReason: reason, banExpiresAt: expiresAt ? new Date(expiresAt) : null },
  });

  await logAction(req.user.id, 'USER_BANNED', { targetId: req.params.id, reason }, req.ip);
  res.json({ message: 'Користувача заблоковано', userId: user.id });
};

// POST /api/users/:id/unban
export const unbanUser = async (req: Request, res: Response) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: false, banReason: null, banExpiresAt: null },
  });
  await logAction(req.user.id, 'USER_UNBANNED', { targetId: req.params.id }, req.ip);
  res.json({ message: 'Блокування знято' });
};

// POST /api/users/:id/warn
export const warnUser = async (req: Request, res: Response) => {
  const { reason } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { warningsCount: { increment: 1 } },
  });
  await logAction(req.user.id, 'USER_WARNED', { targetId: req.params.id, reason }, req.ip);
  res.json({ message: 'Попередження видано', warnings: user.warningsCount });
};

// POST /api/users/:id/reprimand
export const reprimandUser = async (req: Request, res: Response) => {
  const { reason } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { reprimandsCount: { increment: 1 } },
  });
  await logAction(req.user.id, 'USER_REPRIMANDED', { targetId: req.params.id, reason }, req.ip);
  res.json({ message: 'Догану оголошено', reprimands: user.reprimandsCount });
};

// POST /api/users/:id/inventory/:itemId/use
export const useInventoryItem = async (req: Request, res: Response) => {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: req.params.itemId, userId: req.params.id, isUsed: false },
    include: { reward: true },
  });
  if (!item) return res.status(404).json({ error: 'Предмет не знайдено або вже використано' });

  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { isUsed: true, usedAt: new Date() },
  });

  // Apply reward effect
  if (item.reward.type === 'REMOVE_WARN') {
    await prisma.user.update({ where: { id: req.params.id }, data: { warningsCount: { decrement: 1 } } });
  } else if (item.reward.type === 'BONUS_POINTS') {
    await prisma.user.update({ where: { id: req.params.id }, data: { points: { increment: item.reward.value } } });
  }

  await logAction(req.user.id, 'REWARD_USED', { itemId: item.id, rewardType: item.reward.type }, req.ip);
  res.json({ message: 'Нагороду активовано', reward: item.reward });
};
