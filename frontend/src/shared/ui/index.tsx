export { LineIcon } from './LineIcon';
import {
  useEffect,
  useRef,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type FormEvent,
} from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">ИТ Школа · Ростелеком</p>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function State({
  title,
  children,
  retry,
}: {
  title: string;
  children?: ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="state-panel" role="status">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {retry && (
        <button className="button" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}
export function QueryState({
  query,
}: {
  query: Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'refetch'>;
}) {
  if (query.isPending) return <State title="Загрузка…" />;
  if (query.isError)
    return (
      <State
        title="Не удалось загрузить данные"
        retry={() => {
          void query.refetch();
        }}
      >
        {query.error?.message}
      </State>
    );
  return null;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {/* Explicit naming keeps select options out of the accessible field caption. */}
      {isValidElement<{ 'aria-labelledby'?: string }>(children)
        ? cloneElement(children, { 'aria-labelledby': labelId })
        : children}
    </label>
  );
}
export function Submit({
  pending,
  disabled = false,
  children = 'Сохранить',
}: {
  pending: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      className="button button-primary"
      type="submit"
      disabled={pending || disabled}
    >
      {pending ? 'Сохранение…' : children}
    </button>
  );
}
export function ActionState({
  action,
}: {
  action: {
    isPending?: boolean;
    isError: boolean;
    error: Error | null;
    isSuccess: boolean;
  };
}) {
  return (
    <>
      {action.isError && (
        <p className="error-message" role="alert">
          {action.error?.message}
        </p>
      )}
      {action.isSuccess && (
        <p className="success-message" role="status">
          Готово
        </p>
      )}
    </>
  );
}
export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / size));
  return (
    <nav aria-label="Страницы списка" className="pagination">
      <span>Всего: {total}</span>
      <button
        className="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Назад
      </button>
      <span>
        {page} / {last}
      </span>
      <button
        className="button"
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
      >
        Далее
      </button>
    </nav>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={title} onCancel={onClose}>
      <header className="flex items-center justify-between gap-4">
        <h2>{title}</h2>
        <button className="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Form({
  onSubmit,
  children,
  className = '',
}: {
  onSubmit: (data: FormData, form: HTMLFormElement) => void;
  children: ReactNode;
  className?: string;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget), event.currentTarget);
  }
  return (
    <form className={`form-stack ${className}`} onSubmit={submit}>
      {children}
    </form>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Empty({
  children = 'Записей пока нет.',
}: {
  children?: ReactNode;
}) {
  return <p className="empty-state">{children}</p>;
}
