import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventModule } from './modules/event/event.module';
import { EntityModule } from './modules/entity/entity.module';
import { SourceModule } from './modules/source/source.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { AiModule } from './modules/ai/ai.module';
import { CrawlModule } from './modules/crawl/crawl.module';
import { UserModule } from './modules/user/user.module';
import { ViewModule } from './modules/view/view.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    AuthModule,
    EventModule,
    EntityModule,
    SourceModule,
    EngagementModule,
    AiModule,
    CrawlModule,
    UserModule,
    // ViewModule 必须最后注册（catch-all 路由）
    ViewModule,
  ],
})
export class AppModule {}
