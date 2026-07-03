import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 登录入参。用 class-validator 校验，避免畸形/超长 payload 直接进 bcrypt。 */
export class LoginDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MaxLength(255)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/** 自助改密入参。 */
export class ChangePasswordDto {
  @IsString()
  @MaxLength(255)
  oldPassword!: string;

  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  @MaxLength(255)
  newPassword!: string;
}
