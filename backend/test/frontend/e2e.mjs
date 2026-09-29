import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
if (process.env.ACCEPTANCE_ISOLATED !== '1')
  throw new Error('Disposable stack required');
const origin = process.env.FRONTEND_TEST_ORIGIN;
const identities = JSON.parse(
  await readFile('/artifacts/identities.json', 'utf8'),
);
const { address } = await lookup('host.docker.internal');
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', `--host-resolver-rules=MAP localhost ${address}`],
});
const failures = [];
const checks = [];
let currentCheck;
async function check(title, action) {
  currentCheck = title;
  await action();
  checks.push(title);
  console.log('PASS: ' + title);
}
async function visible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 30000 });
}
async function text(locator, value) {
  await visible(locator);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if ((await locator.textContent())?.includes(value)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Expected text did not appear: ' + value);
}
async function capture(page, options) {
  await visible(page.locator('main h1'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot(options);
}
async function responseStatus(session, path) {
  // Browser networking shares the localhost resolver; Node's request context does not.
  return session.page.evaluate(
    async ({ path, authorization }) =>
      (await fetch(path, { headers: { authorization } })).status,
    { path, authorization: session.authorization() },
  );
}
async function login(role, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => failures.push(error.message));
  let authorization;
  page.on('request', (request) => {
    if (request.url().includes('/api/me'))
      authorization = request.headers().authorization;
  });
  await page.goto(origin);
  await page
    .getByRole('button', { name: 'Войти через корпоративный аккаунт' })
    .click();
  await page.locator('#username').fill('frontend-' + role);
  await page.locator('#password').fill('frontend-test-password-1');
  await page.locator('#kc-login').click();
  await visible(page.getByRole('heading', { name: 'Моя работа', exact: true }));
  return { context, page, authorization: () => authorization };
}
let admin;
try {
  admin = await login('admin');
  const { page } = admin;
  await check(
    'real OIDC login, permissions, dashboard and production assets',
    async () => {
      await text(page.locator('.glass-metrics'), 'Вузы-партнёры');
      assert.equal(await page.locator('.glass-metrics article').count(), 3);
      assert.equal(
        await page.evaluate(() => document.documentElement.dataset.designStyle),
        'standard',
      );
      const config = await page.evaluate(async () => {
        const response = await fetch('/api/config');
        return {
          cacheControl: response.headers.get('cache-control'),
          realm: (await response.json()).keycloak.realm,
        };
      });
      assert.equal(config.realm, 'crm');
      assert.ok(config.cacheControl?.includes('no-store'));
      assert.equal(
        await page
          .getByText(/Демоверсия|Демонстрационные данные|B2B|B2C/)
          .count(),
        0,
      );
      const saved = await page.evaluate(() => Object.keys(localStorage));
      assert.ok(saved.every((key) => key === 'crm-theme'));
      await capture(page, {
        path: '/artifacts/dashboard-desktop.png',
        fullPage: true,
      });
    },
  );
  await check('SPA navigation, theme and keyboard focus', async () => {
    await page.evaluate(() => {
      window.__navigationCheck = 'same-document';
    });
    await page
      .locator('.workspace-navigation')
      .getByRole('link', { name: 'Проекты', exact: true })
      .click();
    await visible(page.getByRole('heading', { name: 'Проекты', exact: true }));
    assert.equal(
      await page.evaluate(() => window.__navigationCheck),
      'same-document',
    );
    await page
      .getByRole('button', { name: 'Тёмная тема', exact: true })
      .click();
    await visible(page.locator('.app-shell.mode-dark'));
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Настройки' });
    await visible(settings);
    assert.equal(
      await page
        .getByRole('button', { name: 'Настройки', exact: true })
        .evaluate((element) => getComputedStyle(element).cursor),
      'pointer',
    );
    assert.equal(
      await settings.evaluate((element) => getComputedStyle(element).color),
      'rgb(245, 246, 250)',
    );
    await settings.getByRole('button', { name: /CRM и сайт/ }).click();
    assert.equal(await settings.getByText('Цветовая тема').count(), 0);
    await settings.getByRole('button', { name: /Системный/ }).click();
    assert.equal(
      await page.evaluate(() => localStorage.getItem('crm-font')),
      'system',
    );
    await settings.getByRole('button', { name: /Rostelecom Basis/ }).click();
    await settings.getByRole('button', { name: /Аккаунт/ }).click();
    await visible(settings.getByText('Двухфакторная защита'));
    await settings.screenshot({ path: '/artifacts/settings-dark.png' });
    await settings.getByRole('button', { name: 'Закрыть' }).click();
    await settings.waitFor({ state: 'hidden' });
    await capture(page, {
      path: '/artifacts/projects-dark.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Светлая тема', exact: true })
      .click();
    await visible(page.locator('.app-shell.mode-light'));
  });
  await check(
    'university contact, primary contact and related projects',
    async () => {
      await page.goto(origin + '/universities/' + identities.universityId);
      await page
        .getByRole('button', { name: '+ Контакт', exact: true })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Новый контакт' });
      await dialog.getByLabel('ФИО', { exact: true }).fill('Ирина Вузовская');
      await dialog
        .getByLabel('Email', { exact: true })
        .fill('contact@example.test');
      await dialog
        .getByRole('button', { name: 'Сохранить', exact: true })
        .click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Сделать основным' }).click();
      await text(page.locator('.details-list').first(), 'Ирина Вузовская');
      await text(page.locator('table'), 'Защита информационных систем');
      await page.getByRole('button', { name: 'Контакты', exact: true }).click();
      await text(page.locator('main'), 'contact@example.test');
      await page.getByRole('button', { name: 'Обзор', exact: true }).click();
      const assignees = page
        .getByRole('heading', { name: 'Ответственные КАМ' })
        .locator('..')
        .locator('.list-stack');
      await text(assignees, 'frontend-kam');
      assert.equal(
        await assignees.getByText(identities.people.kam.subject).count(),
        0,
      );
      await capture(page, {
        path: '/artifacts/university-desktop.png',
        fullPage: true,
      });
    },
  );
  await check(
    'catalog creation and server-backed project creation',
    async () => {
      await page.goto(origin + '/admin/catalogs');
      await page
        .getByRole('button', { name: '+ Добавить', exact: true })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Новая запись' });
      await dialog
        .getByLabel('Название', { exact: true })
        .fill('Frontend проверка направления');
      await dialog
        .getByRole('button', { name: 'Сохранить', exact: true })
        .click();
      await dialog.waitFor({ state: 'hidden' });
      await text(page.locator('main'), 'Frontend проверка направления');
      await page.goto(origin + '/projects');
      await page
        .getByRole('button', { name: '+ Новый проект', exact: true })
        .click();
      const create = page.getByRole('dialog', { name: 'Новый проект' });
      await visible(create.getByLabel('Вуз', { exact: true }));
      await create
        .getByLabel('Вуз', { exact: true })
        .selectOption(identities.universityId);
      await create
        .getByLabel('ИТ-направление', { exact: true })
        .selectOption(identities.directionId);
      await create
        .getByLabel('Программа', { exact: true })
        .selectOption(identities.programId);
      await create
        .getByLabel('Ответственный КАМ', { exact: true })
        .selectOption(identities.people.kam.subject);
      await create
        .getByRole('button', { name: 'Создать проект', exact: true })
        .click();
      await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
      await text(page.locator('main'), 'Формирование проекта');
    },
  );
  await check('project fields, nullable updates and assignments', async () => {
    await page.goto(origin + '/projects/' + identities.projectId);
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Договор и лицензия' });
    await dialog.getByLabel('Вендор', { exact: true }).fill('Тестовый вендор');
    await dialog
      .getByLabel('Номер договора', { exact: true })
      .fill('FRONTEND-42');
    await dialog
      .getByLabel('Подписание лицензии', { exact: true })
      .fill('2026-09-29');
    await dialog
      .getByLabel('Срок лицензии (год)', { exact: true })
      .fill('2028');
    await dialog
      .getByLabel('Статус передачи', { exact: true })
      .selectOption('IN_PROGRESS');
    await dialog
      .getByRole('button', { name: 'Сохранить', exact: true })
      .click();
    await dialog.waitFor({ state: 'hidden' });
    await text(page.locator('main'), 'FRONTEND-42');
    await page
      .getByLabel('Назначить руководителя', { exact: true })
      .selectOption(identities.people.supervisor.subject);
    await page
      .getByRole('button', { name: 'Назначить руководителя', exact: true })
      .click();
    await text(page.locator('.details-list').last(), 'Тест supervisor');
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    await dialog.getByLabel('Вендор', { exact: true }).fill('');
    await dialog
      .getByRole('button', { name: 'Сохранить', exact: true })
      .click();
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(
      !(await page.locator('main').textContent()).includes('Тестовый вендор'),
    );
  });
  await check(
    'workflow configuration, immutable first stage and transition locking',
    async () => {
      await page
        .getByRole('button', { name: 'Настроить этапы', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Настройка workflow проекта',
      });
      while ((await dialog.locator('.workflow-editor-stage').count()) > 2)
        await dialog
          .getByRole('button', { name: 'Удалить этап', exact: true })
          .last()
          .click();
      const stage = dialog.locator('.workflow-editor-stage').first();
      await stage
        .getByLabel('Название этапа', { exact: true })
        .fill('Согласование');
      await stage
        .getByLabel('Ожидаемая сторона', { exact: true })
        .selectOption('UNIVERSITY');
      await stage
        .getByLabel('Контакт вуза', { exact: true })
        .selectOption({ label: 'Ирина Вузовская' });
      await stage
        .getByRole('button', { name: '+ Тип документа', exact: true })
        .click();
      await stage
        .getByLabel('Название документа', { exact: true })
        .fill('Договор');
      await stage.getByLabel('Обязательный', { exact: true }).check();
      await dialog
        .locator('.workflow-editor-stage')
        .last()
        .getByLabel('Название этапа', { exact: true })
        .fill('Завершение');
      await dialog
        .getByRole('button', { name: 'Сохранить workflow', exact: true })
        .click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.stage-route li').count(), 3);
      await page.getByRole('button', { name: 'Следующий этап' }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Подтвердить', exact: true })
        .click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await text(page.locator('.stage-route .current'), 'Согласование');
      assert.equal(
        await page
          .getByRole('button', { name: 'Настроить этапы', exact: true })
          .count(),
        0,
      );
      assert.ok(
        await page.getByRole('button', { name: 'Следующий этап' }).isDisabled(),
      );
    },
  );
  await check(
    'required document upload, completion and protected download',
    async () => {
      await page
        .getByRole('button', { name: 'Документы', exact: true })
        .click();
      await page.getByLabel('Файл: Договор', { exact: true }).setInputFiles({
        name: 'agreement.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\nfrontend-check'),
      });
      await page
        .getByRole('button', { name: 'Прикрепить', exact: true })
        .click();
      await text(page.locator('main'), 'agreement.pdf');
      await page
        .getByRole('button', { name: 'Отметить завершённым', exact: true })
        .click();
      await text(page.locator('.document-type'), 'Завершён');
      const result = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Скачать', exact: true }).click();
      const download = await result;
      assert.equal(download.suggestedFilename(), 'agreement.pdf');
      assert.equal(
        (await readFile(await download.path())).toString(),
        '%PDF-1.4\nfrontend-check',
      );
    },
  );
  await check('comment replies, editing and tombstone deletion', async () => {
    await page
      .getByRole('button', { name: 'Комментарии', exact: true })
      .click();
    await page
      .getByLabel('Новый комментарий', { exact: true })
      .fill('Первый комментарий');
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await text(page.locator('.comment-list'), 'Первый комментарий');
    await page.getByRole('button', { name: 'Ответить', exact: true }).click();
    await page
      .getByLabel('Новый комментарий', { exact: true })
      .fill('Ответ команды');
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await text(page.locator('.comment-list'), 'Ответ команды');
    await page
      .locator('.comment-entry')
      .first()
      .getByRole('button', { name: 'Изменить', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'Редактировать комментарий',
    });
    await dialog
      .getByLabel('Комментарий', { exact: true })
      .fill('Изменённый комментарий');
    await dialog
      .getByRole('button', { name: 'Сохранить', exact: true })
      .click();
    await dialog.waitFor({ state: 'hidden' });
    await text(page.locator('.comment-list'), 'Изменённый комментарий');
    await page
      .locator('.comment-entry')
      .first()
      .getByRole('button', { name: 'Удалить', exact: true })
      .click();
    const deletion = page.getByRole('dialog', { name: 'Удалить комментарий?' });
    await deletion
      .getByRole('button', { name: 'Удалить', exact: true })
      .click();
    await deletion.waitFor({ state: 'hidden' });
    await text(page.locator('.comment-list'), 'Комментарий удалён');
    await text(page.locator('.comment-list'), 'Ответ команды');
  });
  await check('project closure and server event history', async () => {
    await page.getByRole('button', { name: 'Этапы', exact: true }).click();
    await page.getByRole('button', { name: 'Следующий этап' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Подтвердить', exact: true })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page
      .getByRole('button', { name: 'Закрыть проект', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Подтвердить', exact: true })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await text(page.locator('.page-header'), 'Закрыт');
    await page.getByRole('button', { name: 'История', exact: true }).click();
    await text(page.locator('.project-history-timeline'), 'Проект закрыт');
    await text(
      page.locator('.project-history-timeline'),
      'Документ прикреплён',
    );
    await text(
      page.locator('.project-history-timeline'),
      'Формирование проекта → Согласование',
    );
    await capture(page, {
      path: '/artifacts/project-desktop.png',
      fullPage: true,
    });
  });
  await check('server report exports XLS, XLSX, PDF and JSON', async () => {
    await page.goto(origin + '/reports');
    await page.getByRole('button', { name: /Взаимодействия с вузами/ }).click();
    await text(page.locator('table'), 'Тестовый университет');
    for (const format of ['xls', 'xlsx', 'pdf', 'json']) {
      await page.getByLabel('Формат', { exact: true }).selectOption(format);
      await page
        .getByRole('button', { name: 'Сформировать файл', exact: true })
        .click();
      const job = page
        .locator('.report-queue .list-row')
        .filter({ hasText: 'Отчёт · ' + format.toUpperCase() });
      await text(job, 'Готово · 100%');
      const event = page.waitForEvent('download');
      await job.getByRole('button', { name: 'Скачать', exact: true }).click();
      const download = await event;
      assert.ok(
        download.suggestedFilename().endsWith('.' + format),
        'Expected ' + format + ', received ' + download.suggestedFilename(),
      );
      const bytes = await readFile(await download.path());
      assert.ok(bytes.length > 100);
      if (format === 'pdf')
        assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      if (format === 'json')
        assert.ok(!bytes.toString().includes('storageKey'));
    }
  });
  await capture(page, {
    path: '/artifacts/reports-desktop.png',
    fullPage: true,
  });
  await check('statistics aggregates and worker chart export', async () => {
    await page.getByRole('button', { name: 'Статистика', exact: true }).click();
    await text(page.locator('main'), 'Распределение по направлениям');
    await capture(page, {
      path: '/artifacts/statistics-desktop.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Скачать PNG', exact: true })
      .click();
    const job = page
      .locator('.report-queue .list-row')
      .filter({ hasText: 'Статистика · PNG' });
    await text(job, 'Готово · 100%');
    const event = page.waitForEvent('download');
    await job.getByRole('button', { name: 'Скачать', exact: true }).click();
    const download = await event;
    const bytes = await readFile(await download.path());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  });
  await check(
    'server import preview, explicit apply and error workbook',
    async () => {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([
          ['Название вуза'],
          ['Вуз из frontend импорта'],
        ]),
        'Вузы',
      );
      const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
      await page.goto(origin + '/admin/import');
      const templateEvent = page.waitForEvent('download');
      await page
        .getByRole('link', { name: 'Скачать шаблон XLSX', exact: true })
        .click();
      assert.deepEqual(
        await readFile(await (await templateEvent).path()),
        await readFile('/templates/catalog-import.xlsx'),
      );
      await page.getByLabel('Файл до 10 МБ', { exact: true }).setInputFiles({
        name: 'catalog.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: bytes,
      });
      await page
        .getByRole('button', { name: 'Проверить файл', exact: true })
        .click();
      await visible(
        page.getByRole('button', {
          name: 'Применить допустимые строки',
          exact: true,
        }),
      );
      await text(page.locator('table'), 'Вуз из frontend импорта');
      await capture(page, {
        path: '/artifacts/import-desktop.png',
        fullPage: true,
      });
      await page
        .getByRole('button', {
          name: 'Применить допустимые строки',
          exact: true,
        })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Подтвердить применение', exact: true })
        .click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await text(page.locator('main'), 'Изменения подтверждены сервером');
      const event = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Скачать файл ошибок', exact: true })
        .click();
      assert.ok((await event).suggestedFilename().endsWith('.xlsx'));
      await page.goto(origin + '/universities');
      await text(page.locator('main'), 'Вуз из frontend импорта');
    },
  );
  await check(
    'integration states, keyboard search, deep links and mobile layouts',
    async () => {
      await page.goto(origin + '/admin/integrations');
      await text(page.locator('main'), 'LMS ИТ Школы');
      assert.ok(
        await page
          .getByRole('button', { name: 'Запустить синхронизацию', exact: true })
          .first()
          .isDisabled(),
      );
      await page
        .getByRole('button', { name: 'Поиск по вузам и проектам', exact: true })
        .focus();
      await page.keyboard.press('ControlOrMeta+k');
      const search = page.getByRole('dialog', { name: 'Быстрый поиск' });
      await search.getByRole('combobox').fill('FRONTEND-42');
      await visible(
        search.getByRole('option', {
          name: 'Защита информационных систем · Тестовый университет',
          exact: true,
        }),
      );
      await search.getByRole('combobox').press('Enter');
      await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
      for (const path of [
        '/',
        '/universities',
        '/projects/' + identities.projectId,
        '/workflow',
        '/reports',
        '/admin/import',
        '/admin/catalogs',
        '/admin/employees',
        '/admin/integrations',
        '/help',
      ]) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + path);
        await visible(page.locator('main h1'));
        await page.waitForFunction(
          () =>
            ![...document.querySelectorAll('.state-panel h2')].some(
              (heading) => heading.textContent === 'Загрузка…',
            ),
        );
        assert.equal(
          await page
            .getByText('Не удалось загрузить данные', { exact: true })
            .count(),
          0,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          'Mobile overflow: ' + path,
        );
      }
      await page.goto(origin + '/');
      await text(page.locator('.glass-metrics'), 'Вузы-партнёры');
      for (const [title, selector] of [
        ['События', '.attention-activity'],
        ['Шаги', '.dashboard-side-column'],
        ['Связи', '.collaboration-map'],
        ['Статусы', '.dashboard-project-summary'],
        ['Задачи', '.attention-center'],
      ]) {
        await page
          .locator('.dashboard-mobile-sections')
          .getByRole('button', { name: title, exact: true })
          .click();
        await visible(page.locator(selector));
      }
      await capture(page, {
        path: '/artifacts/dashboard-mobile.png',
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Меню', exact: true }).click();
      await visible(page.locator('.sidebar.mobile-open'));
      await page
        .locator('.sidebar')
        .getByRole('link', { name: 'Вузы', exact: true })
        .click();
      await page.waitForURL(/\/universities$/);
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await check(
    'KAM allowlist visibility and administrator permission management',
    async () => {
      await page.goto(origin + '/admin/employees');
      await page
        .getByLabel('Сотрудник', { exact: true })
        .selectOption(identities.people.kam.subject);
      await visible(page.getByLabel('Режим доступа', { exact: true }));
      await page
        .getByLabel('Режим доступа', { exact: true })
        .selectOption('SELECTED');
      const projectList = page.locator('fieldset').filter({
        has: page.locator('legend', { hasText: 'Разрешённые проекты' }),
      });
      await visible(projectList.getByRole('checkbox').first());
      await projectList.getByRole('checkbox').first().check();
      await page
        .getByRole('button', { name: 'Сохранить доступ', exact: true })
        .click();
      await text(page.locator('main'), 'Готово');
      await capture(page, {
        path: '/artifacts/administration-desktop.png',
        fullPage: true,
      });
      const kam = await login('kam');
      await kam.page.goto(origin + '/projects');
      await visible(kam.page.locator('table'));
      assert.equal(await kam.page.locator('tbody tr').count(), 1);
      await kam.page.goto(origin + '/admin/employees');
      await text(kam.page.locator('main'), 'Доступ ограничен');
      assert.equal(
        await responseStatus(
          kam,
          '/api/projects/' + identities.hiddenProjectId,
        ),
        404,
      );
      await kam.context.close();
      const permission = page
        .locator('.permission-row')
        .filter({ hasText: 'Просмотр отчётов' });
      await permission.getByRole('combobox').selectOption('30');
      await permission
        .getByRole('button', { name: 'Сохранить', exact: true })
        .click();
      const supervisor = await login('supervisor');
      await supervisor.page.goto(origin + '/reports');
      await text(supervisor.page.locator('main'), 'Статистика проектов');
      assert.equal(
        await supervisor.page
          .getByRole('button', { name: 'Конструктор', exact: true })
          .count(),
        0,
      );
      assert.equal(
        await responseStatus(supervisor, '/api/reports/projects'),
        403,
      );
      await supervisor.context.close();
      await permission.getByRole('combobox').selectOption('20');
      await permission
        .getByRole('button', { name: 'Сохранить', exact: true })
        .click();
    },
  );
  await check('logout clears protected screen and client session', async () => {
    await page
      .locator('.sidebar')
      .getByRole('button', { name: 'Выйти', exact: true })
      .click();
    await visible(
      page.getByRole('heading', { name: 'Вход в ИТ Школу', exact: true }),
    );
    assert.equal(await page.locator('.sidebar').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => Object.keys(sessionStorage)),
      [],
    );
  });
  assert.deepEqual(failures, []);
  await writeFile(
    '/artifacts/result.json',
    JSON.stringify({ checks, pageErrors: failures }, null, 2),
  );
} catch (error) {
  const message = String(error.message ?? error).replace(
    /Bearer\s+[\w.-]+/gi,
    'Bearer [redacted]',
  );
  if (admin)
    await admin.page
      .screenshot({ path: '/artifacts/failure.png', fullPage: true })
      .catch(() => {});
  await writeFile(
    '/artifacts/result.json',
    JSON.stringify(
      {
        checks,
        pageErrors: failures,
        failedStep: currentCheck,
        failed: message,
      },
      null,
      2,
    ),
  );
  throw new Error(message);
} finally {
  await browser.close();
}
