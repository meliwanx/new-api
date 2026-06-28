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
export type AffiliateWithdrawalMethod = 'alipay'

export type AffiliateWithdrawalStatus = 'processing' | 'completed' | 'rejected'

export interface AffiliateWithdrawal {
  id: number
  user_id: number
  amount: number
  method: AffiliateWithdrawalMethod
  account: string
  account_name: string
  status: AffiliateWithdrawalStatus
  admin_note?: string
  reject_reason?: string
  created_at: number
  updated_at: number
  processed_at?: number
}

export interface AffiliateWithdrawalCreateRequest {
  amount: number
  method: AffiliateWithdrawalMethod
  account: string
  account_name: string
}

export interface AffiliateWithdrawalListResponse {
  items: AffiliateWithdrawal[]
  total: number
}

export interface AffiliateWithdrawalApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}
