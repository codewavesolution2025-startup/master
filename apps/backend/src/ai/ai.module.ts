import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiReportController } from './ai.report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [AiController, AiReportController],
})
export class AiModule {}
