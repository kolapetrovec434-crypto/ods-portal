import { Router } from 'express';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
const r = Router();
r.use(requireAuth);
r.get('/', async (_, res) => {
  const roles = await prisma.role.findMany({ orderBy: { priority: 'desc' } });
  res.json(roles);
});
r.post('/', requirePermission('canManageRoles'), async (req, res) => {
  const role = await prisma.role.create({ data: req.body });
  res.status(201).json(role);
});
r.patch('/:id', requirePermission('canManageRoles'), async (req, res) => {
  const role = await prisma.role.update({ where: { id: req.params.id }, data: req.body });
  res.json(role);
});
r.delete('/:id', requirePermission('canManageRoles'), async (req, res) => {
  await prisma.role.delete({ where: { id: req.params.id } });
  res.json({ message: 'Роль видалено' });
});
export default r;
