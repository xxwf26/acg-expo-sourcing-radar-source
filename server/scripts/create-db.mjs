// 创建数据库（无 mysql CLI / docker 环境下用 node 直连创建）。
// 连接时不指定 database，CREATE DATABASE IF NOT EXISTS，然后退出。
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const dbName = process.env.DB_NAME || 'sourcing_radar';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
});

await conn.query(
  `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
console.log(`✓ 数据库 \`${dbName}\` 已就绪`);
await conn.end();
