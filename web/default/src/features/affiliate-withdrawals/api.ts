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
  AffiliateWithdrawal,
  AffiliateWithdrawalApiResponse,
  AffiliateWithdrawalCreateRequest,
  AffiliateWithdrawalListResponse,
  AffiliateWithdrawalStatus,
} from './types'

export async function createAffiliateWithdrawal(
  request: AffiliateWithdrawalCreateRequest
): Promise<AffiliateWithdrawalApiResponse<AffiliateWithdrawal>> {
  const res = await api.post('/api/user/aff/withdrawals', request)
  return res.data
}

export async function getUserAffiliateWithdrawals(params: {
  page: number
  pageSize: number
}): Promise<AffiliateWithdrawalApiResponse<AffiliateWithdrawalListResponse>> {
  const search = new URLSearchParams({
    p: params.page.toString(),
    page_size: params.pageSize.toString(),
  })
  const res = await api.get(`/api/user/aff/withdrawals?${search.toString()}`)
  return res.data
}

export async function getAdminAffiliateWithdrawals(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: AffiliateWithdrawalStatus | 'all'
  userId?: string
}): Promise<AffiliateWithdrawalApiResponse<AffiliateWithdrawalListResponse>> {
  const search = new URLSearchParams({
    p: params.page.toString(),
    page_size: params.pageSize.toString(),
  })
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.status && params.status !== 'all') {
    search.set('status', params.status)
  }
  if (params.userId) search.set('user_id', params.userId)
  const res = await api.get(
    `/api/user/affiliate-withdrawals?${search.toString()}`
  )
  return res.data
}

export async function markAffiliateWithdrawalProcessing(
  id: number,
  adminNote?: string
): Promise<AffiliateWithdrawalApiResponse> {
  const res = await api.post(`/api/user/affiliate-withdrawals/${id}/process`, {
    admin_note: adminNote || '',
  })
  return res.data
}

export async function completeAffiliateWithdrawal(
  id: number,
  adminNote?: string
): Promise<AffiliateWithdrawalApiResponse> {
  const res = await api.post(`/api/user/affiliate-withdrawals/${id}/complete`, {
    admin_note: adminNote || '',
  })
  return res.data
}

export async function rejectAffiliateWithdrawal(
  id: number,
  reason: string
): Promise<AffiliateWithdrawalApiResponse> {
  const res = await api.post(`/api/user/affiliate-withdrawals/${id}/reject`, {
    reason,
  })
  return res.data
}
