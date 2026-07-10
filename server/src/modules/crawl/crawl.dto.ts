import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

/** 采购匹配配置（P3-A 打分依据） */
export class SourcingConfigDto {
  @IsOptional() @IsArray() modules?: string[];
  @IsOptional() @IsArray() benchmarks?: string[];
  @IsOptional() @IsString() scoringRubric?: string;
}

/** 批量处理候选 */
export class BatchCandidateDto {
  @IsIn(['promote', 'reject']) action!: 'promote' | 'reject';
  @IsOptional() @IsArray() ids?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100) minScore?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) maxScore?: number;
}

/** 手动粘贴名单文本抽取候选（自动抓不到的站点兜底入口） */
export class ExtractTextDto {
  // 200KB 上限，防超大粘贴撑爆；下限在 service 层校验（去空后 ≥20）
  @IsString() @MaxLength(200_000) rawText!: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(64) eventId?: string;
}
