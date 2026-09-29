import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '../../entities/session';
import { useSession } from '../session';
import { employeeName } from '../../shared/lib';
import { LineIcon, Modal } from '../../shared/ui';

type Section = 'account' | 'appearance';

function fontPreference(): 'basis' | 'system' {
  return document.documentElement.dataset.fontPreference === 'system'
    ? 'system'
    : 'basis';
}

export function Settings({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const [section, setSection] = useState<Section>('account');
  const [font, setFont] = useState(fontPreference);
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: sessionApi.config,
    staleTime: 0,
  });
  const accountUrl = config.data
    ? `${config.data.keycloak.url.replace(/\/$/, '')}/realms/${encodeURIComponent(config.data.keycloak.realm)}/account/`
    : undefined;

  function chooseFont(value: 'basis' | 'system') {
    setFont(value);
    if (value === 'system') {
      document.documentElement.dataset.fontPreference = 'system';
    } else {
      delete document.documentElement.dataset.fontPreference;
    }
    try {
      localStorage.setItem('crm-font', value);
    } catch {
      // A browser with blocked storage still applies the preference for this page.
    }
  }

  return (
    <Modal title="Настройки" onClose={onClose} className="settings-modal">
      <p className="settings-intro">Аккаунт, CRM и внешний вид сайта</p>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Разделы настроек">
          <button
            type="button"
            className={
              section === 'account' ? 'settings-tab is-active' : 'settings-tab'
            }
            aria-current={section === 'account' ? 'page' : undefined}
            onClick={() => setSection('account')}
          >
            <LineIcon name="people" />
            <span>
              <strong>Аккаунт</strong>
              <small>Профиль и безопасность</small>
            </span>
          </button>
          <button
            type="button"
            className={
              section === 'appearance'
                ? 'settings-tab is-active'
                : 'settings-tab'
            }
            aria-current={section === 'appearance' ? 'page' : undefined}
            onClick={() => setSection('appearance')}
          >
            <LineIcon name="settings" />
            <span>
              <strong>CRM и сайт</strong>
              <small>Оформление и шрифт</small>
            </span>
          </button>
        </nav>
        <div className="settings-content">
          {section === 'account' ? (
            <>
              <p className="eyebrow">УЧЁТНАЯ ЗАПИСЬ</p>
              <h3>Аккаунт</h3>
              <p className="muted">Личные данные и способы защиты входа.</p>
              <div className="settings-identity">
                <span className="avatar">{employeeName(user).slice(0, 1)}</span>
                <span>
                  <strong>{employeeName(user)}</strong>
                  <small>{user?.email || 'Учётная запись Keycloak'}</small>
                </span>
              </div>
              <div className="settings-account-actions">
                {[
                  ['mail', 'Электронная почта', 'Адрес учётной записи'],
                  [
                    'shield',
                    'Двухфакторная защита',
                    'Способы подтверждения входа',
                  ],
                  ['key', 'Пароль', 'Смена пароля учётной записи'],
                ].map(([icon, title, description]) => (
                  <div className="settings-account-row" key={title}>
                    <span className="settings-action-icon">
                      <LineIcon name={icon} />
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    {accountUrl ? (
                      <a
                        href={accountUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть ↗
                      </a>
                    ) : (
                      <span className="muted">
                        {config.isError ? 'Недоступно' : 'Загрузка…'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="settings-note">
                Данные учётной записи и способы защиты настраиваются в Keycloak.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">ПЕРСОНАЛИЗАЦИЯ</p>
              <h3>CRM и сайт</h3>
              <p className="muted">
                Настройка шрифта сохраняется в этом браузере.
              </p>
              <div className="settings-choice-group">
                <strong>Вариант интерфейса</strong>
                <div className="settings-brand-card">
                  <span className="settings-brand-preview" aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <strong>Ростелеком</strong>
                  <small>Строгий фирменный вид</small>
                </div>
              </div>
              <div className="settings-choice-group">
                <strong>Шрифт интерфейса</strong>
                <button
                  type="button"
                  className={`settings-font-option ${font === 'basis' ? 'is-active' : ''}`}
                  onClick={() => chooseFont('basis')}
                >
                  <span className="settings-font-preview">Aa</span>
                  <span>
                    <strong>Rostelecom Basis</strong>
                    <small>Фирменный, по умолчанию</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`settings-font-option ${font === 'system' ? 'is-active' : ''}`}
                  onClick={() => chooseFont('system')}
                >
                  <span className="settings-font-preview">Aa</span>
                  <span>
                    <strong>Системный</strong>
                    <small>Привычный шрифт устройства</small>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
