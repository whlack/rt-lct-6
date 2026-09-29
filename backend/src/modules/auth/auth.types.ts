export interface VisibilityPolicy {
  mode: 'ASSIGNED' | 'ALL' | 'SELECTED';
  universityIds: string[];
  projectIds: string[];
}
export interface AuthUser {
  id: string;
  subject: string;
  level: 10 | 20 | 30;
  email?: string;
  name?: string;
  visibility?: VisibilityPolicy;
}

export interface AuthRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

export function currentUser(request: AuthRequest): AuthUser {
  if (!request.user) throw new Error('Authenticated route has no user');
  return request.user;
}
