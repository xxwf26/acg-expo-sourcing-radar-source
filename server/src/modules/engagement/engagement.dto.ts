import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertEngagementDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  owner?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  updatedBy?: string;
}
