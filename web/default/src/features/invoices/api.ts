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
  InvoiceApiResponse,
  InvoiceIssueRequest,
  InvoiceListResponse,
  InvoiceStatus,
} from './types'

export async function getAdminInvoices(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: InvoiceStatus | 'all'
}): Promise<InvoiceApiResponse<InvoiceListResponse>> {
  const search = new URLSearchParams({
    p: params.page.toString(),
    page_size: params.pageSize.toString(),
  })
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.status && params.status !== 'all') {
    search.set('status', params.status)
  }
  const res = await api.get(`/api/user/invoice?${search.toString()}`)
  return res.data
}

export async function markInvoiceProcessing(
  id: number,
  adminNote?: string
): Promise<InvoiceApiResponse> {
  const res = await api.post(`/api/user/invoice/${id}/process`, {
    admin_note: adminNote || '',
  })
  return res.data
}

export async function issueInvoice(
  id: number,
  data: InvoiceIssueRequest
): Promise<InvoiceApiResponse> {
  const res = await api.post(`/api/user/invoice/${id}/issue`, data)
  return res.data
}

export async function uploadInvoiceFile(
  id: number,
  file: File,
  adminNote?: string
): Promise<InvoiceApiResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('admin_note', adminNote || '')
  const res = await api.post(`/api/user/invoice/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function rejectInvoice(
  id: number,
  reason: string
): Promise<InvoiceApiResponse> {
  const res = await api.post(`/api/user/invoice/${id}/reject`, { reason })
  return res.data
}

export function getAdminInvoiceDownloadUrl(id: number): string {
  return `/api/user/invoice/${id}/admin-download`
}
