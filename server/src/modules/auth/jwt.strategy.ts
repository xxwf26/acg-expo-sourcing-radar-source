import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('环境变量 JWT_SECRET 未配置，拒绝以默认密钥启动');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** 回查库：用户被删除/角色被改后旧 token 立即失效，不信任 token 内的 role */
  async validate(payload: { sub: string; username: string; role: string }) {
    const [row] = await this.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, payload.sub));
    if (!row) {
      throw new UnauthorizedException('账号不存在或已删除');
    }
    return { userId: payload.sub, username: payload.username, role: row.role };
  }
}
