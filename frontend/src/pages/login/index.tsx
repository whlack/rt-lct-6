import { useState } from 'react';
import { useSession } from '../../features/session';
export function LoginPage() {
  const { login } = useSession();
  const [error, setError] = useState('');
  return (
    <main className="login-screen design-glass mode-light">
      <div className="atmosphere" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <header className="login-top">
        <span className="glass-brand">
          <img src="/brand/rt-logo.png" alt="Ростелеком" />
          <small>ИТ Школа</small>
        </span>
      </header>
      <div className="login-stage">
        <section className="login-art">
          <p className="eyebrow">CRM взаимодействий</p>
          <h1>
            Работа с вузами
            <br />
            без потери контекста.
          </h1>
          <p>
            Проекты, документы и следующие шаги — в одном рабочем пространстве.
          </p>
          <div className="login-orbit" aria-hidden="true">
            <span>ВУЗ</span>
            <span>Проект</span>
            <span>ИТ Школа</span>
          </div>
        </section>
        <section className="login-panel panel">
          <div className="login-panel-inner">
            <p className="eyebrow">Корпоративный доступ</p>
            <h2>Вход в ИТ Школу</h2>
            <p className="login-lead">Используйте рабочую учётную запись.</p>
            <button
              className="button button-primary button-wide"
              type="button"
              onClick={() => {
                void login().catch(() =>
                  setError('Не удалось открыть страницу входа. Повторите.'),
                );
              }}
            >
              Войти через корпоративный аккаунт →
            </button>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
