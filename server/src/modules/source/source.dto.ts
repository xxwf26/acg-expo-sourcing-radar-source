import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class UpdateSourceDto extends PartialType(CreateSourceDto) {}
