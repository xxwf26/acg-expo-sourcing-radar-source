import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 全局异常过滤器。
 * - HttpException（校验失败/403/404/429 等业务错误）：保留原状态码与 message 返回前端。
 * - 非预期错误（DB 异常、第三方库抛错等）：对外统一返回 500 + 泛化文案 + 关联 ID，
 *   真实错误信息（可能含内网地址/依赖细节/堆栈）只写服务端日志，不回传前端。
 *
 * 前端 axios 拦截器读 error.response.data.message 展示，故保留该字段结构。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      // 业务异常：原样返回（NestJS 内建结构已含 message）
      const status = exception.getStatus();
      res.status(status).json(exception.getResponse());
      return;
    }

    // 非预期错误：生成关联 ID，细节进日志，对外泛化
    const errId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const detail = exception instanceof Error ? exception.stack || exception.message : String(exception);
    this.logger.error(`[${errId}] ${req.method} ${req.url}\n${detail}`);

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: `服务器内部错误，请稍后重试（错误编号 ${errId}）`,
      errorId: errId,
    });
  }
}
