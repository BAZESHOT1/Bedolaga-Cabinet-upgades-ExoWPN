import apiClient from './client';
import type { ReferralLevelsMode } from '../types';

// ==================== User-facing types ====================

export interface PartnerApplicationInfo {
  id: number;
  status: string;
  company_name: string | null;
  website_url: string | null;
  telegram_channel: string | null;
  description: string | null;
  expected_monthly_referrals: number | null;
  desired_commission_percent: number | null;
  admin_comment: string | null;
  approved_commission_percent: number | null;
  created_at: string;
  processed_at: string | null;
}

export interface PartnerCampaignInfo {
  id: number;
  name: string;
  start_parameter: string;
  bonus_type: string;
  balance_bonus_kopeks: number;
  subscription_duration_days: number | null;
  subscription_traffic_gb: number | null;
  deep_link: string | null;
  web_link: string | null;
  // Per-campaign statistics
  registrations_count: number;
  referrals_count: number;
  earnings_kopeks: number;
}

export interface PartnerStatusResponse {
  partner_status: string;
  commission_percent: number | null;
  latest_application: PartnerApplicationInfo | null;
  campaigns: PartnerCampaignInfo[];
}

export interface PartnerApplicationRequest {
  company_name?: string;
  website_url?: string;
  telegram_channel?: string;
  description?: string;
  expected_monthly_referrals?: number;
  desired_commission_percent?: number;
}

// ==================== Campaign detailed stats types ====================

export interface DailyStatItem {
  date: string;
  referrals_count: number;
  earnings_kopeks: number;
}

export interface PeriodStats {
  days: number;
  referrals_count: number;
  earnings_kopeks: number;
}

