import {
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ValidationPipe,
  type Type,
} from '@nestjs/common';
import {
  ApiBody,
  ApiParam,
  ApiQuery,
  type ExamplesObject,
} from '@nestjs/swagger';

type BodyDocumentation = { description?: string; examples?: ExamplesObject };

function input(
  dto: Type<unknown>,
  kind: 'body' | 'query',
  documentationOptions: BodyDocumentation = {},
): ParameterDecorator {
  // tsx не создаёт design:paramtypes: привязываем валидацию и OpenAPI к явному DTO.
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
      kind === 'body'
        ? ApiBody({ ...documentationOptions, type: dto })
        : ApiQuery({ type: dto });
    documentation(target, key, descriptor);
  };
}

// Примеры передаются в единственный ApiBody: несколько декораторов дают конкурирующие body-параметры.
export const ValidatedBody = (
  dto: Type<unknown>,
  documentation?: BodyDocumentation,
) => input(dto, 'body', documentation);
export const ValidatedQuery = (dto: Type<unknown>) => input(dto, 'query');

export function UuidParam(name: string): ParameterDecorator {
  return (target, key, index) => {
    Param(name, ParseUUIDPipe)(target, key, index);
    if (key === undefined) throw new Error('UUID parameter requires a method');
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error('UUID parameter method is missing');
    ApiParam({
      name,
      description:
        name === 'subject' ? 'UUID сотрудника Keycloak.' : 'UUID объекта CRM.',
      type: String,
      example: '11111111-1111-4111-8111-111111111111',
      format: 'uuid',
    })(target, key, descriptor);
  };
}
