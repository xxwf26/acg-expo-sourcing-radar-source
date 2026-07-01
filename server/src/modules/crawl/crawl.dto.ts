import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

/** 转正候选时，复核人可携带的修正字段（都可选；缺省用候选原值） */
export class PromoteCandidateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['master', 'creatorKol', 'supplier', 'platform']) type?: string;
  @IsOptional() @IsIn(['S', 'A', 'B']) priority?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) score?: number;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() booth?: string;
  @IsOptional() @IsString() followerScale?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsArray() events?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() angles?: string[];
}

export class MergeCandidateDto {
  @IsString() targetEntityId!: string;
}