export interface PeriodChange {
  absolute: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PeriodComparison {
  current: PeriodStats;
  previous: PeriodStats;
  referrals_change: PeriodChange;
  earnings_change: PeriodChange;
}

export interface CampaignReferralItem {
  id: number;
  full_name: string;
  created_at: string;
  has_paid: boolean;
  is_active: boolean;
  total_earnings_kopeks: number;
}

export interface PartnerCampaignDetailedStats {
  campaign_id: number;
  campaign_name: string;
  registrations_count: number;
  referrals_count: number;
  earnings_kopeks: number;
  conversion_rate: number;
  earnings_today: number;
  earnings_week: number;
  earnings_month: number;
  daily_stats: DailyStatItem[];
  period_comparison: PeriodComparison;
  top_referrals: CampaignReferralItem[];
}

// ==================== Admin-facing types ====================

export interface AdminPartnerApplicationItem {
  id: number;
  user_id: number;
  username: string | null;
  first_name: string | null;
  telegram_id: number | null;
  company_name: string | null;
  website_url: string | null;
  telegram_channel: string | null;
  description: string | null;
  expected_monthly_referrals: number | null;
  desired_commission_percent: number | null;
  status: string;
  admin_comment: string | null;
  approved_commission_percent: number | null;
  created_at: string;
  processed_at: string | null;
}

export interface AdminPartnerApplicationsResponse {
  items: AdminPartnerApplicationItem[];
  total: number;
}

export interface AdminPartnerItem {
  user_id: number;
  username: string | null;
  first_name: string | null;
  telegram_id: number | null;
  commission_percent: number | null;
  total_referrals: number;
  total_earnings_kopeks: number;
  balance_kopeks: number;
  partner_status: string;
  created_at: string;
}

export interface AdminPartnerListResponse {
  items: AdminPartnerItem[];
  total: number;
}

export interface AdminPartnerDetailResponse {
  user_id: number;
  username: string | null;
  first_name: string | null;
  telegram_id: number | null;
  commission_percent: number | null;
  partner_status: string;
  balance_kopeks: number;
  total_referrals: number;
  paid_referrals: number;
  active_referrals: number;
  earnings_all_time: number;
  earnings_today: number;
  earnings_week: number;
  earnings_month: number;
  conversion_to_paid: number;
  campaigns: {
    id: number;
    name: string;
    start_parameter: string;
    is_active: boolean;
    registrations_count: number;
    referrals_count: number;
    earnings_kopeks: number;
  }[];
  created_at: string;
}

export interface PartnerStats {
  total_partners: number;
  pending_applications: number;
  total_referrals: number;
  total_earnings_kopeks: number;
}

// ==================== Partner Settings types ====================

export interface PartnerSettings {
  withdrawal_enabled: boolean;
  withdrawal_min_amount_kopeks: number;
  withdrawal_cooldown_days: number;
  withdrawal_requisites_text: string;
  partner_section_visible: boolean;
  referral_program_enabled: boolean;
}

export interface PartnerSettingsUpdate {
  withdrawal_enabled?: boolean;
  withdrawal_min_amount_kopeks?: number;
  withdrawal_cooldown_days?: number;
  withdrawal_requisites_text?: string;
  partner_section_visible?: boolean;
  referral_program_enabled?: boolean;
}

// ==================== Referral Levels Extension ====================

/**
 * Расширенный интерфейс уровня реферальной программы.
 * Включает все поля, используемые в AdminReferralLevels.tsx
 * 
 * Примечание: не расширяем ReferralRewardLevel напрямую из-за несовместимости
 * типов (null vs number). Вместо этого создаём отдельный интерфейс.
 */
export interface ExtendedReferralRewardLevel {
  level: number;
  is_active: boolean;
  required_referrals: number;
  required_referrals_active_only: boolean;
  trigger: 'registration' | 'first_topup' | 'every_topup';
  reward_mode: 'money' | 'days' | 'both';
  referrer_percent: number | null;
  referrer_fixed_kopeks: number | null;
  referrer_days: number | null;
  referrer_tariff_id: number | null;
  referrer_tariff_name: string | null;
  referrer_tariff_id_custom?: number | null;
  referrer_days_custom?: number | null;
  referrer_percent_custom?: number | null;
  referrer_fixed_kopeks_custom?: number | null;
  referee_fixed_kopeks: number | null;
  referee_days: number | null;
  referee_tariff_id: number | null;
  referee_tariff_name: string | null;
  max_payments: number | null;
  pays_referrer?: boolean;
  rewards?: string[];
  referee_reward?: string | null;
  trigger_label?: string | null;
  is_current?: boolean;
}

/**
 * Расширенный интерфейс настроек реферальных уровней
 */
export interface ExtendedReferralRewardLevels {
  scheme: 'legacy' | 'levels';
  levels_mode: 'tiers' | 'chain';
  levels: ExtendedReferralRewardLevel[];
  max_level_depth: number;
  max_supported_level: number;
  scheme_locked_by_env: boolean;
  levels_mode_locked_by_env: boolean;
  max_level_depth_locked_by_env: boolean;
  multi_tariff_enabled: boolean;
  available_tariffs: Array<{ id: number; name: string }>;
  level_descriptions?: string[];
  personal_percent?: number | null;
  tier_current_level?: number | null;
  tier_next_level?: number | null;
  tier_next_remaining?: number | null;
  import_notes?: string[];
}

export const partnerApi = {
  // User endpoints
  getStatus: async (): Promise<PartnerStatusResponse> => {
    const response = await apiClient.get<PartnerStatusResponse>('/cabinet/referral/partner/status');
    return response.data;
  },

  apply: async (data: PartnerApplicationRequest): Promise<PartnerApplicationInfo> => {
    const response = await apiClient.post<PartnerApplicationInfo>(
      '/cabinet/referral/partner/apply',
      data,
    );
    return response.data;
  },

  getCampaignStats: async (campaignId: number): Promise<PartnerCampaignDetailedStats> => {
    const response = await apiClient.get<PartnerCampaignDetailedStats>(
      `/cabinet/referral/partner/campaigns/${campaignId}/stats`,
    );
    return response.data;
  },

  // Admin endpoints
  getStats: async (): Promise<PartnerStats> => {
    const response = await apiClient.get<PartnerStats>('/cabinet/admin/partners/stats');
    return response.data;
  },

  getApplications: async (params?: {
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<AdminPartnerApplicationsResponse> => {
    const response = await apiClient.get<AdminPartnerApplicationsResponse>(
      '/cabinet/admin/partners/applications',
      { params },
    );
    return response.data;
  },

  approveApplication: async (
    applicationId: number,
    data: { commission_percent: number; comment?: string },
  ): Promise<void> => {
    await apiClient.post(`/cabinet/admin/partners/applications/${applicationId}/approve`, data);
  },

  rejectApplication: async (applicationId: number, data: { comment?: string }): Promise<void> => {
    await apiClient.post(`/cabinet/admin/partners/applications/${applicationId}/reject`, data);
  },

  getPartners: async (params?: {
    offset?: number;
    limit?: number;
  }): Promise<AdminPartnerListResponse> => {
    const response = await apiClient.get<AdminPartnerListResponse>('/cabinet/admin/partners', {
      params,
    });
    return response.data;
  },

  getPartnerDetail: async (userId: number): Promise<AdminPartnerDetailResponse> => {
    const response = await apiClient.get<AdminPartnerDetailResponse>(
      `/cabinet/admin/partners/${userId}`,
    );
    return response.data;
  },

  updateCommission: async (userId: number, commissionPercent: number): Promise<void> => {
    await apiClient.patch(`/cabinet/admin/partners/${userId}/commission`, {
      commission_percent: commissionPercent,
    });
  },

  revokePartner: async (userId: number): Promise<void> => {
    await apiClient.post(`/cabinet/admin/partners/${userId}/revoke`);
  },

  assignCampaign: async (userId: number, campaignId: number): Promise<void> => {
    await apiClient.post(`/cabinet/admin/partners/${userId}/campaigns/${campaignId}/assign`);
  },

  unassignCampaign: async (userId: number, campaignId: number): Promise<void> => {
    await apiClient.post(`/cabinet/admin/partners/${userId}/campaigns/${campaignId}/unassign`);
  },

  // Settings
  getPartnerSettings: async (): Promise<PartnerSettings> => {
    const response = await apiClient.get<PartnerSettings>('/cabinet/admin/partners/settings');
    return response.data;
  },

  updatePartnerSettings: async (data: PartnerSettingsUpdate): Promise<PartnerSettings> => {
    const response = await apiClient.patch<PartnerSettings>(
      '/cabinet/admin/partners/settings',
      data,
    );
    return response.data;
  },

  // ==================== Reward levels ====================

  /**
   * Получить настройки реферальных уровней
   */
  getReferralLevels: async (): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.get<ExtendedReferralRewardLevels>(
      '/cabinet/admin/partners/referral-levels',
    );
    return response.data;
  },

  /**
   * Обновить уровень. Отправляет ТОЛЬКО изменяемые поля.
   */
  upsertReferralLevel: async (
    level: number,
    patch: Partial<Omit<ExtendedReferralRewardLevel, 'level'>>,
  ): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.put<ExtendedReferralRewardLevels>(
      `/cabinet/admin/partners/referral-levels/${level}`,
      patch,
    );
    return response.data;
  },

  /**
   * Удалить уровень
   */
  deleteReferralLevel: async (level: number): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.delete<ExtendedReferralRewardLevels>(
      `/cabinet/admin/partners/referral-levels/${level}`,
    );
    return response.data;
  },

  /**
   * Переносит действующие REFERRAL_* в уровень 1
   */
  importLegacyReferralSettings: async (): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.post<ExtendedReferralRewardLevels>(
      '/cabinet/admin/partners/referral-levels/import-legacy',
    );
    return response.data;
  },

  /**
   * Обновить глубину цепочки
   */
  updateReferralDepth: async (maxLevelDepth: number): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.patch<ExtendedReferralRewardLevels>(
      '/cabinet/admin/partners/referral-depth',
      { max_level_depth: maxLevelDepth },
    );
    return response.data;
  },

  /**
   * Обновить схему (legacy | levels)
   */
  updateReferralScheme: async (scheme: 'legacy' | 'levels'): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.patch<ExtendedReferralRewardLevels>(
      '/cabinet/admin/partners/referral-scheme',
      { scheme },
    );
    return response.data;
  },

  /**
   * Обновить режим уровней (tiers | chain)
   */
  updateReferralLevelsMode: async (mode: ReferralLevelsMode): Promise<ExtendedReferralRewardLevels> => {
    const response = await apiClient.patch<ExtendedReferralRewardLevels>(
      '/cabinet/admin/partners/referral-levels-mode',
      { levels_mode: mode },
    );
    return response.data;
  },
};