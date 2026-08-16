import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, SubscriptionIcon } from '@/components/icons';
import type { Subscription } from '../../types';

interface PurchaseCTAButtonProps {
  subscription: Subscription | null;
  /** In multi-tariff mode, link to /subscriptions/:id/renew instead of /subscription/purchase */
  isMultiTariff?: boolean;
}

export default function PurchaseCTAButton({
  subscription,
  isMultiTariff = false,
}: PurchaseCTAButtonProps) {
  const { t } = useTranslation();

  // Получаем количество оставшихся дней
  const getDaysLeft = (): number | null => {
    if (!subscription?.end_date) return null;
    const endTime = new Date(subscription.end_date).getTime();
    const diff = Math.max(0, endTime - Date.now());
    return Math.floor(diff / 86_400_000);
  };

  const daysLeft = getDaysLeft();
  const isExpired =
    !subscription ||
    (!subscription.is_active && !subscription.is_trial && !subscription.is_limited);
  const isTrial = subscription?.is_trial;
  const isDaily = subscription?.is_daily;

  // Проверяем, осталось ли мало времени (менее 3 дней) и подписка активна
  const isUrgent = !isExpired && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

  // Daily tariffs renew automatically — no manual renewal button needed in multi-tariff
  if (isMultiTariff && isDaily && !isExpired) return null;

  // Определяем стили в зависимости от статуса
  let buttonStyle: React.CSSProperties = {};
  let textColor = 'text-dark-50';
  let accentColor = 'rgb(var(--color-accent-400))';
  let iconBg = 'rgba(var(--color-accent-400), 0.12)';
  let buttonText = '';
  let hintText = '';
  let borderClass = 'border-2 border-transparent';

  if (isExpired) {
    // Истекла - красный с пульсацией
    accentColor = 'rgb(var(--color-critical-500))';
    iconBg = 'rgba(255,59,92,0.12)';
    textColor = 'text-error-400';
    borderClass = 'border-2 border-error-400/40 animate-pulse-ring-expired';
    buttonText = t('subscription.getSubscription');
    hintText = t('subscription.cta.expiredHint', 'Подписка истекла');
    buttonStyle = {
      background: 'linear-gradient(135deg, rgba(255,59,92,0.08), rgba(255,107,53,0.06))',
    };
  } else if (isUrgent) {
    // Мало времени - оранжевый с пульсацией
    accentColor = 'rgb(var(--color-urgent-400))';
    iconBg = 'rgba(255,184,0,0.12)';
    textColor = 'text-warning-400';
    borderClass = 'border-2 border-warning-400/40 animate-pulse-ring-urgent';
    buttonText = t('subscription.extendUrgent', 'Продлить сейчас');
    hintText = t('subscription.cta.urgentHint', `Осталось ${daysLeft} ${getDaysWord(daysLeft!)}`);
    buttonStyle = {
      background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,107,53,0.06))',
    };
  } else {
    // Обычное состояние
    buttonText = isTrial
      ? t('subscription.trialUpgrade.title')
      : t('subscription.extend');
    hintText = isTrial
      ? t('subscription.cta.trialHint', 'Попробуйте полную версию')
      : isMultiTariff
        ? t('subscription.cta.renewHint', 'Продление подписки')
        : t('subscription.cta.activeHint', 'Подписка активна');
    buttonStyle = {
      background: 'linear-gradient(135deg, rgba(var(--color-accent-400), 0.08), rgba(var(--color-accent-400), 0.06))',
    };
  }

  // Helper для склонения слова "день"
  function getDaysWord(days: number): string {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }

  // Trial → purchase page (buy a real tariff, trial can't be renewed)
  // Multi-tariff active → per-subscription renew page
  // Otherwise → purchase page
  const linkTo = isTrial
    ? '/subscription/purchase'
    : isMultiTariff && subscription?.id
      ? `/subscriptions/${subscription.id}/renew`
      : '/subscription/purchase';

  return (
    <Link to={linkTo} className="block">
      <div
        className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 ${borderClass}`}
      >
        <div
          className="relative flex items-center justify-between rounded-[14px] px-5 py-4 transition-colors duration-300"
          style={buttonStyle}
        >
          {/* Пульсирующая окантовка для срочных состояний */}
          {(isUrgent || isExpired) && (
            <span 
              className={`absolute inset-0 rounded-2xl ${
                isExpired 
                  ? 'border-2 border-error-400/40 animate-pulse-ring-expired' 
                  : 'border-2 border-warning-400/40 animate-pulse-ring-urgent'
              }`} 
            />
          )}

          {/* Left: icon + text */}
          <div className="relative z-10 flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-300"
              style={{
                background: iconBg,
                color: accentColor,
              }}
            >
              <SubscriptionIcon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <div className={`text-[15px] font-semibold ${textColor}`}>
                {buttonText}
              </div>
              <div className="text-[12px] text-dark-50/40">{hintText}</div>
            </div>
          </div>

          {/* Right: chevron */}
          <ChevronRightIcon className="relative z-10 h-5 w-5 flex-shrink-0 text-dark-50/30 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}