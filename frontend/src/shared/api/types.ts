export interface Named {
  id: string;
  name: string;
}
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
