// point.routes.ts
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';
import { givePoints, takePoints, getHistory, getLeaderboard } from '../controllers/point.controller';
const pointRouter = Router();
pointRouter.use(requireAuth);
pointRouter.post('/give',         requirePermission('canGivePoints'), givePoints);
pointRouter.post('/take',         requirePermission('canTakePoints'), takePoints);
pointRouter.get('/history/:userId',                                   getHistory);
pointRouter.get('/leaderboard',                                       getLeaderboard);
export { pointRouter };
