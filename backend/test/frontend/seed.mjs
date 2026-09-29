import { writeFile } from 'node:fs/promises';
import { DatabaseService } from '../../src/database/database.service.ts';
import { ProjectRepository } from '../../src/modules/projects/repositories/project.repository.ts';
import { DEFAULT_STAGES } from '../../src/modules/projects/services/project.service.ts';
if (process.env.ACCEPTANCE_ISOLATED !== '1')
  throw new Error('Disposable stack required');
const keycloak = 'http://keycloak:8080';
async function request(path, init = {}) {
  const response = await fetch(keycloak + path, init);
  if (!response.ok) throw new Error('Fixture setup failed: ' + response.status);
  return response;
}
const token = await (
  await request('/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: process.env.KEYCLOAK_ADMIN,
      password: process.env.KEYCLOAK_ADMIN_PASSWORD,
    }),
  })
).json();
const headers = {
  authorization: 'Bearer ' + token.access_token,
  'content-type': 'application/json',
};
const db = new DatabaseService();
try {
  const people = {};
  for (const role of ['admin', 'supervisor', 'kam', 'outsider']) {
    const username = 'frontend-' + role;
    await request('/admin/realms/crm/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username,
        enabled: true,
        emailVerified: true,
        firstName: 'Тест',
        lastName: role,
        email: username + '@example.test',
        credentials: [
          {
            type: 'password',
            value: 'frontend-test-password-1',
            temporary: false,
          },
        ],
      }),
    });
    const [user] = await (
      await request(
        '/admin/realms/crm/users?username=' + username + '&exact=true',
        { headers },
      )
    ).json();
    const realmRole = await (
      await request(
        '/admin/realms/crm/roles/' + (role === 'outsider' ? 'kam' : role),
        { headers },
      )
    ).json();
    await request(
      '/admin/realms/crm/users/' + user.id + '/role-mappings/realm',
      { method: 'POST', headers, body: JSON.stringify([realmRole]) },
    );
    const record = await db.prisma.user.create({
      data: {
        keycloakSubject: user.id,
        email: username + '@example.test',
        displayName: 'Тест ' + role,
      },
    });
    people[role] = { id: record.id, subject: user.id };
  }
  const direction = await db.prisma.direction.create({
    data: { name: 'Информационная безопасность' },
  });
  const program = await db.prisma.program.create({
    data: { name: 'Защита информационных систем' },
  });
  const product = await db.prisma.product.create({
    data: { name: 'Учебный продукт' },
  });
  const university = await db.prisma.university.create({
    data: {
      name: 'Тестовый университет',
      createdById: people.admin.id,
      assignments: { create: { userId: people.kam.id } },
    },
  });
  const hiddenUniversity = await db.prisma.university.create({
    data: { name: 'Закрытый университет', createdById: people.admin.id },
  });
  const repository = new ProjectRepository(db);
  const project = await repository.create(
    {
      universityId: university.id,
      directionId: direction.id,
      programId: program.id,
      responsibleId: people.kam.id,
      createdById: people.admin.id,
    },
    DEFAULT_STAGES,
    people.admin.id,
  );
  const hiddenProject = await repository.create(
    {
      universityId: hiddenUniversity.id,
      directionId: direction.id,
      productId: product.id,
      responsibleId: people.outsider.id,
      createdById: people.admin.id,
    },
    DEFAULT_STAGES,
    people.admin.id,
  );
  await writeFile(
    '/artifacts/identities.json',
    JSON.stringify({
      people,
      directionId: direction.id,
      programId: program.id,
      universityId: university.id,
      projectId: project.id,
      hiddenProjectId: hiddenProject.id,
    }),
  );
  console.log('Frontend fixture prepared');
} finally {
  await db.onModuleDestroy();
}
