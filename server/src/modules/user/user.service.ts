import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';
import { CreateUserDto, UpdateUserDto } from './user.dto';

// 对外返回的用户字段，绝不含 passwordHash
const PUBLIC_COLUMNS = {
  id: users.id,
  username: users.username,
  role: users.role,
  displayName: users.displayName,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async findAll() {
    const list = await this.db.select(PUBLIC_COLUMNS).from(users).orderBy(asc(users.createdAt));
    return { list, total: list.length };
  }

  private async findPublic(id: string) {
    const [row] = await this.db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, id));
    return row ?? null;
  }

  /** 当前 admin 角色用户数量（用于最后一个 admin 保护） */
  private async countAdmins() {
    const rows = await this.db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
    return rows.length;
  }

  async create(dto: CreateUserDto) {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.username, dto.username));
    if (existing) throw new BadRequestException(`用户名「${dto.username}」已存在`);
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.db.insert(users).values({
      id,
      username: dto.username,
      passwordHash,
      role: dto.role,
      displayName: dto.displayName ?? null,
    });
    return this.findPublic(id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const [existing] = await this.db.select().from(users).where(eq(users.id, id));
    if (!existing) throw new NotFoundException('用户不存在');
    // 把最后一个 admin 降级 → 拒绝
    if (dto.role && dto.role !== 'admin' && existing.role === 'admin' && (await this.countAdmins()) <= 1) {
      throw new BadRequestException('不能降级最后一个管理员');
    }
    const patch: Record<string, any> = {};
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (Object.keys(patch).length > 0) {
      await this.db.update(users).set(patch).where(eq(users.id, id));
    }
    return this.findPublic(id);
  }

  async resetPassword(id: string, newPassword: string) {
    const existing = await this.findPublic(id);
    if (!existing) throw new NotFoundException('用户不存在');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
    return { success: true };
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('不能删除自己的账号');
    const [existing] = await this.db.select().from(users).where(eq(users.id, id));
    if (!existing) throw new NotFoundException('用户不存在');
    if (existing.role === 'admin' && (await this.countAdmins()) <= 1) {
      throw new BadRequestException('不能删除最后一个管理员');
    }
    await this.db.delete(users).where(eq(users.id, id));
    return { success: true };
  }
}
