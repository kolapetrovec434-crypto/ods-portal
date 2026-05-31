import { Router } from 'express';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import {
  getUsers, getUser, createUser, updateUser,
  banUser, unbanUser, warnUser, reprimandUser, useInventoryItem,
} from '../controllers/user.controller';

const r = Router();
r.use(requireAuth);

r.get('/',                                                     getUsers);
r.get('/:id',                                                  getUser);
r.post('/',           requirePermission('canManageRoles'),     createUser);
r.patch('/:id',                                                updateUser);
r.post('/:id/ban',    requirePermission('canBan'),             banUser);
r.post('/:id/unban',  requirePermission('canUnban'),           unbanUser);
r.post('/:id/warn',   requirePermission('canWarn'),            warnUser);
r.post('/:id/reprimand', requirePermission('canReprimand'),    reprimandUser);
r.post('/:id/inventory/:itemId/use',                           useInventoryItem);

export default r;
