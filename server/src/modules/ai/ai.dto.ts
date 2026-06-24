import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 单条历史消息 */
export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}

/** POST /api/ai/chat 入参 */
export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @IsOptional()
  history?: ChatMessageDto[];
}
