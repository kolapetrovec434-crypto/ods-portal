import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAction } from '../middlewares/auth.middleware';

// GET /api/modpass/active
export const getActiveSeason = async (req: Request, res: Response) => {
  const season = await prisma.modPassSeason.findFirst({
    where: { isActive: true },
    include: {
      levels: { include: { rewards: true }, orderBy: { levelNumber: 'asc' } },
      tasks: {
        include: {
          userTasks: { where: { userId: req.user.id } },
        },
      },
    },
  });
  if (!season) return res.status(404).json({ error: 'Активного сезону немає' });
  res.json(season);
};

// POST /api/modpass/seasons  (admin)
export const createSeason = async (req: Request, res: Response) => {
  const { name, startsAt, endsAt } = req.body;

  // Deactivate current season if exists
  await prisma.modPassSeason.updateMany({ where: { isActive: true }, data: { isActive: false } });

  const season = await prisma.modPassSeason.create({
    data: { name, isActive: true, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  });

  await logAction(req.user.id, 'MODPASS_SEASON_CREATED', { seasonId: season.id, name }, req.ip);
  res.status(201).json(season);
};

// POST /api/modpass/seasons/:id/levels  (admin)
export const addLevel = async (req: Request, res: Response) => {
  const { levelNumber, requiredXp, rewards } = req.body;

  const level = await prisma.modPassLevel.create({
    data: {
      seasonId: req.params.id,
      levelNumber,
      requiredXp,
      rewards: {
        create: rewards.map((r: any) => ({
          name: r.name, type: r.type, value: r.value, icon: r.icon,
        })),
      },
    },
    include: { rewards: true },
  });

  res.status(201).json(level);
};

// POST /api/modpass/xp/add  — add XP to current user
export const addXp = async (req: Request, res: Response) => {
  const { amount, source } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Некоректне значення XP' });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { xp: { increment: amount } },
  });

  // Check for level-up (simple: every 1000 XP = 1 level)
  const newLevel = Math.floor(user.xp / 1000) + 1;
  if (newLevel > user.level) {
    await prisma.user.update({ where: { id: user.id }, data: { level: newLevel } });
    // Grant rewards for level
    const season = await prisma.modPassSeason.findFirst({ where: { isActive: true } });
    if (season) {
      const level = await prisma.modPassLevel.findFirst({
        where: { seasonId: season.id, levelNumber: newLevel },
        include: { rewards: true },
      });
      if (level?.rewards.length) {
        await prisma.inventoryItem.createMany({
          data: level.rewards.map(r => ({ userId: user.id, rewardId: r.id })),
        });
        await logAction(req.user.id, 'LEVEL_UP', { newLevel, rewards: level.rewards.map(r => r.name) }, req.ip);
      }
    }
  }

  res.json({ xp: user.xp, level: newLevel, leveled: newLevel > user.level });
};

// GET /api/modpass/tasks/progress
export const getTaskProgress = async (req: Request, res: Response) => {
  const season = await prisma.modPassSeason.findFirst({ where: { isActive: true } });
  if (!season) return res.json([]);

  const tasks = await prisma.task.findMany({
    where: { seasonId: season.id },
    include: { userTasks: { where: { userId: req.user.id } } },
  });
  res.json(tasks);
};

// POST /api/modpass/tasks/:id/progress  — increment task progress
export const updateTaskProgress = async (req: Request, res: Response) => {
  const { increment = 1 } = req.body;
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });

  const userTask = await prisma.userTask.upsert({
    where: { userId_taskId: { userId: req.user.id, taskId: task.id } },
    create: { userId: req.user.id, taskId: task.id, progress: increment },
    update: { progress: { increment } },
  });

  if (!userTask.isDone && userTask.progress >= task.target) {
    await prisma.userTask.update({
      where: { id: userTask.id },
      data: { isDone: true, doneAt: new Date() },
    });
    // Grant XP reward
    await prisma.user.update({
      where: { id: req.user.id },
      data: { xp: { increment: task.rewardXp } },
    });
    await logAction(req.user.id, 'TASK_COMPLETED', { taskId: task.id, xpGained: task.rewardXp }, req.ip);
    return res.json({ done: true, xpGained: task.rewardXp });
  }

  res.json({ done: false, progress: userTask.progress, target: task.target });
};
