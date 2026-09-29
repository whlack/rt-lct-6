export function keycloakRealm(): string {
  const realm = process.env.KEYCLOAK_REALM ?? 'crm';
  if (!realm || realm.trim() !== realm || realm.includes('/')) {
    throw new Error(
      'KEYCLOAK_REALM must be a non-empty realm name without slashes',
    );
  }
  return realm;
}

export function keycloakRealmPath(): string {
  return encodeURIComponent(keycloakRealm());
}
