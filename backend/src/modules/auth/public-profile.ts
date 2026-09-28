export function publicProfile<
  T extends { displayName: string | null; displayNameOverride: string | null },
>(user: T): Omit<T, 'displayNameOverride'> {
  const { displayNameOverride, ...profile } = user;
  return { ...profile, displayName: displayNameOverride ?? user.displayName };
}
