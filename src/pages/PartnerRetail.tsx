// PartnerRetail.tsx - рабочая версия с логированием в Google Sheets
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { partnerApi } from '../api/partners';
import { tariffsApi, type TariffDetail } from '../api/tariffs';
import { subscriptionApi } from '../api/subscription';
import { adminUsersApi } from '../api/adminUsers';
import { authApi } from '../api/auth';
import { QRCodeSVG } from 'qrcode.react';
import { CopyIcon, CheckIcon, ArrowIcon, ChevronDownIcon, ChevronIcon } from '@/components/icons';
import { copyToClipboard } from '../utils/clipboard';
import { infoApi } from '../api/info';
import { tokenStorage } from '../utils/token';
import { referralApi } from '../api/referral';
import { useAuthStore } from '../store/auth';
import { useShallow } from 'zustand/shallow';
import type { AppConfig, RemnawavePlatformData, RemnawaveAppClient, LocalizedText } from '../types';
import DOMPurify from 'dompurify';

interface FormData {
  email: string;
  tariff_id: number;
  period_days: number;
}

interface RetailPurchaseResult {
  email: string;
  password: string;
  subscription_url: string;
  tariff_name: string;
  period_days: number;
  subscription_id: number;
  user_id?: number;
}

// ═══════════════════════════════════════════════════════════════
// ЛОГИРОВАНИЕ ПРОДАЖ В GOOGLE SHEETS
// ═══════════════════════════════════════════════════════════════

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXI-CYe43_ijfnA_S8Hz-rKpz-dFBQgvcU5HXZPdy1g8Q-cEKLvsdPalo1j-_P3CpFuw/exec';

const logRetailSale = async (data: {
  partnerName: string;
  partnerUsername: string;
  partnerTelegramId: number;
  tariffName: string;
  priceKopeks: number;
  periodDays: number;
  userEmail: string;
  subscriptionId: number;
  userId?: number;
}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    partnerName: data.partnerName || '',
    partnerUsername: data.partnerUsername || '',
    partnerTelegramId: data.partnerTelegramId || 0,
    tariffName: data.tariffName || '',
    priceRubles: (data.priceKopeks / 100).toFixed(2),
    priceKopeks: data.priceKopeks || 0,
    periodDays: data.periodDays || 0,
    userEmail: data.userEmail || '',
    subscriptionId: data.subscriptionId || 0,
    userId: data.userId || 0,
    paid: 'Нет',
  };

  console.log('📝 Отправка лога в Google Sheets:', payload);

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('✅ Лог сохранён в Google Sheets');
    return;
  } catch (e) {
    console.warn('⚠️ Не удалось сохранить в Google Sheets:', e);
  }

  // Fallback: сохраняем в localStorage
  try {
    const logs = JSON.parse(localStorage.getItem('retail_sales_logs') || '[]');
    logs.push({
      ...payload,
      id: Date.now(),
    });
    localStorage.setItem('retail_sales_logs', JSON.stringify(logs));
    console.log('✅ Лог сохранён локально (fallback)');
  } catch (e) {
    console.warn('❌ Ошибка сохранения лога:', e);
  }
};

// ═══════════════════════════════════════════════════════════════
// КОМПОНЕНТ МОДАЛЬНОГО ОКНА ПОДТВЕРЖДЕНИЯ
// ═══════════════════════════════════════════════════════════════

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Да, подтверждаю',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-dark-950/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      <div className="relative w-full max-w-md animate-fade-in rounded-2xl border border-dark-700/50 bg-dark-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-500/20">
            <svg className="h-5 w-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-dark-50">{title}</h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-dark-300">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 px-4 py-2.5 text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary flex-1 px-4 py-2.5 text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Компонент для отображения ссылок и QR-кодов приложений
