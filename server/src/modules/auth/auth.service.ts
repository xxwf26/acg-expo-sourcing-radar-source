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
  // 用户不存在时用它跑一次 bcrypt，抹平「存在 vs 不存在」的响应时延差，防用户名枚举
  private static readonly DUMMY_HASH =
    '$2a$10$rqea8By8M1vEXC3.vGz8ze/eXL9ylKqqD6jLT1KyFBXPPpa1EyQxC';

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<AuthUser | null> {
    const [row] = await this.db.select().from(users).where(eq(users.username, username));
    if (!row) {
      // 不存在也跑一次 bcrypt，消除时序侧信道（否则响应快慢可区分用户名是否存在）
      await bcrypt.compare(password, AuthService.DUMMY_HASH);
      return null;
    }
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
    // token 存于前端 localStorage，XSS 可窃取；有效期收敛以缩小被盗窗口（记住我 7 天，否则 8 小时）
    const expiresIn = rememberMe ? '7d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: { username: user.username, role: user.role, displayName: user.displayName },
      expiresIn,
    };
  }
}
