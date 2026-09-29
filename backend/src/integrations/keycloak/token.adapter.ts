import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { keycloakRealmPath } from '../../config/keycloak.js';

export interface RealmPayload extends JWTPayload {
  azp?: string;
  email?: string;
  name?: string;
  realm_access?: { roles?: string[] };
}

@Injectable()
export class KeycloakTokenAdapter {
  private readonly publicUrl = process.env.KEYCLOAK_PUBLIC_URL;
  private readonly clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'crm-web';
  private readonly realmPath = keycloakRealmPath();
  private readonly jwks = createRemoteJWKSet(
    new URL(
      `${process.env.KEYCLOAK_INTERNAL_URL ?? 'http://keycloak:8080'}/realms/${this.realmPath}/protocol/openid-connect/certs`,
    ),
  );

  async verify(token: string): Promise<RealmPayload> {
    if (!this.publicUrl) {
      throw new Error('KEYCLOAK_PUBLIC_URL is required');
    }
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${this.publicUrl}/realms/${this.realmPath}`,
      });
      if (payload.azp !== this.clientId || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid token client or subject');
      }
      const roles = payload.realm_access;
      if (
        roles !== undefined &&
        (typeof roles !== 'object' ||
          roles === null ||
          !('roles' in roles) ||
          !Array.isArray(roles.roles))
      ) {
        throw new UnauthorizedException('Invalid realm roles');
      }
      return payload as RealmPayload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
