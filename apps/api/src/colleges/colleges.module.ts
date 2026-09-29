import { Module } from '@nestjs/common';
import { CollegesController } from './colleges.controller.js';
import { CollegesService } from './colleges.service.js';

@Module({
  controllers: [CollegesController],
  providers: [CollegesService],
})
export class CollegesModule {}