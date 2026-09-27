export interface AuthUser {
  id: string;
  subject: string;
  level: 10 | 20 | 30;
  email?: string;
  name?: string;
}

export interface AuthRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

export function currentUser(request: AuthRequest): AuthUser {
  if (!request.user) throw new Error('Authenticated route has no user');
  return request.user;
}
