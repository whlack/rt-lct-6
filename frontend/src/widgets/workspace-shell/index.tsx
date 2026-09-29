import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../features/session';
import { CommandPalette } from '../../features/global-search';
import { employeeName } from '../../shared/lib';
import { LineIcon } from '../../shared/ui';
const links = [
  ['/', 'Главная', 'dashboard.read', 'dashboard'],
  ['/universities', 'Вузы', 'universities.read', 'universities'],
  ['/projects', 'Проекты', 'projects.read', 'project'],
  ['/workflow', 'Процессы', 'projects.read', 'workflow'],
  ['/reports', 'Отчёты', 'reports.read', 'reports'],
  ['/admin/catalogs', 'Каталоги', 'catalogs.read', 'document'],
  ['/admin/import', 'Импорт', 'catalogs.import', 'import'],
  ['/admin/employees', 'Сотрудники', '', 'people'],
  ['/admin/integrations', 'Интеграции', 'integrations.manage', 'integrations'],
  ['/help', 'Справка', '', 'help'],
];
export function WorkspaceShell({ queue }: { queue: ReactNode }) {
  const { user, can, logout } = useSession();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('crm-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const location = useLocation();
  useEffect(() => {
    try {
      localStorage.setItem('crm-theme', theme);
    } catch {
      /* Theme is optional when storage is unavailable. */
    }
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearch((value) => !value);
      }
      if (event.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const visible = links
    .filter(([path, , permission]) =>
      path === '/admin/employees'
        ? can('permissions.manage') || can('visibility.manage')
        : path === '/reports'
          ? can('reports.read') || can('statistics.read')
          : !permission || can(permission),
    )
    .map((item) =>
      item[0] === '/reports' && !can('reports.read')
        ? [item[0], 'Статистика', item[2], item[3]]
        : item,
    );
  return (
    <div
      className={`app-shell design-glass mode-${theme} production-shell ${collapsed ? 'rail-collapsed' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <div className="atmosphere" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <aside
        className={`sidebar ${menu ? 'mobile-open' : ''}`}
        aria-label="Основная навигация"
      >
        <NavLink className="brand-lockup" to="/" onClick={() => setMenu(false)}>
          <span className="glass-brand">
            <img
              src={`/brand/${theme === 'dark' ? 'rt-logo-mono.png' : 'rt-logo.png'}`}
              alt="Ростелеком"
            />
            <small>ИТ Школа</small>
          </span>
        </NavLink>
        <button
          className="rail-toggle icon-button"
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? '→' : '←'}
        </button>
        <p className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav className="workspace-navigation">
          {visible.map(([path, title, , icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={title}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'is-active' : ''}`
              }
            >
              <span className="nav-icon">
                <LineIcon name={icon} />
              </span>
              <span className="nav-label">{title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-profile">
          <span className="avatar">{employeeName(user).slice(0, 1)}</span>
          <span className="sidebar-profile-copy">
            <strong>{employeeName(user)}</strong>
            <small>
              {user?.level === 30
                ? 'Администратор'
                : user?.level === 20
                  ? 'Руководитель КАМ'
                  : 'КАМ'}
            </small>
          </span>
        </div>
        <button
          className="button"
          onClick={() => {
            void logout().catch(() =>
              setError('Не удалось завершить выход. Повторите.'),
            );
          }}
        >
          Выйти
        </button>
      </aside>
      <div className="workspace-shell">
        <header className="topbar">
          <button
            className="button mobile-toggle"
            onClick={() => setMenu((value) => !value)}
            aria-expanded={menu}
          >
            Меню
          </button>
          <button
            className="global-search"
            aria-label="Поиск по вузам и проектам"
            onClick={() => setSearch(true)}
          >
            <LineIcon name="search" />
            <span>Поиск по вузам и проектам…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <NavLink
              className="icon-button help-button"
              to="/help"
              aria-label="Справка"
            >
              <LineIcon name="help" />
            </NavLink>
            <button
              className="icon-button"
              aria-label={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
              onClick={() =>
                setTheme((value) => (value === 'light' ? 'dark' : 'light'))
              }
            >
              <LineIcon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${location.pathname === '/' ? 'dashboard-main' : ''}`}
          key={location.pathname}
        >
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Outlet />
          {queue}
        </main>
        <footer className="workspace-footer">ИТ Школа Ростелекома · CRM</footer>
      </div>
      {search && (
        <CommandPalette
          sections={visible.map(([path, title, , icon]) => ({
            path,
            title,
            icon,
          }))}
          onClose={() => setSearch(false)}
        />
      )}
    </div>
  );
}
