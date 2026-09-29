import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const labels: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  503: 'Service Unavailable',
};

/** Описывает стандартное тело NestJS; произвольные ответы (например ready) задаются отдельно. */
export function ApiErrors(
  errors: Record<number, string>,
  messages: Record<number, string> = {},
) {
  return applyDecorators(
    ...Object.entries(errors).map(([code, description]) => {
      const status = Number(code);
      // HttpException(string, 429) не содержит error; сообщения валидатора являются массивом.
      const example = {
        statusCode: status,
        message:
          messages[status] ??
          (status === 400
            ? ['id must be a UUID']
            : status === 401
              ? 'Bearer token required'
              : status === 429
                ? 'UPLOAD_LIMIT_REACHED'
                : status === 403
                  ? 'Permission required'
                  : status === 500
                    ? 'Internal server error'
                    : labels[status]),
        ...(labels[status] ? { error: labels[status] } : {}),
      };
      return ApiResponse({
        status,
        description,
        schema: {
          type: 'object',
          required: ['statusCode', 'message'],
          properties: {
            statusCode: {
              type: 'integer',
              description: 'HTTP-код ответа.',
              example: status,
            },
            message: {
              description:
                'Сообщение сервера или массив ошибок валидации; технические сообщения сохраняются на языке API.',
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
            error: {
              type: 'string',
              description:
                'Стандартное название HTTP-ошибки; присутствует для исключений NestJS, может отсутствовать у HttpException.',
            },
          },
          example,
        },
      });
    }),
  );
}

export const authenticationErrors = {
  401: 'Токен отсутствует, недействителен или не содержит роли CRM.',
  403: 'Недостаточно прав, уровня роли или доступа к объекту.',
  500: 'Внутренняя ошибка сервера или необработанный отказ БД/хранилища; используйте x-request-id для диагностики.',
};
