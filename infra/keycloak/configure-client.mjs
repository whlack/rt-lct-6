const server = process.env.KEYCLOAK_INTERNAL_URL;
const clientId = process.env.KEYCLOAK_CLIENT_ID;
const origin = process.env.FRONTEND_ORIGIN;
const username = process.env.KEYCLOAK_ADMIN;
const password = process.env.KEYCLOAK_ADMIN_PASSWORD;

if (!server || !clientId || !origin || !username || !password) {
  throw new Error('Keycloak client configuration is incomplete');
}

async function configure() {
  const tokenResponse = await fetch(
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
  const listResponse = await fetch(
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
  const response = await fetch(url, {
    method: existing?.id ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(client),
  });
  if (!response.ok)
    throw new Error(`Keycloak client configuration failed: ${response.status}`);
  console.info(`Keycloak public client ${clientId} configured for ${origin}`);
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
