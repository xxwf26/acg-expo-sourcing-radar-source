import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

@Controller()
export class ViewController {
  @Get(['/', '/*'])
  async render(@Req() req: Request, @Res() res: Response) {
    // 未匹配到任何 API 控制器的 /api/* 请求，返回 404 JSON 而非首页 HTML
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
      });
      return;
    }
    const indexPath = join(process.cwd(), '..', 'client', 'dist', 'index.html');
    if (existsSync(indexPath)) {
      res.send(readFileSync(indexPath, 'utf-8'));
    } else {
      res.send(`<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>ACG展会采购寻源雷达</title></head>
        <body><div id="root"></div>
        <p style="text-align:center;margin-top:100px;color:#999;">
          前端未构建。开发模式请运行 <code>cd client &amp;&amp; npm run dev</code>；<br/>
          生产环境请先 <code>cd client &amp;&amp; npm run build</code>。
        </p></body></html>`);
    }
  }
}
