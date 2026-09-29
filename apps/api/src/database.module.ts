import { Global, Module } from '@nestjs/common';
import { DATABASE, openDatabase } from './db/database.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: openDatabase,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}