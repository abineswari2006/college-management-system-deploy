import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export function configureApiApp(app: INestApplication) {
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops);
  }
  app.use((helmet as any)());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-College-Id'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('College Management API')
    .setDescription('Tenant-isolated college administration API')
    .setVersion('1.0')
    .addCookieAuth('cms_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  app.enableShutdownHooks();
  return app;
}