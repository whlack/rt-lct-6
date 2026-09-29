import Keycloak from 'keycloak-js';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { configureSession, ApiError } from '../../shared/api';
import { sessionApi } from '../../entities/session';
import { QueryState, State } from '../../shared/ui';
import { SessionContext, useSession, type Session } from '../../shared/session';
export { useSession } from '../../shared/session';
let initializing: Promise<Keycloak> | undefined;
function initialize() {
  // The adapter must initialize once, before the router handles OIDC callback parameters.
  initializing ??= sessionApi
    .config()
    .then(async (config) => {
      const client = new Keycloak(config.keycloak);
      await client.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      });
      return client;
    })
    .catch((error) => {
      initializing = undefined;
      throw error;
    });
  return initializing;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [client, setClient] = useState<Keycloak>();
  const [error, setError] = useState<Error>();
  const [authenticated, setAuthenticated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void initialize()
      .then((adapter) => {
        if (!active) return;
        const expire = () => {
          cache.clear();
          setAuthenticated(false);
          adapter.clearToken();
        };
        adapter.onAuthLogout = expire;
        adapter.onAuthRefreshError = expire;
        configureSession(async () => {
          try {
            await adapter.updateToken(30);
          } catch {
            expire();
            throw new ApiError(401, 'Сессия завершена. Войдите снова.');
          }
          if (!adapter.token) throw new ApiError(401, 'Войдите в приложение.');
          return adapter.token;
        }, expire);
        setClient(adapter);
        setAuthenticated(Boolean(adapter.authenticated));
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason : new Error('Не удалось войти.'),
          );
      });
    return () => {
      active = false;
      configureSession(undefined);
    };
  }, [cache, attempt]);
  const profile = useQuery({
    queryKey: ['session'],
    queryFn: ({ signal }) => sessionApi.me(signal),
    enabled: authenticated,
    refetchInterval: 60_000,
  });
  const policy = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!profile.data) return;
    const snapshot = JSON.stringify({
      subject: profile.data.subject,
      level: profile.data.level,
      permissions: profile.data.permissions,
      visibility: profile.data.visibility,
    });
    if (policy.current && policy.current !== snapshot) {
      // Losing scope must discard old results, not retain them behind a failed background refetch.
      void cache.resetQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      });
    }
    policy.current = snapshot;
  }, [cache, profile.data]);
  if (error)
    return (
      <div className="login-screen design-glass">
        <State
          title="Не удалось подключиться"
          retry={() => {
            setError(undefined);
            setAttempt((value) => value + 1);
          }}
        >
          {error.message}
        </State>
      </div>
    );
  if (!client)
    return (
      <div className="login-screen design-glass">
        <State title="Подключение к ИТ Школе…" />
      </div>
    );
  if (authenticated && !profile.data)
    return (
      <div className="login-screen design-glass">
        <QueryState query={profile} />
        {profile.isError && (
          <button
            className="button"
            onClick={() => {
              void client
                .logout({ redirectUri: location.origin })
                .catch((reason) =>
                  setError(
                    reason instanceof Error
                      ? reason
                      : new Error('Не удалось выйти.'),
                  ),
                );
            }}
          >
            Выйти из текущей учётной записи
          </button>
        )}
      </div>
    );
  const session: Session = {
    user: authenticated ? profile.data : undefined,
    authenticated,
    can: (permission) =>
      authenticated && Boolean(profile.data?.permissions.includes(permission)),
    login: async () => {
      // Only a same-origin path is restored; tokens never enter persistent storage.
      await client.login({
        redirectUri: location.origin + location.pathname + location.search,
      });
    },
    logout: async () => {
      cache.clear();
      setAuthenticated(false);
      await client.logout({ redirectUri: location.origin });
    },
  };
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
export function Access({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { can } = useSession();
  return can(permission) ? (
    children
  ) : (
    <State title="Доступ ограничен">
      Для этого раздела нужны дополнительные права.
    </State>
  );
}
