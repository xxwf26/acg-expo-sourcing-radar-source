import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VisualDto {
  @IsString() title!: string;
  @IsString() caption!: string;
  @IsString() url!: string;
}

export class ContactDto {
  @IsString() channel!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateEntityDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsIn(['master', 'creatorKol', 'supplier', 'platform'])
  type!: string;

  @IsIn(['S', 'A', 'B'])
  priority!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional() @IsString() @MaxLength(128) region?: string;
  @IsOptional() @IsString() @MaxLength(255) booth?: string;
  @IsOptional() @IsString() @MaxLength(255) followerScale?: string;
  @IsOptional() @IsString() @MaxLength(255) followerTier?: string;
  @IsOptional() @IsString() followerNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  angles?: string[];

  @IsOptional() @IsString() reason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cases?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisualDto)
  visuals?: VisualDto[];

  // links 是 [label, url][] 的二维数组
  @IsOptional()
  @IsArray()
  links?: [string, string][];

  // 结构化联系方式；contactCheckedAt 由 service 在写 contacts 时自动盖，不从 body 收
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @IsOptional() @IsString() @MaxLength(64) contactCheckedBy?: string;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class UpdateEntityDto extends PartialType(CreateEntityDto) {}