function AppLinksSection() {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [activePlatformKey, setActivePlatformKey] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<RemnawaveAppClient | null>(null);

  const platformOrder = ['ios', 'android', 'windows', 'macos', 'linux', 'androidTV', 'appleTV'];
  
  const { data: appConfig, isLoading } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: () => subscriptionApi.getAppConfig(undefined),
  });

  const getLocalizedText = useCallback(
    (text: LocalizedText | undefined): string => {
      if (!text) return '';
      const lang = i18n.language || 'en';
      return text[lang] || text['en'] || text['ru'] || Object.values(text)[0] || '';
    },
    [i18n.language],
  );

  const getSvgHtml = useCallback(
    (svgKey: string | undefined): string => {
      if (!svgKey || !appConfig?.svgLibrary?.[svgKey]) return '';
      const entry = appConfig.svgLibrary[svgKey];
      const raw = typeof entry === 'string' ? entry : entry.svgString;
      if (!raw) return '';
      return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
    },
    [appConfig?.svgLibrary],
  );

  const availablePlatforms = useMemo(() => {
    if (!appConfig?.platforms) return [];
    const available = platformOrder.filter((key) => {
      const data = appConfig.platforms[key] as RemnawavePlatformData | undefined;
      return data && data.apps && data.apps.length > 0;
    });
    return available;
  }, [appConfig]);

  const getPlatformDisplayName = useCallback(
    (key: string): string => {
      const data = appConfig?.platforms?.[key] as RemnawavePlatformData | undefined;
      if (data?.displayName) {
        const name = getLocalizedText(data.displayName);
        if (name) return name;
      }
      if (appConfig?.platformNames?.[key]) {
        return getLocalizedText(appConfig.platformNames[key]);
      }
      const fallback: Record<string, string> = {
        ios: 'iOS',
        android: 'Android',
        windows: 'Windows',
        macos: 'macOS',
        linux: 'Linux',
        androidTV: 'Android TV',
        appleTV: 'Apple TV',
      };
      return fallback[key] || key;
    },
    [appConfig, getLocalizedText],
  );

  const currentPlatformData = activePlatformKey
    ? (appConfig?.platforms?.[activePlatformKey] as RemnawavePlatformData | undefined)
    : undefined;
  const currentPlatformSvg = getSvgHtml(currentPlatformData?.svgIconKey);
  const currentPlatformApps = currentPlatformData?.apps || [];

  useEffect(() => {
    if (selectedApp || !availablePlatforms.length) return;
    const platform = availablePlatforms[0];
    const data = appConfig?.platforms[platform] as RemnawavePlatformData | undefined;
    if (!data?.apps?.length) return;
    const app = data.apps.find((a) => a.featured) || data.apps[0];
    if (app) {
      setSelectedApp(app);
      setActivePlatformKey(platform);
    }
  }, [appConfig, availablePlatforms, selectedApp]);

  const getAppDownloadUrl = (app: RemnawaveAppClient): string => {
    if (app.blocks) {
      for (const block of app.blocks) {
        if (block.buttons) {
          for (const button of block.buttons) {
            if (button.type === 'external' && button.link) {
              return button.link;
            }
            if (button.url && (button.url.startsWith('http://') || button.url.startsWith('https://'))) {
              return button.url;
            }
          }
        }
      }
    }
    return '';
  };

  const hasDownloadUrl = (app: RemnawaveAppClient): boolean => {
    return !!getAppDownloadUrl(app);
  };

  if (isLoading || !appConfig || availablePlatforms.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-dark-700/50 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-dark-200">
          {t('partnerRetail.downloadApps', 'Ссылки для скачивания приложений')}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-dark-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {availablePlatforms.length > 0 && (
            <div className="relative flex items-center">
              {currentPlatformSvg && (
                <div
                  className="pointer-events-none absolute left-3 z-10 h-5 w-5 text-dark-400 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: currentPlatformSvg }}
                />
              )}
              <select
                value={activePlatformKey || availablePlatforms[0] || ''}
                onChange={(e) => {
                  const newPlatform = e.target.value;
                  setActivePlatformKey(newPlatform);
                  const data = appConfig.platforms[newPlatform] as RemnawavePlatformData | undefined;
                  if (data?.apps?.length) {
                    const app = data.apps.find((a) => a.name === selectedApp?.name) ||
                                data.apps.find((a) => a.featured) ||
                                data.apps[0];
                    if (app) setSelectedApp(app);
                  }
                }}
                className={`appearance-none w-full rounded-xl border py-2 pr-8 text-sm font-medium outline-none transition-colors ${
                  'border-dark-700 bg-dark-800 text-dark-200 hover:border-dark-600'
                } ${currentPlatformSvg ? 'pl-10' : 'pl-4'}`}
              >
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>
                    {getPlatformDisplayName(p)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 text-dark-400">
                <ChevronIcon className="h-4 w-4" />
              </div>
            </div>
          )}

          {activePlatformKey && currentPlatformApps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentPlatformApps.map((app, idx) => {
                const isSelected = selectedApp?.name === app.name;
                const appIconSvg = app.svgIconKey ? getSvgHtml(app.svgIconKey) : '';
                return (
                  <button
                    key={app.name + idx}
                    onClick={() => setSelectedApp(app)}
                    className={`relative flex min-w-[calc(50%-0.25rem)] items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                      isSelected
                        ? 'bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/40'
                        : 'border border-dark-700/50 bg-dark-800/80 text-dark-200 hover:border-dark-600/50 hover:bg-dark-700/80'
                    }`}
                  >
                    {app.featured && <span className="h-2 w-2 shrink-0 rounded-full bg-warning-400" />}
                    <span className="relative z-10 truncate">{app.name}</span>
                    {appIconSvg && (
                      <div
                        className="ml-auto h-7 w-7 shrink-0 opacity-30 [&>svg]:h-full [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: appIconSvg }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedApp && hasDownloadUrl(selectedApp) && (
            <div className="rounded-xl bg-dark-800/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-dark-100">
                  {selectedApp.name}
                  {selectedApp.featured && (
                    <span className="ml-2 rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] text-accent-400">
                      {t('common.recommended', 'Рекомендуемое')}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => copyToClipboard(getAppDownloadUrl(selectedApp))}
                  className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {t('common.copy')}
                </button>
              </div>
              
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG
                    value={getAppDownloadUrl(selectedApp)}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#1a1a2e"
                    level="L"
                  />
                </div>
              </div>
              
              <div className="mt-3 truncate text-center text-xs text-dark-400">
                <span className="font-mono">{getAppDownloadUrl(selectedApp)}</span>
              </div>
            </div>
          )}

          {selectedApp && !hasDownloadUrl(selectedApp) && (
            <div className="rounded-xl bg-warning-500/10 p-4 text-center text-xs text-warning-400">
              {t('partnerRetail.noDownloadLink', 'Для этого приложения нет ссылки для скачивания')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PartnerRetail() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Используем registerWithEmail из AuthStore (работает)
  const { registerWithEmail } = useAuthStore(
    useShallow((state) => ({
      registerWithEmail: state.registerWithEmail,
    }))
  );

  const [formData, setFormData] = useState<FormData>({
    email: '',
    tariff_id: 0,
    period_days: 30,
  });

  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<RetailPurchaseResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'back' | 'reset';
  }>({ isOpen: false, type: 'back' });

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTokensRef = useRef<{ access: string | null; refresh: string | null }>({
    access: null,
    refresh: null,
  });
  const partnerInfoRef = useRef<{ name: string; username: string; telegramId: number }>({
    name: '',
    username: '',
    telegramId: 0,
  });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Получаем данные текущего пользователя (партнёра) для логирования
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: authApi.getMe,
    staleTime: 60000,
  });

  // Обновляем информацию о партнёре при получении данных
  useEffect(() => {
    if (currentUser) {
      partnerInfoRef.current = {
        name: currentUser.first_name || currentUser.username || `ID:${currentUser.telegram_id}`,
        username: currentUser.username || '',
        telegramId: currentUser.telegram_id ?? 0,
      };
      console.log('👤 Информация о партнёре обновлена:', partnerInfoRef.current);
    }
  }, [currentUser]);

  const { data: tariffsData, isLoading: tariffsLoading } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => tariffsApi.getTariffs(false),
  });

  const { data: partnerStatus } = useQuery({
    queryKey: ['partner-status'],
    queryFn: partnerApi.getStatus,
  });

  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  const { data: legalConsent } = useQuery({
    queryKey: ['legal-consent-config', i18n.language],
    queryFn: () => infoApi.getLegalConsentConfig(i18n.language),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: tariffDetail } = useQuery<TariffDetail | null>({
    queryKey: ['tariff-detail', formData.tariff_id],
    queryFn: () => formData.tariff_id ? tariffsApi.getTariff(formData.tariff_id) : null,
    enabled: !!formData.tariff_id,
  });

  const activeTariffs = useMemo(() => {
    const excludeNames = ['партнерский', 'админ', 'промо'];
    return (tariffsData?.tariffs || [])
      .filter(t => t.is_active)
      .filter(t => {
        const nameLower = t.name.toLowerCase();
        return !excludeNames.some(exclude => nameLower.includes(exclude.toLowerCase()));
      });
  }, [tariffsData]);

  const periodOptions = [
    { days: 30, label: '30 дней' },
    { days: 60, label: '60 дней' },
    { days: 180, label: '180 дней' },
    { days: 365, label: '365 дней' },
  ];

  const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const hasCampaigns = partnerStatus?.campaigns && partnerStatus.campaigns.length >= 1;
  const isPartner = partnerStatus?.partner_status === 'approved';

  useEffect(() => {
    if (!isPartner || !hasCampaigns) {
      navigate('/referral', { replace: true });
    }
  }, [isPartner, hasCampaigns, navigate]);

  const selectedCampaign = useMemo(() => {
    if (!partnerStatus?.campaigns || partnerStatus.campaigns.length === 0) return null;
    return partnerStatus.campaigns[0];
  }, [partnerStatus]);

  const selectedTariff = activeTariffs.find(t => t.id === formData.tariff_id);

  const RETAIL_DISCOUNT_PERCENT = 30;

  const roundDownToTen = (value: number): number => {
    return Math.floor(value / 1000) * 1000;
  };

  const getPriceForPeriod = (): number | null => {
    if (!tariffDetail) return null;
    
    let priceKopeks: number | null = null;
    
    if (tariffDetail.is_daily && tariffDetail.daily_price_kopeks) {
      priceKopeks = tariffDetail.daily_price_kopeks;
    }
    
    if (!priceKopeks && tariffDetail.period_prices && tariffDetail.period_prices.length > 0) {
      const price = tariffDetail.period_prices.find((p: any) => p.days === formData.period_days);
      if (price) {
        priceKopeks = price.price_kopeks || null;
      }
      if (!priceKopeks) {
        priceKopeks = tariffDetail.period_prices[0]?.price_kopeks || null;
      }
    }
    
    if (!priceKopeks && tariffDetail.price_per_day_kopeks) {
      priceKopeks = tariffDetail.price_per_day_kopeks * formData.period_days;
    }
    
    if (!priceKopeks) return null;
    
    const discountedPrice = Math.round(priceKopeks * (1 - RETAIL_DISCOUNT_PERCENT / 100));
    return roundDownToTen(discountedPrice);
  };


  const formatPrice = (priceKopeks: number | null): string => {
    if (!priceKopeks) return '—';
    const rubles = priceKopeks / 100;
    return `${rubles.toFixed(0)} ₽`;
  };

  const formatTraffic = (gb: number): string => {
    if (gb === 0) return '∞';
    return `${gb} ГБ`;
  };

  const currentPrice = getPriceForPeriod();

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tariff_id || !formData.email) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (!selectedCampaign) {
      setError('Нет доступных кампаний');
      return;
    }

    setError(null);
    setIsCreating(true);

    partnerTokensRef.current = {
      access: tokenStorage.getAccessToken(),
      refresh: tokenStorage.getRefreshToken(),
    };

    try {
      const password = generatePassword();

      // 1. Регистрируем пользователя через registerWithEmail (работает)
      const acceptedDocuments = legalConsent?.documents || ['rules', 'privacy', 'offer'];
      const referralCode = referralInfo?.referral_code;
      
      await registerWithEmail(
        formData.email,
        password,
        '', // first_name
        referralCode, // referral_code
        acceptedDocuments
      );

      // 2. После регистрации, логинимся как пользователь, чтобы получить его ID
      const loginResult = await authApi.loginEmail(formData.email, password);
      
      if (!loginResult.user || !loginResult.user.id) {
        throw new Error('Не удалось получить данные пользователя после входа');
      }

      const userId = loginResult.user.id;

      // 3. Восстанавливаем сессию партнёра
      if (partnerTokensRef.current.access && partnerTokensRef.current.refresh) {
        tokenStorage.setTokens(
          partnerTokensRef.current.access,
          partnerTokensRef.current.refresh
        );
      }

      // 4. Создаём подписку через adminUsersApi.updateSubscription
      const subscriptionResult = await adminUsersApi.updateSubscription(userId, {
        action: 'create',
        tariff_id: formData.tariff_id,
        days: formData.period_days,
      });

      const subscriptionId = subscriptionResult.subscription?.id;
      if (!subscriptionId) {
        throw new Error('Не удалось создать подписку');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      let subscriptionUrl = '';
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        try {
          const panelInfo = await adminUsersApi.getPanelInfo(userId, subscriptionId);
          
          if (panelInfo?.found && panelInfo.subscription_url) {
            subscriptionUrl = panelInfo.subscription_url;
            break;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (err) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      if (!subscriptionUrl) {
        try {
          const connectionResult = await subscriptionApi.getConnectionLink(subscriptionId);
          if (connectionResult.subscription_url) {
            subscriptionUrl = connectionResult.subscription_url;
          }
        } catch (connErr) {
          console.warn('Could not get connection link via API');
        }
      }

      setResultData({
        email: formData.email,
        password: password,
        subscription_url: subscriptionUrl,
        tariff_name: subscriptionResult.subscription?.tariff_name || selectedTariff?.name || '',
        period_days: formData.period_days,
        subscription_id: subscriptionId,
        user_id: userId,
      });
      
      setShowResult(true);
      
      // 📝 Логируем продажу в Google Sheets
      try {
        const partnerInfo = partnerInfoRef.current;
        console.log('📝 Данные для лога:', {
          partnerName: partnerInfo.name,
          partnerUsername: partnerInfo.username,
          partnerTelegramId: partnerInfo.telegramId,
          tariffName: subscriptionResult.subscription?.tariff_name || selectedTariff?.name || '',
          priceKopeks: currentPrice || 0,
          periodDays: formData.period_days,
          userEmail: formData.email,
          subscriptionId: subscriptionId,
          userId: userId,
        });

        await logRetailSale({
          partnerName: partnerInfo.name || `Партнёр #${currentUser?.id || 'unknown'}`,
          partnerUsername: partnerInfo.username || '',
          partnerTelegramId: partnerInfo.telegramId || 0,
          tariffName: subscriptionResult.subscription?.tariff_name || selectedTariff?.name || '',
          priceKopeks: currentPrice || 0,
          periodDays: formData.period_days,
          userEmail: formData.email,
          subscriptionId: subscriptionId,
          userId: userId || 0,
        });
      } catch (logErr) {
        console.warn('Ошибка логирования:', logErr);
      }
      
      queryClient.invalidateQueries({ queryKey: ['referral-list'] });
      
    } catch (err: any) {
      console.error('Error creating retail purchase:', err);
      
      if (partnerTokensRef.current.access && partnerTokensRef.current.refresh) {
        tokenStorage.setTokens(
          partnerTokensRef.current.access,
          partnerTokensRef.current.refresh
        );
      }
      
      const errorData = err.response?.data;
      const errorMessage = errorData?.message || errorData?.detail || err.message;
      console.error('Детали ошибки:', errorData);
      
      if (errorMessage?.includes('already registered') || errorMessage?.includes('already exists') || err.response?.status === 409) {
        setError('Этот email уже зарегистрирован в системе. Используйте другой email.');
      } else if (err.response?.status === 400) {
        setError(`Ошибка регистрации: ${errorMessage || 'Неверные данные. Проверьте email.'}`);
      } else if (err.response?.status === 500) {
        setError('Ошибка на сервере. Попробуйте позже или используйте другой email.');
      } else if (err.response?.status === 403) {
        setError('У вас недостаточно прав. Обратитесь к администратору.');
      } else {
        setError(errorMessage || 'Ошибка при создании продажи. Попробуйте снова.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await copyToClipboard(text);
      setCopiedField(field);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setConfirmDialog({ isOpen: true, type: 'reset' });
  };

  const handleGoBack = () => {
    setConfirmDialog({ isOpen: true, type: 'back' });
  };

  const handleConfirmAction = () => {
    if (confirmDialog.type === 'reset') {
      setShowResult(false);
      setResultData(null);
      setFormData({
        email: '',
        tariff_id: 0,
        period_days: 30,
      });
      setError(null);
    } else {
      navigate('/referral');
    }
    setConfirmDialog({ isOpen: false, type: 'back' });
  };

  const handleCancelAction = () => {
    setConfirmDialog({ isOpen: false, type: 'back' });
  };

  if (!isPartner || !hasCampaigns) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.type === 'reset' ? 'Новая продажа' : 'Выход'}
        message={
          confirmDialog.type === 'reset'
            ? 'Покупатель сфотографировал данные аккаунта, ссылку и QR-код для установки?'
            : 'Покупатель сфотографировал данные аккаунта?'
        }
        confirmText={confirmDialog.type === 'reset' ? 'Да, всё сохранил' : 'Да, выйти'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
            Розничная продажа
          </h1>
          <p className="mt-1 text-sm text-dark-400">
            Создайте подписку для нового пользователя
          </p>
        </div>
        <button
          onClick={handleGoBack}
          className="btn-secondary flex items-center gap-2 px-4"
        >
          <ArrowIcon className="h-4 w-4 rotate-180" />
          Назад
        </button>
      </div>

      {/* Предупреждение об оплате */}
      <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-500/20 text-warning-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-sm text-warning-400">
            <p className="font-medium">{t('partnerRetail.paymentWarning.title', 'Важно!')}</p>
            <p className="mt-1 text-dark-300">
              {t('partnerRetail.paymentWarning.text', 
                'Партнёру необходимо лично пополнить баланс ЛК на сумму стоимости тарифа, либо перевести средства куратору или связаться с куратором по поводу оплаты продажи. Если оплата не будет произведена в течение 4 дней с момента продажи, подписка пользователя будет заблокирована автоматически, а на партнёра могут быть наложены ограничения.')}
            </p>
          </div>
        </div>
      </div>

      {!showResult ? (
        <div className="bento-card space-y-6">
          <form onSubmit={handleCreatePurchase} className="space-y-4">
            <div>
              <label
                htmlFor="pr-email"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                Email пользователя *
              </label>
              <input
                id="pr-email"
                type="email"
                required
                className="input w-full"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                placeholder="user@example.com"
              />
              <p className="mt-1 text-xs text-dark-500">
                Пароль будет сгенерирован автоматически (8 символов)
              </p>
            </div>

            <div>
              <label
                htmlFor="pr-tariff"
                className="mb-1.5 block text-sm font-medium text-dark-300"
              >
                Тариф *
              </label>
              <select
                id="pr-tariff"
                required
                className="input w-full"
                value={formData.tariff_id}
                onChange={(e) => setFormData({ ...formData, tariff_id: Number(e.target.value) })}
                disabled={tariffsLoading || activeTariffs.length === 0}
              >
                <option value={0}>
                  {tariffsLoading
                    ? 'Загрузка...'
                    : activeTariffs.length === 0
                      ? 'Нет доступных тарифов'
                      : 'Выберите тариф'}
                </option>
                {activeTariffs.map((tariff) => (
                  <option key={tariff.id} value={tariff.id}>
                    {tariff.name} — {formatTraffic(tariff.traffic_limit_gb)}, {tariff.device_limit} устройства
                  </option>
                ))}
              </select>
            </div>

            {selectedTariff && (
              <div>
                <label
                  htmlFor="pr-period"
                  className="mb-1.5 block text-sm font-medium text-dark-300"
                >
                  Период *
                </label>
                <select
                  id="pr-period"
                  required
                  className="input w-full"
                  value={formData.period_days}
                  onChange={(e) => setFormData({ ...formData, period_days: Number(e.target.value) })}
                >
                  {periodOptions.map((option) => (
                    <option key={option.days} value={option.days}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedTariff && (
              <div className="rounded-xl bg-dark-800/50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-dark-500">Трафик:</span>
                    <span className="ml-2 font-medium text-dark-200">
                      {formatTraffic(selectedTariff.traffic_limit_gb)}
                    </span>
                  </div>
                  <div>
                    <span className="text-dark-500">Устройства:</span>
                    <span className="ml-2 font-medium text-dark-200">
                      {selectedTariff.device_limit}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 border-t border-dark-700/50 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">
                      {t('partnerRetail.price', 'Цена для партнёра')}:
                    </span>
                    <div className="text-right">
                      {currentPrice !== null ? (
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-lg font-bold text-success-400">
                            {formatPrice(currentPrice)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-dark-400">Загрузка...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-error-500/10 p-3 text-sm text-error-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !formData.tariff_id || !formData.email || !selectedCampaign}
              className={`btn-primary w-full px-6 py-3 ${
                isCreating || !formData.tariff_id || !formData.email || !selectedCampaign
                  ? 'cursor-not-allowed opacity-50'
                  : ''
              }`}
            >
              {isCreating ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Создание...
                </>
              ) : (
                'Создать подписку'
              )}
            </button>
          </form>

          <AppLinksSection />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bento-card space-y-6 border-success-500/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/20 text-success-400">
                <CheckIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-dark-100">
                  Продажа зарегистрирована!
                </h2>
                <p className="text-sm text-dark-400">
                  Пользователь успешно создан и подписка оформлена
                </p>
              </div>
            </div>

            {resultData && (
              <>
                <div className="space-y-3 rounded-xl bg-dark-800/50 p-4">
                  <h3 className="text-sm font-medium text-dark-300">
                    Данные для входа
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-sm text-dark-500">Email:</span>
                      <span className="font-mono text-sm text-dark-100">{resultData.email}</span>
                      <button
                        onClick={() => handleCopy(resultData.email, 'email')}
                        className="ml-auto shrink-0 text-dark-400 transition-colors hover:text-dark-200"
                      >
                        {copiedField === 'email' ? (
                          <CheckIcon className="h-4 w-4 text-success-400" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-sm text-dark-500">Пароль:</span>
                      <span className="font-mono text-sm text-dark-100">{resultData.password}</span>
                      <button
                        onClick={() => handleCopy(resultData.password, 'password')}
                        className="ml-auto shrink-0 text-dark-400 transition-colors hover:text-dark-200"
                      >
                        {copiedField === 'password' ? (
                          <CheckIcon className="h-4 w-4 text-success-400" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-dark-500">
                    Сохраните эти данные и передайте пользователю
                  </div>
                </div>

                {resultData.subscription_url ? (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-dark-300">
                      Ссылка на подключение
                    </h3>
                    <div className="flex items-center gap-2 rounded-xl bg-dark-800/50 p-3">
                      <input
                        type="text"
                        readOnly
                        value={resultData.subscription_url}
                        className="flex-1 bg-transparent font-mono text-sm text-dark-100 outline-none"
                      />
                      <button
                        onClick={() => handleCopy(resultData.subscription_url, 'link')}
                        className="shrink-0 text-dark-400 transition-colors hover:text-dark-200"
                      >
                        {copiedField === 'link' ? (
                          <CheckIcon className="h-4 w-4 text-success-400" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-warning-500/10 p-4 text-center">
                    <p className="text-sm text-warning-400">
                      Подписка создана, но ссылка для подключения ещё не сгенерирована.
                      Пользователь сможет получить её в личном кабинете.
                    </p>
                  </div>
                )}

                {resultData.subscription_url && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-dark-300">
                      QR-код для подключения
                    </h3>
                    <div className="flex justify-center">
                      <div className="rounded-xl bg-white p-3">
                        <QRCodeSVG
                          value={resultData.subscription_url}
                          size={160}
                          bgColor="#ffffff"
                          fgColor="#1a1a2e"
                          level="L"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 rounded-xl bg-dark-800/50 p-4 text-sm">
                  <div>
                    <span className="text-dark-500">Тариф:</span>
                    <span className="ml-2 font-medium text-dark-200">{resultData.tariff_name}</span>
                  </div>
                  <div>
                    <span className="text-dark-500">Период:</span>
                    <span className="ml-2 font-medium text-dark-200">{resultData.period_days} дней</span>
                  </div>
                  {resultData.subscription_id && (
                    <div className="col-span-2">
                      <span className="text-dark-500">ID подписки:</span>
                      <span className="ml-2 font-mono text-sm text-dark-200">{resultData.subscription_id}</span>
                    </div>
                  )}
                  {resultData.user_id && (
                    <div className="col-span-2">
                      <span className="text-dark-500">ID пользователя:</span>
                      <span className="ml-2 font-mono text-sm text-dark-200">{resultData.user_id}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <AppLinksSection />

            <div className="flex gap-3">
              <button onClick={handleReset} className="btn-primary flex-1 px-6">
                Новая продажа
              </button>
              <button
                onClick={handleGoBack}
                className="btn-secondary flex-1 px-6"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}

      {!showResult && (
        <div className="bento-card">
          <h2 className="mb-4 text-lg font-semibold text-dark-100">
            История продаж
          </h2>
          <PartnerRetailHistory />
        </div>
      )}
    </div>
  );
}

// Компонент истории продаж
function PartnerRetailHistory() {
  const [page, setPage] = useState(0);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['referral-list', page],
    queryFn: () => import('../api/referral').then(m => m.referralApi.getReferralList({ 
      per_page: limit,
      page: page + 1 
    })),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  const referrals = data?.items || [];
  const total = data?.total || 0;

  if (!referrals.length) {
    return (
      <div className="py-8 text-center text-dark-400">
        У вас пока нет розничных продаж
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((ref) => (
        <div
          key={ref.id}
          className="flex flex-col gap-1 rounded-xl border border-dark-700/30 bg-dark-800/30 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-dark-100">
              {ref.first_name || ref.username || `Пользователь #${ref.id}`}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-500">
              <span>Создан: {new Date(ref.created_at).toLocaleDateString()}</span>
              {ref.has_paid && <span className="text-success-400">• Оплатил</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ref.has_paid ? (
              <span className="badge-success">Активен</span>
            ) : (
              <span className="badge-neutral">Ожидает</span>
            )}
          </div>
        </div>
      ))}

      {total > limit && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary px-4 text-sm disabled:opacity-50"
          >
            Назад
          </button>
          <span className="flex items-center text-sm text-dark-400">
            {page + 1} / {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="btn-secondary px-4 text-sm disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}