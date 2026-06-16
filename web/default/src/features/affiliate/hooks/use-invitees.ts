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
import { useCallback, useEffect, useState } from 'react'
import { getAffiliateInvitees } from '@/features/wallet/api'
import type { AffiliateInvitee } from '@/features/wallet/types'

const PAGE_SIZE = 10

export function useInvitees() {
  const [items, setItems] = useState<AffiliateInvitee[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchInvitees = useCallback(async (targetPage: number) => {
    try {
      setLoading(true)
      const response = await getAffiliateInvitees(targetPage, PAGE_SIZE)
      if (response.success && response.data) {
        setItems(response.data.items ?? [])
        setTotal(response.data.total ?? 0)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch invitees:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvitees(page)
  }, [page, fetchInvitees])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    loading,
    setPage,
    refetch: () => fetchInvitees(page),
  }
}
