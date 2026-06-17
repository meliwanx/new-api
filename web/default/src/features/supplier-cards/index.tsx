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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { SectionPageLayout } from '@/components/layout'
import {
  getSupplierCardPlans,
  getSupplierCards,
  getSupplierCardUser,
  purchaseSupplierCards,
} from './api'
import { CardHistory } from './components/card-history'
import { PurchasePanel } from './components/purchase-panel'
import type { SupplierCardListParams } from './types'

const PAGE_SIZE = 12

export function SupplierCards() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{
    page: number
    keyword: string
    status?: number
    unusedOnly: boolean
  }>({
    page: 1,
    keyword: '',
    unusedOnly: false,
  })

  const userQuery = useQuery({
    queryKey: ['supplier-cards', 'user'],
    queryFn: getSupplierCardUser,
  })
  const user = userQuery.data?.data
  const isSupplier = (user?.supplier_level ?? 0) > 0

  const plansQuery = useQuery({
    queryKey: ['supplier-cards', 'plans'],
    queryFn: getSupplierCardPlans,
    enabled: isSupplier,
  })

  const listParams: SupplierCardListParams = {
    p: filters.page,
    page_size: PAGE_SIZE,
    keyword: filters.keyword,
    status: filters.status,
    unused_only: filters.unusedOnly,
  }

  const cardsQuery = useQuery({
    queryKey: ['supplier-cards', 'self', listParams],
    queryFn: () => getSupplierCards(listParams),
    enabled: isSupplier,
  })

  const purchaseMutation = useMutation({
    mutationFn: purchaseSupplierCards,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(t('Supplier cards purchased.'))
      setFilters((current) => ({ ...current, page: 1 }))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supplier-cards'] }),
      ])
    },
  })

  const plansData = plansQuery.data?.data
  const cardsData = cardsQuery.data?.data

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Supplier Cards')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          {!userQuery.isLoading && !isSupplier ? (
            <Empty className='rounded-lg border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <ShieldAlert />
                </EmptyMedia>
                <EmptyTitle>{t('Supplier access required')}</EmptyTitle>
                <EmptyDescription>
                  {t(
                    'Only supplier accounts with level 1 to 10 can buy recharge cards.'
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <PurchasePanel
                plans={plansData?.plans ?? []}
                supplierLevel={
                  plansData?.supplier_level ?? user?.supplier_level ?? 0
                }
                maxPurchaseCount={plansData?.max_purchase_count ?? 1}
                balanceQuota={user?.quota ?? 0}
                loading={userQuery.isLoading || plansQuery.isLoading}
                purchasing={purchaseMutation.isPending}
                onPurchase={(planId, count) =>
                  purchaseMutation.mutate({ plan_id: planId, count })
                }
              />

              <CardHistory
                items={cardsData?.items ?? []}
                total={cardsData?.total ?? 0}
                page={filters.page}
                pageSize={PAGE_SIZE}
                keyword={filters.keyword}
                status={filters.status}
                unusedOnly={filters.unusedOnly}
                loading={cardsQuery.isLoading || cardsQuery.isFetching}
                onFilterChange={(next) =>
                  setFilters({
                    page: 1,
                    keyword: next.keyword,
                    status: next.status,
                    unusedOnly: next.unusedOnly,
                  })
                }
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
              />
            </>
          )}

          {userQuery.isLoading && (
            <Empty className='rounded-lg border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <Ticket />
                </EmptyMedia>
                <EmptyTitle>{t('Loading supplier cards')}</EmptyTitle>
                <EmptyDescription>
                  {t('Checking your supplier level and available balance.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
