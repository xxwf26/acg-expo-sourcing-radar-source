// 初始化系统用户（admin / viewer）。密码 bcrypt 加密。
// 已存在的用户名跳过（不覆盖已改过的密码）。可重复执行。
import 'reflect-metadata';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '..', '.env') });

// 默认账号；首次部署后请尽快改密码（改库或重设）
const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', displayName: '管理员' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', displayName: '只读用户' },
];

async function main() {
  const connection = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sourcing_radar',
  });
  const orm = drizzle(connection, { schema, mode: 'default' });

  for (const u of DEFAULT_USERS) {
    const [existing] = await orm
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, u.username));
    if (existing) {
      console.log(`- 用户 ${u.username} 已存在，跳过`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    await orm.insert(schema.users).values({
      username: u.username,
      passwordHash,
      role: u.role,
      displayName: u.displayName,
    });
    console.log(`✓ 创建用户 ${u.username}（${u.role}），初始密码 ${u.password}`);
  }

  console.log('用户初始化完成。请尽快修改默认密码。');
  await connection.end();
}

main().catch((err) => {
  console.error('seed-users 失败：', err);
  process.exit(1);
});
