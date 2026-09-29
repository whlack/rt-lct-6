import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface Employee {
  subject: string;
  email: string;
  name: string;
}

interface AdminUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

function isAdminUser(value: unknown): value is AdminUser {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string'
  )
    return false;
  return (
    ['email', 'firstName', 'lastName'].every(
      (key) => !(key in value) || typeof Reflect.get(value, key) === 'string',
    ) &&
    (!('enabled' in value) || typeof value.enabled === 'boolean')
  );
}

@Injectable()
export class KeycloakDirectoryAdapter {
  private readonly base =
    process.env.KEYCLOAK_INTERNAL_URL ?? 'http://keycloak:8080';

  async findEmail(email: string): Promise<Employee[]> {
    const token = await this.serviceToken();
    const matches = new Map<string, Employee>();
    for (let first = 0; first < 100000; first += 100) {
      const query = new URLSearchParams({
        email,
        exact: 'true',
        first: String(first),
        max: '100',
      });
      const response = await fetch(
        `${this.base}/admin/realms/crm/users?${query}`,
        {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new ServiceUnavailableException('Keycloak directory unavailable');
      const users: unknown = await response.json();
      if (!Array.isArray(users) || !users.every(isAdminUser))
        throw new ServiceUnavailableException('Invalid directory response');
      for (const user of users) {
        if (
          user.id &&
          user.email?.toLowerCase() === email.toLowerCase() &&
          user.enabled !== false
        ) {
          matches.set(user.id, {
            subject: user.id,
            email: user.email,
            name:
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.email,
          });
        }
      }
      if (users.length < 100) return [...matches.values()];
    }
    throw new ServiceUnavailableException(
      'Directory pagination limit exceeded',
    );
  }

  async identity(
    subject: string,
  ): Promise<{ enabled: boolean; roles: string[] }> {
    const token = await this.serviceToken();
    const headers = { authorization: `Bearer ${token}` };
    const [profile, mappings] = await Promise.all([
      fetch(
        `${this.base}/admin/realms/crm/users/${encodeURIComponent(subject)}`,
        { headers, signal: AbortSignal.timeout(10000) },
      ),
      fetch(
        `${this.base}/admin/realms/crm/users/${encodeURIComponent(subject)}/role-mappings/realm/composite`,
        { headers, signal: AbortSignal.timeout(10000) },
      ),
    ]);
    if (profile.status === 404) return { enabled: false, roles: [] };
    if (!profile.ok || !mappings.ok)
      throw new ServiceUnavailableException('Keycloak directory unavailable');
    const user: unknown = await profile.json();
    const roles: unknown = await mappings.json();
    if (!isAdminUser(user) || !Array.isArray(roles))
      throw new ServiceUnavailableException('Invalid directory response');
    return {
      enabled: user.enabled !== false,
      roles: roles.flatMap((role: unknown) =>
        typeof role === 'object' &&
        role !== null &&
        'name' in role &&
        typeof role.name === 'string'
          ? [role.name]
          : [],
      ),
    };
  }

  private async serviceToken(): Promise<string> {
    const clientId = process.env.KEYCLOAK_SERVICE_CLIENT_ID ?? 'crm-directory';
    const secret = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
    if (!secret)
      throw new Error('Keycloak directory service secret is required');
    const response = await fetch(
      `${this.base}/realms/crm/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: secret,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('Keycloak directory unavailable');
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('access_token' in body) ||
      typeof body.access_token !== 'string'
    ) {
      throw new ServiceUnavailableException('Keycloak token response invalid');
    }
    return body.access_token;
  }

  private async listRole(roleName: string): Promise<Employee[]> {
    try {
      const token = await this.serviceToken();
      const role = encodeURIComponent(roleName);
      const people = new Map<string, Employee>();
      for (let first = 0; first < 100000; first += 100) {
        const response = await fetch(
          `${this.base}/admin/realms/crm/roles/${role}/users?first=${first}&max=100`,
          {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) throw new Error('Directory request failed');
        const body: unknown = await response.json();
        if (!Array.isArray(body) || !body.every(isAdminUser))
          throw new Error('Directory response invalid');
        for (const user of body) {
          if (user.id && user.email && user.enabled !== false)
            people.set(user.id, {
              subject: user.id,
              email: user.email,
              name:
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                user.email,
            });
        }
        if (body.length < 100) return [...people.values()];
      }
      throw new Error('Directory pagination limit exceeded');
    } catch {
      throw new ServiceUnavailableException('Keycloak directory unavailable');
    }
  }

  listKam(): Promise<Employee[]> {
    return this.listRole(process.env.KEYCLOAK_KAM_ROLE ?? 'kam');
  }

  async listManagers(): Promise<Employee[]> {
    const [supervisors, administrators] = await Promise.all([
      this.listRole(process.env.KEYCLOAK_SUPERVISOR_ROLE ?? 'supervisor'),
      this.listRole(process.env.KEYCLOAK_ADMIN_ROLE ?? 'admin'),
    ]);
    return [
      ...new Map(
        [...supervisors, ...administrators].map((person) => [
          person.subject,
          person,
        ]),
      ).values(),
    ];
  }

  async isManager(subject: string): Promise<boolean> {
    return (await this.listManagers()).some(
      (employee) => employee.subject === subject,
    );
  }

  async isKam(subject: string): Promise<boolean> {
    return (await this.listKam()).some(
      (employee) => employee.subject === subject,
    );
  }
}
