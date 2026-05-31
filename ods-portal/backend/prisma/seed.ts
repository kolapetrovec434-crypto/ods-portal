import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Roles
  const ownerRole = await prisma.role.upsert({
    where: { name: 'Власник' },
    update: {},
    create: {
      name: 'Власник', color: '#ff4e6a', priority: 100,
      canGivePoints: true, canTakePoints: true, canWarn: true, canReprimand: true,
      canBan: true, canUnban: true, canManageTags: true, canManageRoles: true,
      canManageModPass: true, canViewStats: true, isOwner: true,
    },
  });

  const headModRole = await prisma.role.upsert({
    where: { name: 'Головний Модератор' },
    update: {},
    create: {
      name: 'Головний Модератор', color: '#ff4e6a', priority: 80,
      canGivePoints: true, canTakePoints: true, canWarn: true, canReprimand: true,
      canBan: true, canUnban: true, canManageTags: true, canViewStats: true,
    },
  });

  await prisma.role.upsert({
    where: { name: 'Модератор' },
    update: {},
    create: {
      name: 'Модератор', color: '#5865F2', priority: 60,
      canGivePoints: true, canWarn: true, canViewStats: true,
    },
  });

  await prisma.role.upsert({
    where: { name: 'Молодший Модератор' },
    update: {},
    create: {
      name: 'Молодший Модератор', color: '#faa61a', priority: 40,
      canGivePoints: true,
    },
  });

  // Tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: 'Pro' }, update: {}, create: { name: 'Pro', color: '#5865F2' } }),
    prisma.tag.upsert({ where: { name: 'Ветеран' }, update: {}, create: { name: 'Ветеран', color: '#f0b132' } }),
    prisma.tag.upsert({ where: { name: 'Активний' }, update: {}, create: { name: 'Активний', color: '#43b581' } }),
  ]);

  // Admin user
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { discordId: '000000000000000001' },
    update: {},
    create: {
      discordId: '000000000000000001',
      username: 'Phantom_Vex',
      passwordHash: adminHash,
      avatar: '👾',
      bio: 'Охороняю порядок з 2021 року.',
      level: 47, xp: 8340, points: 2150,
      roleId: ownerRole.id,
      tags: { connect: [{ id: tags[0].id }, { id: tags[1].id }] },
    },
  });

  // Active Mod Pass season
  const season = await prisma.modPassSeason.upsert({
    where: { id: 'seed-season-2' },
    update: {},
    create: {
      id: 'seed-season-2',
      name: 'Сезон 2: «Тінь Порядку»',
      isActive: true,
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-31'),
    },
  });

  // 10 levels with rewards
  for (let i = 1; i <= 10; i++) {
    const level = await prisma.modPassLevel.upsert({
      where: { seasonId_levelNumber: { seasonId: season.id, levelNumber: i } },
      update: {},
      create: { seasonId: season.id, levelNumber: i, requiredXp: i * 1000 },
    });
    if (i % 5 === 0) {
      await prisma.reward.create({
        data: { levelId: level.id, name: '-1 День норми', type: 'REDUCE_QUOTA', value: 1, icon: '⚡' },
      });
    } else if (i % 3 === 0) {
      await prisma.reward.create({
        data: { levelId: level.id, name: '+100 Балів', type: 'BONUS_POINTS', value: 100, icon: '💎' },
      });
    }
  }

  // Sample tasks
  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      { id: 'task-1', seasonId: season.id, title: 'Обробити 10 репортів', description: '', rewardXp: 500, type: 'REPORTS', target: 10 },
      { id: 'task-2', seasonId: season.id, title: 'Видати 5 попереджень',  description: '', rewardXp: 300, type: 'POINTS_GIVEN', target: 5 },
      { id: 'task-3', seasonId: season.id, title: 'Онлайн 7 днів підряд', description: '', rewardXp: 700, type: 'ONLINE_STREAK', target: 7 },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('   Admin login: discordId=000000000000000001  password=admin123');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
