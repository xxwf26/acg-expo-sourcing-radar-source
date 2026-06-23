import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(32)
  short!: string;

  @IsOptional() @IsString() @MaxLength(128) date?: string;
  @IsOptional() @IsString() @MaxLength(32) month?: string;
  @IsOptional() @IsString() @MaxLength(128) city?: string;
  @IsOptional() @IsString() @MaxLength(64) region?: string;
  @IsOptional() @IsString() @MaxLength(255) venue?: string;
  @IsOptional() @IsString() @MaxLength(64) status?: string;
  @IsOptional() @IsString() note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // links 是 [label, url][]
  @IsOptional()
  @IsArray()
  links?: [string, string][];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}
