// Deliberately weak demo credentials: this file is mounted only by the local launcher.
const accounts = [
  { username: 'kam', firstName: 'Тестовый', lastName: 'КАМ' },
  { username: 'supervisor', firstName: 'Тестовый', lastName: 'Руководитель' },
  { username: 'admin', firstName: 'Тестовый', lastName: 'Администратор' },
];
const marker = 'rt-crm.local-demo';
const base = process.env.KEYCLOAK_INTERNAL_URL;

if (
  process.env.LOCAL_DEMO_USERS_SEED !== '1' ||
  process.env.NODE_ENV !== 'development' ||
  !base ||
  new URL(base).hostname !== 'keycloak'
) {
  throw new Error(
    'Demo users can only be seeded in the local development stack',
  );
}

const tokenResponse = await fetch(
  `${base}/realms/master/protocol/openid-connect/token`,
  {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: process.env.KEYCLOAK_ADMIN,
      password: process.env.KEYCLOAK_ADMIN_PASSWORD,
    }),
  },
);
if (!tokenResponse.ok)
  throw new Error(`Keycloak admin login failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();
if (typeof token !== 'string') throw new Error('Keycloak admin token missing');
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
};

async function request(path, options = {}) {
  const response = await fetch(`${base}/admin/realms/crm${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Keycloak setup ${path} failed: ${response.status}`);
  return response;
}

async function findOne(path, key, value) {
  const items = await (await request(path)).json();
  const matches = items.filter((item) => item[key] === value);
  if (matches.length > 1)
    throw new Error(`Duplicate Keycloak ${key}: ${value}`);
  return matches[0];
}

const plans = [];
for (const account of accounts) {
  const { username } = account;
  const groupPath = `/groups?search=${encodeURIComponent(username)}&exact=true&briefRepresentation=false`;
  const userPath = `/users?username=${encodeURIComponent(username)}&exact=true`;
  const group = await findOne(groupPath, 'name', username);
  const user = await findOne(userPath, 'username', username);
  // Refuse to take over an existing name: changing its group could grant CRM access.
  if (group && !group.attributes?.[marker]?.includes('true')) {
    throw new Error(`Group ${username} already exists outside the local seed`);
  }
  // Keycloak's default user profile discards unmanaged attributes, so the
  // reserved example.test address identifies accounts this seed may revisit.
  if (user && user.email !== `${username}@example.test`) {
    throw new Error(`User ${username} already exists outside the local seed`);
  }
  const role = await (await request(`/roles/${username}`)).json();
  plans.push({ account, group, groupPath, user, userPath, role });
}

for (const {
  account,
  group: priorGroup,
  groupPath,
  user: priorUser,
  userPath,
  role,
} of plans) {
  const { username } = account;
  if (!priorGroup) {
    await request('/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: username,
      }),
    });
  }
  const group = await findOne(groupPath, 'name', username);
  if (!group?.id) throw new Error(`Group ${username} was not created`);
  const mappingPath = `/groups/${group.id}/role-mappings/realm`;
  const mapped = await (await request(mappingPath)).json();
  if (mapped.some((entry) => entry.name !== username)) {
    throw new Error(`Group ${username} has unexpected realm roles`);
  }
  if (!mapped.some((entry) => entry.id === role.id)) {
    await request(mappingPath, {
      method: 'POST',
      body: JSON.stringify([role]),
    });
  }

  if (!priorUser) {
    await request('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...account,
        email: `${username}@example.test`,
        emailVerified: true,
        enabled: true,
        attributes: { [marker]: ['true'] },
        credentials: [{ type: 'password', value: username, temporary: false }],
      }),
    });
  }
  const user = await findOne(userPath, 'username', username);
  if (!user?.id) throw new Error(`User ${username} was not created`);
  const memberships = await (await request(`/users/${user.id}/groups`)).json();
  if (!memberships.some((entry) => entry.id === group.id)) {
    await request(`/users/${user.id}/groups/${group.id}`, { method: 'PUT' });
  }
  // The CRM directory uses Keycloak's role members endpoint, which only lists
  // directly mapped users; group inheritance alone does not populate it.
  const userMappingPath = `/users/${user.id}/role-mappings/realm`;
  const directRoles = await (await request(userMappingPath)).json();
  if (!directRoles.some((entry) => entry.id === role.id)) {
    await request(userMappingPath, {
      method: 'POST',
      body: JSON.stringify([role]),
    });
  }
  // Existing passwords are never reset on repeat starts; local manual changes survive.
  console.info(`Local demo account ready: ${username}`);
}
