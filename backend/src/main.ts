import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

const app = await NestFactory.create(AppModule);
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
const swagger = new DocumentBuilder()
  .setTitle('CRM API')
  .setVersion('0.1.0')
  .addBearerAuth()
  .build();
SwaggerModule.setup(
  'api/docs',
  app,
  SwaggerModule.createDocument(app, swagger),
);
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
