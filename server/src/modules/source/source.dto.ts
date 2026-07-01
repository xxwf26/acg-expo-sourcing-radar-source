import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSourceDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional() @IsString() @MaxLength(255) cadence?: string;
  @IsOptional() @IsString() @MaxLength(255) fields?: string;

  // links 是 [label, url][]
  @IsOptional()
  @IsArray()
  links?: [string, string][];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // ── 自动采集（P1）抓取配置字段 ──
  @IsOptional() @IsString() @MaxLength(1024) url?: string;
  @IsOptional() @IsIn(['static', 'browser', 'pdf']) strategy?: string;
  @IsOptional() @IsString() selector?: string;
  @IsOptional() @IsString() @MaxLength(64) eventId?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateSourceDto extends PartialType(CreateSourceDto) {}
