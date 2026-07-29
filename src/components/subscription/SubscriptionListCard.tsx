import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { useHaptic } from '../../platform';
import { CalendarIcon, ChevronRightIcon, PlusIcon, ArrowRightIcon, XIcon, CheckIcon } from '@/components/icons';
import type { SubscriptionListItem } from '../../types';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '../../api/subscription';
import { useState, useEffect, memo, useRef } from 'react';
import { DeviceTopupSheet } from './sheets/DeviceTopupSheet';
import PurchaseCTAButton from './PurchaseCTAButton';

// ═══ НОВОЕ: компонент таймера обратного отсчета ═══
const CountdownTimer = memo(function CountdownTimer({
  endDate,
  isActive,
  isDark,
}: {
  endDate: string;
  isActive: boolean;
  isDark: boolean;
}) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const endTime = new Date(endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const isExpired = !isActive;
  const isUrgent = countdown.days <= 3 && !isExpired;

  const getColor = () => {
    if (isExpired) return 'text-error-400';
    if (isUrgent) return 'text-warning-400';
    return 'text-dark-300';
  };

  const getBgColor = () => {
    if (isExpired) return 'bg-error-400/10 border-error-400/20';
    if (isUrgent) return 'bg-warning-400/15 border-warning-400/30';
    return isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10';
  };

  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${getBgColor()}`}>
      <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
      <span className="text-[10px] font-medium text-dark-400">Истекает через</span>
      {isExpired ? (
        <span className="text-[11px] font-bold text-error-400">Истекла</span>
      ) : (
        <span className={`font-mono text-[11px] font-bold tabular-nums ${getColor()}`}>
          {countdown.days > 0 && (
            <>
              {countdown.days}
              <span className="text-[9px] font-medium opacity-60">д </span>
            </>
          )}
          {String(countdown.hours).padStart(2, '0')}
          <span className="text-[9px] font-medium opacity-60">:</span>
          {String(countdown.minutes).padStart(2, '0')}
          <span className="text-[9px] font-medium opacity-60">:</span>
          {String(countdown.seconds).padStart(2, '0')}
        </span>
      )}
    </div>
  );
});

// ═══ НОВОЕ: компонент статус-бейджа ═══
function StatusBadge({
  status,
  isTrial,
  t,
}: {
  status: string;
  isTrial: boolean;
  t: (key: string, fallback: string) => string;
}) {
  const isActive = status === 'active' || status === 'trial';
  const isLimited = status === 'limited';
  const isExpired = status === 'expired' || status === 'disabled';

  if (isTrial) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-400/25 bg-accent-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-400">
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        {t('subscription.statusTrial', 'Пробный')}
      </span>
    );
  }

  const color = isActive
    ? 'bg-success-400/15 text-success-400 border-success-400/25'
    : isLimited
      ? 'bg-warning-400/15 text-warning-400 border-warning-400/25'
      : 'bg-error-400/15 text-error-400 border-error-400/25';

  const label = isActive
    ? t('subscription.statusActive', 'Активна')
    : isLimited
      ? t('subscription.statusLimited', 'Ограничена')
      : isExpired
        ? t('subscription.statusExpired', 'Истекла')
        : status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}
    >
      {label}
    </span>
  );
}

// ═══ НОВОЕ: компонент прогресс-бара трафика ═══
function TrafficProgressBar({
  percent,
  isUnlimited,
  trafficUsed,
  trafficLimit,
  t,
}: {
  percent: number;
  isUnlimited: boolean;
  trafficUsed: number;
  trafficLimit: number;
  t: (key: string, fallback: string) => string;
}) {
  if (isUnlimited) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-400">
              Безлимитный трафик
            </span>
          </div>
          <span className="text-[10px] font-bold tabular-nums text-accent-400">
            ∞ {t('common.units.gb', 'ГБ')}
          </span>
        </div>
        <div className="relative overflow-hidden rounded-full" style={{ height: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div 
            className="absolute inset-0"
            style={{ 
              background: 'linear-gradient(90deg, rgba(var(--color-accent-400), 0.3), rgba(var(--color-accent-400), 0.1))',
              borderRadius: '10px',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <div className="h-2 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-2 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-2 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>
        </div>
      </div>
    );
  }

  const getStatus = (p: number) => {
    if (p >= 90) return { label: t('traffic.critical', 'Критично'), color: 'text-error-400', hex: 'error-400' };
    if (p >= 70) return { label: t('traffic.high', 'Высокий'), color: 'text-warning-400', hex: 'warning-400' };
    if (p >= 40) return { label: t('traffic.medium', 'Средний'), color: 'text-accent-400', hex: 'accent-400' };
    return { label: t('traffic.low', 'Норма'), color: 'text-success-400', hex: 'success-400' };
  };

  const status = getStatus(percent);
  const displayPercent = Math.max(3, percent);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-dark-400">Трафик</span>
          <div 
            className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
            style={{ background: `rgb(var(--color-${status.hex}))` }}
          />
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${status.color}`}>
            {status.label}
          </span>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-dark-300">
          {trafficUsed.toFixed(1)} / {trafficLimit} {t('common.units.gb', 'ГБ')}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-full" style={{ height: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="absolute inset-0 flex" aria-hidden="true">
          <div style={{ flex: '50 0 0', background: 'transparent' }} />
          <div style={{ flex: '25 0 0', background: 'rgba(var(--color-warning-400), 0.03)' }} />
          <div style={{ flex: '15 0 0', background: 'rgba(var(--color-warning-300), 0.04)' }} />
          <div style={{ flex: '10 0 0', background: 'rgba(var(--color-error-400), 0.05)' }} />
        </div>
        
        <div 
          className="absolute bottom-0 left-0 top-0 w-full origin-left overflow-hidden transition-transform duration-1000"
          style={{ 
            transform: `scaleX(${Math.min(displayPercent / 100, 1)})`,
            borderRadius: '10px',
          }}
        >
          <div 
            className="absolute inset-0 transition-colors duration-500"
            style={{ 
              background: `linear-gradient(90deg, rgb(var(--color-${status.hex})), rgb(var(--color-${status.hex})))` 
            }}
          />
          <div className="absolute inset-0 animate-shimmer" aria-hidden="true" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)' }} />
          <div className="absolute left-0 right-0 top-0" aria-hidden="true" style={{ height: '50%', background: 'linear-gradient(rgba(255,255,255,0.2) 0%, transparent 100%)', borderRadius: '10px 10px 0 0' }} />
        </div>

        <div className="absolute inset-0 flex items-center justify-between px-2">
          {[25, 50, 75, 90].map((marker) => (
            <div
              key={marker}
              className="h-2 w-px"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
          ))}
        </div>

        {displayPercent > 0 && (
          <div 
            className="absolute top-0 h-full w-1 rounded-full"
            style={{
              left: `${Math.min(displayPercent, 100)}%`,
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.2)',
              boxShadow: '0 0 8px rgba(255,255,255,0.1)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ═══ НОВОЕ: компонент прогресс-бара устройств с кнопкой докупки ═══
function DeviceProgressBar({ 
  current, 
  max, 
  isDark,
  onUpgrade,
  showUpgradeButton,
}: { 
  current: number; 
  max: number;
  isDark: boolean;
  onUpgrade?: (e: React.MouseEvent) => void;
  showUpgradeButton?: boolean;
}) {
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const displayPercent = Math.max(5, percentage);
  
  const getColor = () => {
    if (percentage >= 90) return 'bg-error-400';
    if (percentage >= 70) return 'bg-warning-400';
    return 'bg-success-400';
  };

  const getTextColor = () => {
    if (percentage >= 90) return 'text-error-400';
    if (percentage >= 70) return 'text-warning-400';
    return 'text-success-400';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-dark-400">Устр.</span>
      <div className="relative flex-1 min-w-[40px]">
        <div 
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${getColor()}`}
            style={{ width: `${Math.max(1, displayPercent)}%` }}
          />
        </div>
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${getTextColor()}`}>
        {current}/{max}
      </span>
      {showUpgradeButton && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="relative flex h-6 w-6 items-center justify-center rounded-full bg-accent-500/15 text-accent-400 transition-colors hover:bg-accent-500/25 flex-shrink-0"
          title="Увеличить количество устройств"
          data-no-card-click="true"
        >
          <span className="absolute inset-0 rounded-full border-2 border-accent-400/40 animate-pulse-ring" />
          <PlusIcon className="h-3.5 w-3.5 relative z-10" />
        </button>
      )}
    </div>
  );
}

// ═══ НОВОЕ: кнопка продления/возобновления с пульсирующей окантовкой ═══
function RenewButton({ 
  onClick, 
  label,
  isExpired = false,
}: { 
  onClick: (e: React.MouseEvent) => void; 
  label: string;
  isExpired?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors flex-shrink-0 ${
        isExpired 
          ? 'bg-error-400/15 text-error-400 hover:bg-error-400/25' 
          : 'bg-warning-400/15 text-warning-400 hover:bg-warning-400/25'
      }`}
      data-no-card-click="true"
    >
      <span className={`absolute inset-0 rounded-full border-2 ${
        isExpired ? 'border-error-400/40' : 'border-warning-400/40'
      } animate-pulse-ring`} />
      <span className="relative z-10 flex items-center gap-1.5">
        {label}
        <ArrowRightIcon className="h-3 w-3" />
      </span>
    </button>
  );
}

export default function SubscriptionListCard({
  subscription,
  onClick,
}: {
  subscription: SubscriptionListItem;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { impact } = useHaptic();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedContent, setExpandedContent] = useState<'devices' | 'renew' | null>(null);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariffMode = multiSubData?.multi_tariff_enabled ?? false;

  // Обработчик клика по карточке
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-card-click]')) {
      return;
    }
    if (!isExpanded) {
      impact('light');
      onClick();
    }
  };

  const handleUpgradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedContent('devices');
    setIsExpanded(true);
  };

  const handleRenewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedContent('renew');
    setIsExpanded(true);
  };

  const handleCloseExpanded = () => {
    setIsExpanded(false);
    setExpandedContent(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && cardRef.current && !cardRef.current.contains(event.target as Node)) {
        handleCloseExpanded();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const isTrial = subscription.is_trial;
  const isActive =
    subscription.status === 'active' ||
    subscription.status === 'trial' ||
    subscription.status === 'limited';
  const isExpired = subscription.status === 'expired' || subscription.status === 'disabled';
  const trafficLimit = subscription.traffic_limit_gb;
  const trafficUsed = subscription.traffic_used_gb;
  const isUnlimited = trafficLimit === 0;
  const trafficPercent = isUnlimited
    ? 0
    : trafficLimit > 0
      ? Math.min(100, (trafficUsed / trafficLimit) * 100)
      : 0;
  
  const deviceLimit = subscription.device_limit ?? 0;
  const hasDevices = deviceLimit > 0;

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices', subscription.id],
    queryFn: () => subscriptionApi.getDevices(subscription.id),
    enabled: !!subscription.id && isActive,
    staleTime: 30_000,
  });

  const connectedDevices = devicesData?.total ?? 0;

  const remainingDevices = deviceLimit - connectedDevices;
  const showUpgradeButton = hasDevices && remainingDevices < 5 && remainingDevices > 0;

  const isUrgent = isActive && subscription.end_date && (() => {
    const endTime = new Date(subscription.end_date).getTime();
    const diff = Math.max(0, endTime - Date.now());
    const days = Math.floor(diff / 86_400_000);
    return days <= 3 && days >= 0;
  })();

  const showRenewButton = isExpired;

  const isLimitedStatus = subscription.status === 'limited';

  const getBorderColor = () => {
    if (isUrgent) return 'rgba(251,191,36,0.4)';
    if (isExpired || isLimitedStatus) return 'rgba(255,59,92,0.25)';
    if (isTrial) return 'rgba(251,191,36,0.3)';
    return g.cardBorder;
  };

  const bgColor =
    isTrial || isLimitedStatus
      ? isDark
        ? 'rgba(251,191,36,0.06)'
        : 'rgba(251,191,36,0.04)'
      : isExpired
        ? isDark
          ? 'rgba(255,59,92,0.06)'
          : 'rgba(255,59,92,0.04)'
        : isUrgent
          ? isDark
            ? 'rgba(251,191,36,0.06)'
            : 'rgba(251,191,36,0.04)'
          : g.cardBg;

  const borderColor = getBorderColor();

  const borderStyle = {
    background: bgColor,
    border: '2px solid ' + borderColor,
    boxShadow: `0 0 0 1px ${borderColor}`,
  };

  const getExpandedTitle = () => {
    if (expandedContent === 'devices') return 'Увеличение количества устройств';
    if (expandedContent === 'renew') {
      return isExpired ? 'Возобновление подписки' : 'Продление подписки';
    }
    return '';
  };

  const isAutopayEnabled = subscription.autopay_enabled ?? false;
  const isDaily = subscription.is_daily ?? false;
  const autopayLabel = isDaily
    ? t('subscription.dailyAutoCharge', 'Автосписание')
    : t('subscription.autopay', 'Автопродление');

  return (
    <div 
      ref={cardRef}
      className="relative"
    >
      {/* Основная карточка */}
      <div
        onClick={handleCardClick}
        className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 ${
          isExpanded ? 'rounded-b-none' : 'hover:scale-[1.01] active:scale-[1.004]'
        } cursor-pointer`}
        style={borderStyle}
      >
        {/* Header: tariff name + status badge + автопродление + chevron */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-bold" style={{ color: g.text }}>
              {subscription.tariff_name || t('subscription.defaultName', 'Подписка')}
            </span>
            <StatusBadge status={subscription.status} isTrial={isTrial} t={t} />
          </div>
          
          {/* Автопродление */}
          {!isTrial && isActive && (
            <div className="flex items-center gap-1.5 flex-shrink-0" data-no-card-click="true">
              <span className="text-[9px] font-medium text-dark-400">{autopayLabel}</span>
              <span className={`flex items-center gap-0.5 text-[9px] font-bold ${
                isAutopayEnabled ? 'text-success-400' : 'text-error-400'
              }`}>
                {isAutopayEnabled ? (
                  <>
                    <CheckIcon className="h-2.5 w-2.5" />
                    {t('common.enabled', 'Вкл')}
                  </>
                ) : (
                  <>
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('common.disabled', 'Выкл')}
                  </>
                )}
              </span>
            </div>
          )}
          
          <ChevronRightIcon className={`h-4 w-4 shrink-0 text-dark-400 opacity-40 transition-all duration-300 ${
            isExpanded ? 'rotate-90' : 'group-hover:translate-x-0.5 group-hover:opacity-80'
          }`} />
        </div>

        {/* Traffic progress bar */}
        {isActive && (
          <div className="mt-2.5">
            <TrafficProgressBar
              percent={trafficPercent}
              isUnlimited={isUnlimited}
              trafficUsed={trafficUsed}
              trafficLimit={trafficLimit}
              t={t}
            />
          </div>
        )}

        {/* Stats row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: g.textSecondary }}>
          <div className="flex items-center gap-2">
            {isActive && subscription.end_date && (
              <CountdownTimer
                endDate={subscription.end_date}
                isActive={isActive}
                isDark={isDark}
              />
            )}
            {isUrgent && (
              <RenewButton 
                onClick={handleRenewClick} 
                label="Продлить"
                isExpired={false}
              />
            )}
            {showRenewButton && (
              <RenewButton 
                onClick={handleRenewClick} 
                label="Возобновить"
                isExpired={true}
              />
            )}
          </div>

          {hasDevices && isActive && (
            <div className="flex-1 min-w-[120px] ml-auto">
              {devicesLoading ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-dark-400">Устр.</span>
                  <div className="h-1.5 w-16 animate-pulse rounded-full bg-dark-600/30" />
                </div>
              ) : (
                <DeviceProgressBar 
                  current={connectedDevices} 
                  max={deviceLimit}
                  isDark={isDark}
                  onUpgrade={showUpgradeButton ? handleUpgradeClick : undefined}
                  showUpgradeButton={showUpgradeButton}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ НОВОЕ: развернутая часть ═══ */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div 
          className="rounded-b-2xl border-x-2 border-b-2 p-4"
          style={{
            background: bgColor,
            borderColor: borderColor,
            borderTop: 'none',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-dark-50">
              {getExpandedTitle()}
            </h3>
            <button
              onClick={handleCloseExpanded}
              className="rounded-full p-1 hover:bg-white/10 transition-colors"
              data-no-card-click="true"
            >
              <XIcon className="h-4 w-4 text-dark-400" />
            </button>
          </div>
          
          {expandedContent === 'devices' && (
            <DeviceTopupSheet
              open={true}
              onOpen={() => {}}
              onClose={handleCloseExpanded}
              subscription={subscription as any}
              subscriptionId={subscription.id}
              devicesToAdd={devicesToAdd}
              onDevicesToAddChange={setDevicesToAdd}
              purchaseOptions={undefined}
              isDark={isDark}
            />
          )}

          {expandedContent === 'renew' && (
            <div className="space-y-4">
              <p className="text-sm text-dark-300">
                {isExpired 
                  ? 'Ваша подписка истекла. Вы можете возобновить её, выбрав один из тарифов ниже.'
                  : 'Ваша подписка скоро истечет. Продлите её сейчас, чтобы не потерять доступ к сервису.'
                }
              </p>
              <PurchaseCTAButton 
                subscription={subscription as any}
                isMultiTariff={isMultiTariffMode}
              />
              <button
                onClick={handleCloseExpanded}
                className="w-full rounded-xl border border-dark-700/50 bg-dark-800/50 px-4 py-2.5 text-sm font-medium text-dark-400 transition-colors hover:bg-dark-700 hover:text-dark-100"
                data-no-card-click="true"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}