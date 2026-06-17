export const SUPPLIER_CARD_STATUS = {
  UNUSED: 1,
  REDEEMED: 2,
  DISABLED: 3,
} as const

export type SupplierCardStatus =
  (typeof SUPPLIER_CARD_STATUS)[keyof typeof SUPPLIER_CARD_STATUS]

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface SupplierCardPlan {
  id: number
  amount: number
  quota: number
  enabled: boolean
  sort_order: number
  prices: string
  price: number
  created_time?: number
  updated_time?: number
}

export interface SupplierCard {
  id: number
  supplier_user_id: number
  supplier_level: number
  order_id: number
  order_no: string
  plan_id: number
  amount: number
  quota: number
  purchase_price: number
  debit_quota: number
  code?: string
  code_preview: string
  share_token?: string
  share_token_preview: string
  status: SupplierCardStatus
  redeemed_user_id: number
  redeemed_time: number
  created_time: number
  updated_time: number
}

export interface SupplierCardOrder {
  id: number
  order_no: string
  supplier_user_id: number
  supplier_level: number
  plan_id: number
  amount: number
  quota: number
  count: number
  unit_price: number
  total_price: number
  total_debit_quota: number
  created_time: number
}

export interface SupplierCardUser {
  id: number
  username?: string
  display_name?: string
  quota: number
  supplier_card_quota: number
  supplier_level: number
}

export interface SupplierCardSupplier {
  id: number
  username: string
  display_name: string
  email: string
  status: number
  role: number
  group: string
  quota: number
  supplier_card_quota: number
  supplier_level: number
  created_at: number
  last_login_at: number
}

export interface SupplierCardPlansResponse {
  supplier_level: number
  supplier_card_quota: number
  max_purchase_count: number
  plans: SupplierCardPlan[]
}

export interface SupplierCardPurchaseResponse {
  order: SupplierCardOrder
  cards: SupplierCard[]
}

export interface SupplierCardPageResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type SupplierCardListResponse = SupplierCardPageResponse<SupplierCard>

export interface SupplierCardListParams {
  p?: number
  page_size?: number
  status?: number
  keyword?: string
  unused_only?: boolean
}

export interface SupplierCardShare {
  id: number
  amount: number
  quota: number
  code_preview: string
  share_token_preview: string
  status: SupplierCardStatus
  redeemed_time: number
  supplier_display_name: string
  purchase_price: number
}

export interface SupplierCardRedeemResponse {
  quota: number
  card: SupplierCard
}

export interface SupplierCardSettings {
  max_purchase_count: number
}

export interface SupplierCardQuotaLog {
  id: number
  supplier_user_id: number
  operator_user_id: number
  action: string
  quota_delta: number
  quota_before: number
  quota_after: number
  order_id: number
  order_no: string
  memo: string
  created_time: number
}

export interface SupplierCardQuotaAdjustPayload {
  user_id: number
  mode: 'add' | 'subtract' | 'override'
  value: number
  memo?: string
}

export interface SupplierCardQuotaAdjustResponse {
  user: SupplierCardUser
  movement: SupplierCardQuotaLog
}

export interface SupplierCardQuotaLogListParams {
  p?: number
  page_size?: number
  supplier_user_id?: number
  operator_user_id?: number
  action?: string
  keyword?: string
  created_time_from?: number
  created_time_to?: number
}

export interface SupplierCardSupplierListParams {
  p?: number
  page_size?: number
  keyword?: string
  supplier_level?: number
}

export interface SupplierCardStatsByAmount {
  amount: number
  count: number
  sales: number
}

export interface SupplierCardStatsByLevel {
  supplier_level: number
  count: number
  sales: number
}

export interface SupplierCardStats {
  sold_count: number
  redeemed_count: number
  unused_count: number
  disabled_count: number
  total_sales: number
  by_amount: SupplierCardStatsByAmount[]
  by_level: SupplierCardStatsByLevel[]
}

export interface SupplierCardAdminListParams extends SupplierCardListParams {
  amount?: number
  supplier_level?: number
  supplier_user_id?: number
  redeemed_user_id?: number
  created_time_from?: number
  created_time_to?: number
  redeemed_time_from?: number
  redeemed_time_to?: number
}

export interface SupplierCardOrderListParams {
  p?: number
  page_size?: number
  amount?: number
  supplier_level?: number
  supplier_user_id?: number
  keyword?: string
  created_time_from?: number
  created_time_to?: number
}

export interface SupplierCardPlanPayload {
  amount: number
  enabled: boolean
  sort_order: number
  prices: Record<string, number>
}
