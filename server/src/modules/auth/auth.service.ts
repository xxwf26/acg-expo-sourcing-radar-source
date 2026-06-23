import { Injectable, Inject } from '@nestjs/common';
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
