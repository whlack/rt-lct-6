import { lazy, Suspense, Component, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useParams,
} from 'react-router-dom';
import { SessionProvider, useSession, Access } from '../features/session';
import { JobQueueProvider } from '../entities/job';
import { JobQueue } from '../widgets/job-queue';
import { WorkspaceShell } from '../widgets/workspace-shell';
import { LoginPage } from '../pages/login';
import { State } from '../shared/ui';
import { ApiError } from '../shared/api';
const Dashboard = lazy(() =>
  import('../pages/dashboard').then((module) => ({
    default: module.DashboardPage,
  })),
);
const Universities = lazy(() =>
  import('../pages/universities').then((module) => ({
    default: module.UniversitiesPage,
  })),
);
const University = lazy(() =>
  import('../pages/university').then((module) => ({
    default: module.UniversityPage,
  })),
);
const Projects = lazy(() =>
  import('../pages/projects').then((module) => ({
    default: module.ProjectsPage,
  })),
);
const Project = lazy(() =>
  import('../pages/project').then((module) => ({
    default: module.ProjectPage,
  })),
);
const Workflow = lazy(() =>
  import('../pages/workflow').then((module) => ({
    default: module.WorkflowPage,
  })),
);
const Reports = lazy(() =>
  import('../pages/reports').then((module) => ({
    default: module.ReportsPage,
  })),
);
const Import = lazy(() =>
  import('../pages/import').then((module) => ({ default: module.ImportPage })),
);
const Catalogs = lazy(() =>
  import('../pages/catalogs').then((module) => ({
    default: module.CatalogsPage,
  })),
);
const Employees = lazy(() =>
  import('../pages/employees').then((module) => ({
    default: module.EmployeesPage,
  })),
);
const Integrations = lazy(() =>
  import('../pages/integrations').then((module) => ({
    default: module.IntegrationsPage,
  })),
);
const Help = lazy(() =>
  import('../pages/help').then((module) => ({ default: module.HelpPage })),
);
const Status = lazy(() =>
  import('../pages/status').then((module) => ({ default: module.StatusPage })),
);
const cache = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <State
        title="Не удалось открыть интерфейс"
        retry={() => location.reload()}
      >
        Обновите страницу. Несохранённые изменения могут быть потеряны.
      </State>
    ) : (
      this.props.children
    );
  }
}
function LegacyProject() {
  return <Navigate replace to={`/projects/${useParams().id}`} />;
}
function AuthenticatedApp() {
  const { user, authenticated, can } = useSession();
  if (!authenticated) return <LoginPage />;
  return (
    <JobQueueProvider key={user?.subject}>
      <BrowserRouter>
        <Suspense fallback={<State title="Загрузка раздела…" />}>
          <Routes>
            <Route element={<WorkspaceShell queue={<JobQueue />} />}>
              <Route
                index
                element={
                  <Access permission="dashboard.read">
                    <Dashboard />
                  </Access>
                }
              />
              <Route
                path="universities"
                element={
                  <Access permission="universities.read">
                    <Universities />
                  </Access>
                }
              />
              <Route
                path="universities/:id"
                element={
                  <Access permission="universities.read">
                    <University />
                  </Access>
                }
              />
              <Route
                path="projects"
                element={
                  <Access permission="projects.read">
                    <Projects />
                  </Access>
                }
              />
              <Route
                path="projects/:id"
                element={
                  <Access permission="projects.read">
                    <Project />
                  </Access>
                }
              />
              <Route path="programs/:id" element={<LegacyProject />} />
              <Route
                path="workflow"
                element={
                  <Access permission="projects.read">
                    <Workflow />
                  </Access>
                }
              />
              <Route
                path="reports"
                element={
                  can('reports.read') || can('statistics.read') ? (
                    <Reports />
                  ) : (
                    <State title="Доступ ограничен" />
                  )
                }
              />
              <Route
                path="admin/import"
                element={
                  <Access permission="catalogs.import">
                    <Import />
                  </Access>
                }
              />
              <Route
                path="admin/catalogs"
                element={
                  <Access permission="catalogs.read">
                    <Catalogs />
                  </Access>
                }
              />
              <Route
                path="admin/employees"
                element={
                  can('permissions.manage') || can('visibility.manage') ? (
                    <Employees />
                  ) : (
                    <State title="Доступ ограничен" />
                  )
                }
              />
              <Route
                path="admin/integrations"
                element={
                  <Access permission="integrations.manage">
                    <Integrations />
                  </Access>
                }
              />
              <Route path="help" element={<Help />} />
              <Route
                path="auth/callback"
                element={<Navigate to="/" replace />}
              />
              <Route
                path="*"
                element={
                  <State title="Страница не найдена">
                    <Link className="text-link" to="/">
                      На главную
                    </Link>
                  </State>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </JobQueueProvider>
  );
}
export function App() {
  return (
    <QueryClientProvider client={cache}>
      <Boundary>
        {location.pathname === '/status' ? (
          <Suspense fallback={<State title="Загрузка…" />}>
            <Status />
          </Suspense>
        ) : (
          <SessionProvider>
            <AuthenticatedApp />
          </SessionProvider>
        )}
      </Boundary>
    </QueryClientProvider>
  );
}
