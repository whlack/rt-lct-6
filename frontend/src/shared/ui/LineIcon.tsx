import type { ReactElement } from 'react';
export function LineIcon({ name }: { name: string }): ReactElement {
  const paths: Record<string, string> = {
    dashboard: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
    universities: 'm2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6M22 8v8',
    project: 'M3 7V5h6l2 3h10v12H3V7Zm0 3h18',
    plus: 'M12 5v14M5 12h14',
    document: 'M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8m-8 4h6',
    bell: 'M6 9a6 6 0 0 1 12 0c0 6 3 6 3 8H3c0-2 3-2 3-8Zm4 12h4',
    people:
      'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-3a6 6 0 0 1 12 0v3H3Zm13-16a3 3 0 0 1 0 6m3 10v-3a5 5 0 0 0-3-4',
    workflow:
      'M6 7v10m0-5h12M18 7v10M3 3h6v4H3zM3 17h6v4H3zM15 3h6v4h-6zM15 17h6v4h-6z',
    reports: 'M4 20V10m6 10V4m6 16v-7m5 7H2',
    integrations: 'M8 7h5m-5 5h8m-8 5h8M4 4v16h16V4H4Zm12 8-4 4-3-3',
    calendar: 'M8 3v3m8-3v3M4 8h16M5 5h14v16H5z',
    check: 'm5 12 4 4L19 6',
    comment: 'M4 4h16v12H9l-5 4V4Z',
    help: 'M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    import: 'M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6',
    menu: 'M4 6h16M4 12h16M4 18h16',
    info: 'M12 11v6m0-10h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
    moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    settings:
      'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    mail: 'M3 5h18v14H3V5Zm0 2 9 6 9-6',
    shield:
      'M12 2 4 5v6c0 5 3.3 8.7 8 11 4.7-2.3 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4',
    key: 'M8 14a5 5 0 1 1 4-8l9 9-2 2-2-2-2 2-2-2-2 2-2-2M7 9h.01',
    close: 'M5 5l14 14M19 5 5 19',
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.arrow} />
    </svg>
  );
}
