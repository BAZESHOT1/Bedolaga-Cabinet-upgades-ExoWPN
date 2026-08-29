// components/dashboard/ServersStatus.tsx
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { adminRemnawaveApi } from '../../api/adminRemnawave';
import { XIcon, ChevronRightIcon, UsersIcon } from '../icons';
import { getFlagEmoji as getCountryFlag } from '../../utils/subscriptionHelpers';

interface NodeWithStatus {
  uuid: string;
  name: string;
  country_code?: string;
  is_connected: boolean;
  is_disabled: boolean;
  is_node_online: boolean;
  is_xray_running: boolean;
  users_online: number;
  address?: string;
}

export default function ServersStatus() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Получаем реальный статус нод из Remnawave API
  const { data: nodesData, isLoading } = useQuery({
    queryKey: ['servers-status'],
    queryFn: () => adminRemnawaveApi.getNodesOverview(),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });

  const nodes: NodeWithStatus[] = nodesData?.nodes || [];

  if (isLoading) {
    return (
      <div className="bento-card flex items-center justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  const displayedNodes = isExpanded ? nodes : nodes.slice(0, 5);
  const onlineCount = nodes.filter(n => n.is_connected && n.is_node_online).length;
  const offlineCount = nodes.filter(n => !n.is_connected || !n.is_node_online).length;

  const StatusBadge = ({ node }: { node: NodeWithStatus }) => {
    const isOnline = node.is_connected && node.is_node_online && node.is_xray_running;
    
    if (node.is_disabled) {
      return (
        <span className="flex items-center gap-1 text-[9px] font-medium text-dark-400 sm:text-[10px]">
          <XIcon className="h-3 w-3" />
          {t('servers.disabled', 'Тех. работы')}
        </span>
      );
    }

    if (!isOnline) {
      return (
        <span className="flex items-center gap-1 text-[9px] font-medium text-error-400 sm:text-[10px]">
          <XIcon className="h-3 w-3" />
          {t('servers.offline', 'Не отвечает')}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-[9px] font-medium text-success-400 sm:text-[10px]">
        <div className="h-1.5 w-1.5 rounded-full bg-success-400 animate-pulse" />
        {t('servers.online', 'Онлайн')}
      </span>
    );
  };

  return (
    <div className="bento-card p-4 sm:p-5">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-dark-100 sm:text-base">
            {t('servers.status', 'Статус серверов')}
          </h3>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="rounded-full bg-accent-500/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-400 sm:px-2 sm:text-[10px]">
              {nodes.length}
            </span>
            {onlineCount > 0 && (
              <span className="rounded-full bg-success-500/10 px-1.5 py-0.5 text-[9px] font-medium text-success-400 sm:px-2 sm:text-[10px]">
                ▲ {onlineCount}
              </span>
            )}
            {offlineCount > 0 && (
              <span className="rounded-full bg-error-500/10 px-1.5 py-0.5 text-[9px] font-medium text-error-400 sm:px-2 sm:text-[10px]">
                ▼ {offlineCount}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-dark-400/60 sm:text-xs">
          {t('servers.usersOnline', 'Пользователей онлайн')}: {nodesData?.total_users_online || 0}
        </span>
      </div>
      
      {/* Nodes List */}
      <div className="space-y-1.5 sm:space-y-2">
        {displayedNodes.map((node) => (
          <div
            key={node.uuid}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors sm:px-4 sm:py-3 ${
              node.is_connected && node.is_node_online && node.is_xray_running && !node.is_disabled
                ? 'bg-dark-800/30 hover:bg-dark-800/50'
                : node.is_disabled
                ? 'bg-dark-700/20 hover:bg-dark-700/30 border border-dark-600/20'
                : 'bg-error-500/5 hover:bg-error-500/10 border border-error-500/10'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 sm:gap-3">
              <span className="text-lg flex-shrink-0 leading-none sm:text-xl">
                {getCountryFlag(node.country_code || '')}
              </span>
              <span className="truncate text-sm font-medium text-dark-200">
                {node.name}
              </span>
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 sm:gap-4">
              {/* Количество пользователей на ноде */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <UsersIcon className="h-3 w-3 text-dark-400 sm:h-3.5 sm:w-3.5" />
                <span className="text-[10px] font-medium text-dark-300 sm:text-[11px]">
                  {node.users_online || 0}
                </span>
              </div>
              
              <StatusBadge node={node} />
            </div>
          </div>
        ))}
        
        {/* Кнопка "Показать все" */}
        {nodes.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-dark-400 transition-all duration-200 hover:bg-dark-800/50 hover:text-accent-400 sm:py-2.5"
          >
            {isExpanded ? (
              <>
                {t('servers.showLess', 'Свернуть')}
                <ChevronRightIcon className="h-3.5 w-3.5 rotate-90 transition-transform duration-200" />
              </>
            ) : (
              <>
                {t('servers.showAll', 'Показать все')}
                <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}