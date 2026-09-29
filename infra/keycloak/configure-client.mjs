const server = process.env.KEYCLOAK_INTERNAL_URL;
const clientId = process.env.KEYCLOAK_CLIENT_ID;
const origin = process.env.FRONTEND_ORIGIN;
const username = process.env.KEYCLOAK_ADMIN;
const password = process.env.KEYCLOAK_ADMIN_PASSWORD;
const directoryId = process.env.KEYCLOAK_SERVICE_CLIENT_ID ?? 'crm-directory';
const directorySecret = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;

if (
  !server ||
  !clientId ||
  !origin ||
  !username ||
  !password ||
  !directorySecret ||
  directoryId === clientId
) {
  throw new Error('Keycloak client configuration is incomplete');
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`Keycloak setup request failed: ${response.status}`);
  return response;
}

async function configure() {
  const tokenResponse = await request(
    `${server}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username,
        password,
      }),
    },
  );
  if (!tokenResponse.ok)
    throw new Error(`Keycloak admin login failed: ${tokenResponse.status}`);
  const token = (await tokenResponse.json()).access_token;
  if (typeof token !== 'string')
    throw new Error('Keycloak admin token missing');
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const listResponse = await request(
    `${server}/admin/realms/crm/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers },
  );
  if (!listResponse.ok)
    throw new Error(`Keycloak client lookup failed: ${listResponse.status}`);
  const clients = await listResponse.json();
  if (!Array.isArray(clients)) throw new Error('Keycloak client list invalid');
  const existing = clients.find((client) => client.clientId === clientId);
  const client = {
    ...existing,
    clientId,
    enabled: true,
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [`${origin}/*`],
    webOrigins: [origin],
    attributes: {
      ...existing?.attributes,
      'pkce.code.challenge.method': 'S256',
    },
  };
  const url = existing?.id
    ? `${server}/admin/realms/crm/clients/${existing.id}`
    : `${server}/admin/realms/crm/clients`;
  const response = await request(url, {
    method: existing?.id ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(client),
  });
  if (!response.ok)
    throw new Error(`Keycloak client configuration failed: ${response.status}`);
  // Administrative credentials are used only by this one-shot bootstrap container.
  const directoryList = await request(
    `${server}/admin/realms/crm/clients?clientId=${encodeURIComponent(directoryId)}`,
    { headers },
  );
  const directoryClients = await directoryList.json();
  const existingDirectory = directoryClients.find(
    (item) => item.clientId === directoryId,
  );
  const serviceClient = {
    ...existingDirectory,
    clientId: directoryId,
    enabled: true,
    publicClient: false,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    fullScopeAllowed: false,
    secret: directorySecret,
    redirectUris: [],
    webOrigins: [],
  };
  await request(
    `${server}/admin/realms/crm/clients${existingDirectory ? '/' + existingDirectory.id : ''}`,
    {
      method: existingDirectory ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(serviceClient),
    },
  );
  const service = (
    await (
      await request(
        `${server}/admin/realms/crm/clients?clientId=${encodeURIComponent(directoryId)}`,
        { headers },
      )
    ).json()
  ).find((item) => item.clientId === directoryId);
  const management = (
    await (
      await request(
        `${server}/admin/realms/crm/clients?clientId=realm-management`,
        { headers },
      )
    ).json()
  )[0];
  const serviceUser = await (
    await request(
      `${server}/admin/realms/crm/clients/${service.id}/service-account-user`,
      { headers },
    )
  ).json();
  const roles = await (
    await request(`${server}/admin/realms/crm/clients/${management.id}/roles`, {
      headers,
    })
  ).json();
  // Keycloak checks view-realm when enumerating members of a realm role. No manage-* rights are granted.
  const allowed = roles.filter((role) =>
    ['view-users', 'query-users', 'view-realm'].includes(role.name),
  );
  if (allowed.length !== 3) throw new Error('Keycloak directory roles missing');
  for (const mapping of [
    `users/${serviceUser.id}/role-mappings/clients/${management.id}`,
    `clients/${service.id}/scope-mappings/clients/${management.id}`,
  ]) {
    const url = `${server}/admin/realms/crm/${mapping}`;
    const previous = await (await request(url, { headers })).json();
    const extra = previous.filter(
      (role) => !allowed.some((item) => item.id === role.id),
    );
    if (extra.length)
      await request(url, {
        method: 'DELETE',
        headers,
        body: JSON.stringify(extra),
      });
    await request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(allowed),
    });
  }
  console.info('Keycloak web and read-only directory clients configured.');
}

for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    await configure();
    process.exit(0);
  } catch (error) {
    if (attempt === 29) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
