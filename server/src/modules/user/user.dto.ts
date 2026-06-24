import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(255)
  password!: string;

  @IsIn(['admin', 'viewer'])
  role!: 'admin' | 'viewer';

  @IsOptional() @IsString() @MaxLength(128) displayName?: string;
}

// 改资料：只允许改 role / displayName（username、password 走专用接口）
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['username', 'password'] as const)) {}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(255)
  newPassword!: string;
}
