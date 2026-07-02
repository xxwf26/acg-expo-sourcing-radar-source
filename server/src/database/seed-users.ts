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
import { randomBytes } from 'crypto';
import * as schema from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '..', '.env') });

// 生成一个便于抄录的强随机初始口令（无歧义字符集）
function randomPassword(len = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// 初始账号口令优先从环境变量读；未设则随机生成并在控制台打印一次。
// 不再硬编码 admin123/viewer123 这类弱口令。
const DEFAULT_USERS = [
  { username: 'admin', password: process.env.SEED_ADMIN_PASSWORD || randomPassword(), role: 'admin', displayName: '管理员' },
  { username: 'viewer', password: process.env.SEED_VIEWER_PASSWORD || randomPassword(), role: 'viewer', displayName: '只读用户' },
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
