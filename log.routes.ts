import { Router } from 'express';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
const r = Router();
r.use(requireAuth);
r.get('/', requirePermission('canViewStats'), async (req, res) => {
  const { userId, action, page = '1', limit = '50' } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  const logs = await prisma.systemLog.findMany({
    where, skip, take: parseInt(limit),
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, avatar: true } } },
  });
  res.json(logs);
});
export default r;
