import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApiApp } from './configure-app.js';
import { DATABASE } from './db/database.js';
import { migrateDatabase } from './db/migrate.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    configureApiApp(app);
    const database = app.get(DATABASE);
    if (process.env.NODE_ENV !== 'production') {
        await migrateDatabase(database);
    }
    else {
        if (!process.env.SESSION_SECRET || Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
            throw new Error('SESSION_SECRET must be configured with at least 32 random bytes in production.');
        }
        if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
            throw new Error('SMTP_URL and MAIL_FROM are required in production for secure account invitations and recovery.');
        }
        const migration = await database.query(`SELECT count(*)::text AS count FROM schema_migrations
       WHERE version IN ('0001_initial', '0002_system_administration', '0003_auth_rate_limits')`);
        if (Number(migration.rows[0]?.count ?? 0) < 3)
            throw new Error('Database migrations have not been applied.');
    }
    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port, '0.0.0.0');
    console.log(`College API listening on port ${port}`);
}
bootstrap().catch((error) => {
    console.error('API startup failed.', error);
    process.exitCode = 1;
});
