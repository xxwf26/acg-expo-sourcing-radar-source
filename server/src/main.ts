import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  // 安全响应头：X-Frame-Options(防点击劫持)、nosniff、HSTS 等 + CSP。
  // CSP 按本应用实际外部依赖精调：仅 s.wordpress.com(网页截图) 需放行 img；
  // Tailwind 运行时注入内联样式，故 style 放开 'unsafe-inline'（无 script inline）。
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://s.wordpress.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );

  // 生产模式托管前端构建产物
  const clientDist = join(process.cwd(), '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.useStaticAssets(clientDist);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 全局异常过滤器：非预期错误对外泛化，细节只进日志（防内部信息泄露）
  app.useGlobalFilters(new AllExceptionsFilter());

  const corsOrigins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:5175,http://localhost:5174,http://localhost:3002,http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3002');

  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
