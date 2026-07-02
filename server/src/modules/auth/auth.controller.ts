import { Controller, Post, Put, Get, Body, HttpException, HttpStatus, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { RateLimiter } from '../../common/rate-limiter';

@Controller('/api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly limiter: RateLimiter,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string; rememberMe?: boolean }, @Request() req: any) {
    // 按 IP 限流防暴力破解：5 次/分钟
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (!this.limiter.consume(`login:${ip}`, 5, 60_000)) {
      throw new HttpException('登录尝试过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    return this.authService.login(user, body.rememberMe ?? false);
  }

  // 校验当前 token 是否有效，返回用户信息（前端启动时可选用）
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: any) {
    return { user: req.user };
  }

  // 自助改密：仅 admin 可改自己的密码（viewer 由 admin 在「账号管理」重置）
  @Put('password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async changePassword(
    @Request() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, body.oldPassword, body.newPassword);
  }
}
