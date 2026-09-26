import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
const swagger = new DocumentBuilder()
  .setTitle('CRM API')
  .setVersion('0.1.0')
  .build();
SwaggerModule.setup(
  'api/docs',
  app,
  SwaggerModule.createDocument(app, swagger),
);
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
