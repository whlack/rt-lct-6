export type Cell = string | number | boolean | null;
export interface TableSection {
  title: string;
  columns: string[];
  rows: Cell[][];
}
export interface TableDocument {
  title: string;
  generatedAt: string;
  timezone: string;
  sections: TableSection[];
}
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
