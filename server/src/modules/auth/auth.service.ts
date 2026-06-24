import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  displayName: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<AuthUser | null> {
    const [row] = await this.db.select().from(users).where(eq(users.username, username));
    if (!row) return null;
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) return null;
    return { id: row.id, username: row.username, role: row.role, displayName: row.displayName };
  }

  /** 自助改密：校验旧密码后写入新密码的 bcrypt hash */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('新密码至少 6 位');
    }
    const [row] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!row) throw new UnauthorizedException('用户不存在');
    const ok = await bcrypt.compare(oldPassword, row.passwordHash);
    // 用 400 而非 401：避免命中前端 401=会话过期 的拦截器把用户登出
    if (!ok) throw new BadRequestException('原密码错误');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    return { success: true };
  }

  login(user: AuthUser, rememberMe = false) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const expiresIn = rememberMe ? '30d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: { username: user.username, role: user.role, displayName: user.displayName },
      expiresIn,
    };
  }
}
