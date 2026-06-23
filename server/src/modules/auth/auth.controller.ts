import { Controller, Post, Get, Body, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string; rememberMe?: boolean }) {
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
}
