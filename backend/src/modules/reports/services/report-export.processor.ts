import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import type { AuthUser } from '../../auth/index.js';
import type { ExportJob } from '../../../generated/prisma/client.js';
import {
  ReportRepository,
  summaryRow,
} from '../repositories/report.repository.js';
import { reportWhere, reportTimezone } from '../report-filters.js';
import { ExportRequestDto } from '../dto/export-request.dto.js';
import { exportParameters } from './report-export.service.js';
import { BrowserRenderer } from '../../../integrations/rendering/browser.adapter.js';
import { spreadsheet } from '../../../integrations/rendering/spreadsheet.js';
import type {
  TableDocument,
  TableSection,
} from '../../../integrations/rendering/document.js';
import type { ExportArtifact } from '../../jobs/index.js';
import { positiveInteger } from '../../../config/jobs.js';

function name(
  person: {
    displayName: string | null;
    email: string | null;
    keycloakSubject: string;
  } | null,
) {
  return person?.displayName ?? person?.email ?? person?.keycloakSubject ?? '';
}
function date(value: Date | null): string {
  return value ? value.toISOString() : '';
}
type Summary = ReturnType<typeof summaryRow>;
function summarySection(rows: Summary[]): TableSection {
  return {
    title: 'Проекты',
    columns: [
      'ID',
      'Вуз',
      'Направление',
      'Тип',
      'Программа/продукт',
      'Статус',
      'Текущий этап',
      'Ответственный',
      'Руководитель',
      'Создан',
      'Закрыт',
      'Вендор',
      'Договор',
      'Подписана лицензия',
      'Срок лицензии',
      'Передача',
    ],
    rows: rows.map((p) => [
      p.id,
      p.university.name,
      p.direction.name,
      p.offering.type,
      p.offering.name ?? '',
      p.status,
      p.currentStage?.title ?? '',
      name(p.responsible),
      name(p.supervisor),
      date(p.createdAt),
      date(p.closedAt),
      p.vendor,
      p.contractNumber,
      date(p.licenseSignedAt),
      p.licenseExpiresYear,
      p.transferStatus,
    ]),
  };
}
@Injectable()
export class ReportExportProcessor {
  constructor(
    @Inject(ReportRepository) private readonly reports: ReportRepository,
    @Inject(BrowserRenderer) private readonly renderer: BrowserRenderer,
  ) {}
  async run(job: ExportJob, user: AuthUser): Promise<ExportArtifact> {
    if (!['SUMMARY', 'PROJECT'].includes(job.kind))
      throw new BadRequestException('Unknown export kind');
    if (
      typeof job.parameters !== 'object' ||
      job.parameters === null ||
      Array.isArray(job.parameters)
    )
      throw new BadRequestException('Invalid export parameters');
    const request = plainToInstance(ExportRequestDto, {
      ...job.parameters,
      format: job.format,
    });
    try {
      await validateOrReject(request, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch {
      throw new BadRequestException('Invalid export parameters');
    }
    exportParameters(request);
    const result = await this.reports.snapshot(async (tx) => {
      const document: TableDocument = {
        title: 'Отчёт CRM',
        generatedAt: new Date().toISOString(),
        timezone: reportTimezone(),
        sections: [],
      };
      if (job.kind === 'PROJECT') {
        if (!request.projectId)
          throw new BadRequestException('Project required');
        const project = await this.reports.detail(tx, user, request.projectId);
        if (!project) throw new NotFoundException('Project unavailable');
        document.sections.push(summarySection([project]));
        document.sections.push({
          title: 'Этапы',
          columns: ['Порядок', 'Этап', 'Ожидаемая сторона', 'Контакт'],
          rows: project.stages.map((s) => [
            s.position + 1,
            s.title,
            s.expectedActor,
            s.expectedContact?.name ?? '',
          ]),
        });
        document.sections.push({
          title: 'Документы',
          columns: [
            'Этап',
            'Вид',
            'Обязателен',
            'Файл',
            'Статус',
            'Дата',
            'Автор',
          ],
          rows: project.stages.flatMap((s) =>
            s.documentTypes.flatMap((t) => {
              const files = s.files.filter((f) => f.documentTypeId === t.id);
              return files.length
                ? files.map((f) => [
                    s.title,
                    t.name,
                    t.isRequired,
                    f.fileName,
                    f.status,
                    date(f.createdAt),
                    name(f.uploadedBy),
                  ])
                : [[s.title, t.name, t.isRequired, '', '', '', '']];
            }),
          ),
        });
        document.sections.push({
          title: 'Комментарии',
          columns: [
            'ID',
            'Ответ на',
            'Автор',
            'Текст',
            'Создан',
            'Изменён',
            'Удалён',
          ],
          rows: project.comments.map((c) => [
            c.id,
            c.parentId,
            name(c.author),
            c.deletedAt ? '[Удалён]' : c.body,
            date(c.createdAt),
            date(c.updatedAt),
            date(c.deletedAt),
          ]),
        });
        document.sections.push({
          title: 'История',
          columns: [
            'Дата',
            'Событие',
            'Автор',
            'Объект',
            'ID объекта',
            'Детали',
          ],
          rows: project.events.map((e) => [
            date(e.createdAt),
            e.type,
            name(e.actor),
            e.objectType,
            e.objectId,
            JSON.stringify(e.details),
          ]),
        });
        return { document, projectIds: [project.id] };
      }
      const count = await tx.project.count({
        where: await reportWhere(tx, user, request),
      });
      if (count > positiveInteger('REPORT_MAX_PROJECTS', 50000))
        throw new BadRequestException('Export too large; narrow filters');
      const projects = await this.reports.all(tx, user, request);
      document.sections.push(summarySection(projects.map(summaryRow)));
      return { document, projectIds: projects.map((p) => p.id) };
    });
    const bytes =
      request.format === 'pdf'
        ? await this.renderer.table(result.document)
        : spreadsheet(result.document, request.format);
    return {
      bytes,
      projectIds: result.projectIds,
      fileName: 'crm-report.' + request.format,
      mimeType:
        request.format === 'pdf'
          ? 'application/pdf'
          : request.format === 'xls'
            ? 'application/vnd.ms-excel'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
