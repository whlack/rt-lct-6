import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { escapeHtml, type TableDocument } from './document.js';

@Injectable()
export class BrowserRenderer {
  private async html(body: string): Promise<string> {
    const font = await readFile(
      process.env.REPORT_FONT_PATH ??
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    );
    return (
      '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>' +
      '@font-face{font-family:Report;src:url(data:font/ttf;base64,' +
      font.toString('base64') +
      ')}' +
      'body{font:11px Report,sans-serif;color:#172033;margin:0}h1{font-size:20px}h2{font-size:14px;break-after:avoid}table{border-collapse:collapse;width:100%;margin-bottom:20px;table-layout:fixed}' +
      'th,td{border:1px solid #ccd3df;padding:5px;overflow-wrap:anywhere;vertical-align:top}th{background:#edf2f8}thead{display:table-header-group}tr{break-inside:avoid}svg{max-width:100%;height:auto} .meta{color:#526174;margin-bottom:16px}' +
      '</style></head><body>' +
      body +
      '</body></html>'
    );
  }
  async render(
    body: string,
    format: 'pdf' | 'png',
    landscape = false,
  ): Promise<Buffer> {
    const browser = await chromium.launch({ headless: true });
    const deadline = setTimeout(() => {
      void browser.close();
    }, 120000);
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await page.route('**/*', (route) => route.abort());
      await page.setContent(await this.html(body), {
        waitUntil: 'load',
        timeout: 60000,
      });
      await page.evaluate(() => document.fonts.ready);
      return format === 'png'
        ? await page.screenshot({ fullPage: true })
        : await page.pdf({
            format: landscape ? 'A3' : 'A4',
            landscape,
            printBackground: true,
            margin: {
              top: '12mm',
              right: '10mm',
              bottom: '15mm',
              left: '10mm',
            },
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate:
              '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          });
    } finally {
      clearTimeout(deadline);
      await browser.close();
    }
  }
  table(document: TableDocument) {
    const body =
      '<h1>' +
      escapeHtml(document.title) +
      '</h1><div class="meta">' +
      escapeHtml(document.generatedAt + ' · ' + document.timezone) +
      '</div>' +
      document.sections
        .map(
          (s) =>
            '<h2>' +
            escapeHtml(s.title) +
            '</h2><table><thead><tr>' +
            s.columns.map((c) => '<th>' + escapeHtml(c) + '</th>').join('') +
            '</tr></thead><tbody>' +
            (s.rows.length
              ? s.rows
                  .map(
                    (row) =>
                      '<tr>' +
                      row
                        .map((v) => '<td>' + escapeHtml(v) + '</td>')
                        .join('') +
                      '</tr>',
                  )
                  .join('')
              : '<tr><td colspan="' +
                s.columns.length +
                '">Нет данных</td></tr>') +
            '</tbody></table>',
        )
        .join('');
    return this.render(body, 'pdf', true);
  }
}
