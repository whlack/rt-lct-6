import {
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ValidationPipe,
  type Type,
} from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';

function input(dto: Type<unknown>, kind: 'body' | 'query'): ParameterDecorator {
  // tsx omits design:paramtypes. Bind both validation and OpenAPI to the actual DTO.
  const pipe = new ValidationPipe({
    expectedType: dto,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const parameter = kind === 'body' ? Body(pipe) : Query(pipe);
  return (target, key, index) => {
    parameter(target, key, index);
    if (key === undefined) throw new Error('DTO input requires a method');
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error('DTO input method is missing');
    const documentation =
      kind === 'body' ? ApiBody({ type: dto }) : ApiQuery({ type: dto });
    documentation(target, key, descriptor);
  };
}

export const ValidatedBody = (dto: Type<unknown>) => input(dto, 'body');
export const ValidatedQuery = (dto: Type<unknown>) => input(dto, 'query');

export function UuidParam(name: string): ParameterDecorator {
  return (target, key, index) => {
    Param(name, ParseUUIDPipe)(target, key, index);
    if (key === undefined) throw new Error('UUID parameter requires a method');
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error('UUID parameter method is missing');
    ApiParam({ name, type: String, format: 'uuid' })(target, key, descriptor);
  };
}
