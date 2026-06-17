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
export type InvoiceType = 'personal' | 'business'

export type InvoiceStatus = 'pending' | 'processing' | 'issued' | 'rejected'

export type InvoiceDeliveryMethod = 'upload' | 'email' | 'external'

export interface InvoiceRequest {
  id: number
  topup_id: number
  user_id: number
  trade_no: string
  amount: number
  money: number
  payment_method: string
  invoice_type: InvoiceType
  title: string
  tax_no: string
  email: string
  remark: string
  status: InvoiceStatus
  delivery_method?: InvoiceDeliveryMethod | ''
  admin_note?: string
  reject_reason?: string
  file_name?: string
  file_mime?: string
  file_size?: number
  provider?: string
  external_id?: string
  provider_payload?: string
  created_at: number
  updated_at: number
  issued_at?: number
}

export interface InvoiceCreateRequest {
  trade_no: string
  invoice_type: InvoiceType
  title: string
  tax_no?: string
  email: string
  remark?: string
}

export interface InvoiceIssueRequest {
  delivery_method: Exclude<InvoiceDeliveryMethod, 'upload'>
  admin_note?: string
  provider?: string
  external_id?: string
  provider_payload?: string
}

export interface InvoiceListResponse {
  items: InvoiceRequest[]
  total: number
}

export interface InvoiceApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}
