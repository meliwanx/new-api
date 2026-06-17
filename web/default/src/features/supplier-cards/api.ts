/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'
import type {
  ApiResponse,
  SupplierCardAdminListParams,
  SupplierCardListParams,
  SupplierCardListResponse,
  SupplierCardOrder,
  SupplierCardOrderListParams,
  SupplierCardPageResponse,
  SupplierCardPlan,
  SupplierCardPlanPayload,
  SupplierCardPlansResponse,
  SupplierCardPurchaseResponse,
  SupplierCardQuotaAdjustPayload,
  SupplierCardQuotaAdjustResponse,
  SupplierCardQuotaLog,
  SupplierCardQuotaLogListParams,
  SupplierCardRedeemResponse,
  SupplierCardSettings,
  SupplierCardShare,
  SupplierCardStats,
  SupplierCardSupplier,
  SupplierCardSupplierListParams,
  SupplierCardUser,
} from './types'

function buildSearchParams(params: object) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
  return searchParams.toString()
}

export async function getSupplierCardUser(): Promise<
  ApiResponse<SupplierCardUser>
> {
  const res = await api.get('/api/user/self', { skipErrorHandler: true })
  return res.data
}

export async function getSupplierCardPlans(): Promise<
  ApiResponse<SupplierCardPlansResponse>
> {
  const res = await api.get('/api/supplier-cards/plans')
  return res.data
}

export async function purchaseSupplierCards(request: {
  plan_id: number
  count: number
}): Promise<ApiResponse<SupplierCardPurchaseResponse>> {
  const res = await api.post('/api/supplier-cards/purchase', request)
  return res.data
}

export async function getSupplierCards(
  params: SupplierCardListParams = {}
): Promise<ApiResponse<SupplierCardListResponse>> {
  const query = buildSearchParams({ p: 1, page_size: 12, ...params })
  const res = await api.get(`/api/supplier-cards/self?${query}`)
  return res.data
}

export async function getSupplierCardShare(
  token: string
): Promise<ApiResponse<SupplierCardShare>> {
  const res = await api.get(`/api/supplier-cards/share/${token}`, {
    skipErrorHandler: true,
  })
  return res.data
}

export async function redeemSupplierCardShare(
  token: string
): Promise<ApiResponse<SupplierCardRedeemResponse>> {
  const res = await api.post(`/api/supplier-cards/share/${token}/redeem`, {})
  return res.data
}

export async function adminGetSupplierCardPlans(): Promise<
  ApiResponse<SupplierCardPlan[]>
> {
  const res = await api.get('/api/supplier-cards/admin/plans')
  return res.data
}

export async function adminCreateSupplierCardPlan(
  request: SupplierCardPlanPayload
): Promise<ApiResponse<SupplierCardPlan>> {
  const res = await api.post('/api/supplier-cards/admin/plans', request)
  return res.data
}

export async function adminUpdateSupplierCardPlan(
  id: number,
  request: SupplierCardPlanPayload
): Promise<ApiResponse<SupplierCardPlan>> {
  const res = await api.put(`/api/supplier-cards/admin/plans/${id}`, request)
  return res.data
}

export async function adminGetSupplierCardOrders(
  params: SupplierCardOrderListParams = {}
): Promise<ApiResponse<SupplierCardPageResponse<SupplierCardOrder>>> {
  const query = buildSearchParams({ p: 1, page_size: 10, ...params })
  const res = await api.get(`/api/supplier-cards/admin/orders?${query}`)
  return res.data
}

export async function adminGetSupplierCards(
  params: SupplierCardAdminListParams = {}
): Promise<ApiResponse<SupplierCardListResponse>> {
  const query = buildSearchParams({ p: 1, page_size: 10, ...params })
  const res = await api.get(`/api/supplier-cards/admin/cards?${query}`)
  return res.data
}

export async function adminGetSupplierCardStats(
  params: SupplierCardAdminListParams = {}
): Promise<ApiResponse<SupplierCardStats>> {
  const query = buildSearchParams(params)
  const res = await api.get(`/api/supplier-cards/admin/stats?${query}`)
  return res.data
}

export async function adminAdjustSupplierCardQuota(
  request: SupplierCardQuotaAdjustPayload
): Promise<ApiResponse<SupplierCardQuotaAdjustResponse>> {
  const res = await api.post('/api/supplier-cards/admin/balance', request)
  return res.data
}

export async function adminGetSupplierCardQuotaLogs(
  params: SupplierCardQuotaLogListParams = {}
): Promise<ApiResponse<SupplierCardPageResponse<SupplierCardQuotaLog>>> {
  const query = buildSearchParams({ p: 1, page_size: 10, ...params })
  const res = await api.get(`/api/supplier-cards/admin/balance-logs?${query}`)
  return res.data
}

export async function adminGetSupplierCardSuppliers(
  params: SupplierCardSupplierListParams = {}
): Promise<ApiResponse<SupplierCardPageResponse<SupplierCardSupplier>>> {
  const query = buildSearchParams({ p: 1, page_size: 10, ...params })
  const res = await api.get(`/api/supplier-cards/admin/suppliers?${query}`)
  return res.data
}

export async function adminGetSupplierCardSettings(): Promise<
  ApiResponse<SupplierCardSettings>
> {
  const res = await api.get('/api/supplier-cards/admin/settings')
  return res.data
}

export async function adminUpdateSupplierCardSettings(
  request: SupplierCardSettings
): Promise<ApiResponse<SupplierCardSettings>> {
  const res = await api.put('/api/supplier-cards/admin/settings', request)
  return res.data
}
