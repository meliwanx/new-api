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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { Download, Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { parseQuotaFromDollars } from '@/lib/format'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { exportRedemptions, getRedemptions, searchRedemptions } from '../api'
import {
  ERROR_MESSAGES,
  REDEMPTION_STATUS,
  SUCCESS_MESSAGES,
  getRedemptionStatusOptions,
} from '../constants'
import { isRedemptionExpired } from '../lib'
import type { Redemption, RedemptionExportFormat } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useRedemptionsColumns } from './redemptions-columns'
import { useRedemptions } from './redemptions-provider'

const route = getRouteApi('/_authenticated/redemption-codes/')

function isDisabledRedemptionRow(redemption: Redemption) {
  return (
    redemption.status !== REDEMPTION_STATUS.ENABLED ||
    isRedemptionExpired(redemption.expired_time, redemption.status)
  )
}

function getSingleFilterValue(filters: ColumnFiltersState, columnId: string) {
  const value = filters.find((filter) => filter.id === columnId)?.value
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : ''
  }
  return typeof value === 'string' ? value : ''
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function RedemptionsTable() {
  const { t } = useTranslation()
  const columns = useRedemptionsColumns()
  const { refreshTrigger } = useRedemptions()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const routeSearch = route.useSearch()
  const navigate = route.useNavigate()
  const amountFilter = routeSearch.amount ?? ''
  const [amountDraft, setAmountDraft] = useState(amountFilter)
  const [exportingFormat, setExportingFormat] =
    useState<RedemptionExportFormat | null>(null)

  useEffect(() => {
    setAmountDraft(amountFilter)
  }, [amountFilter])

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: routeSearch,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter = getSingleFilterValue(columnFilters, 'status')
  const quotaFilter = useMemo(() => {
    const normalized = amountFilter.trim()
    if (!normalized) return undefined
    const amount = Number(normalized)
    if (!Number.isFinite(amount) || amount < 0) return undefined
    const quota = parseQuotaFromDollars(amount)
    return quota > 0 ? quota : undefined
  }, [amountFilter])

  const applyAmountFilter = () => {
    const normalized = amountDraft.trim()
    if (normalized) {
      const amount = Number(normalized)
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error(t('Invalid face value amount'))
        return
      }
    }

    navigate({
      search: (prev) => ({
        ...prev,
        page: undefined,
        amount: normalized || undefined,
      }),
    })
  }

  const handleExport = async (format: RedemptionExportFormat) => {
    setExportingFormat(format)
    try {
      const blob = await exportRedemptions({
        keyword: globalFilter?.trim(),
        status: statusFilter || undefined,
        quota: quotaFilter,
        format,
      })
      downloadBlob(blob, `redemption-codes.${format}`)
      toast.success(t(SUCCESS_MESSAGES.REDEMPTIONS_EXPORTED))
    } catch {
      toast.error(t(ERROR_MESSAGES.EXPORT_FAILED))
    } finally {
      setExportingFormat(null)
    }
  }

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'redemptions',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilter,
      quotaFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: statusFilter || undefined,
        quota: quotaFilter,
      }

      const result = hasFilter
        ? await searchRedemptions({ ...params, keyword: globalFilter })
        : await getRedemptions(params)

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const redemptions = data?.items || []

  const { table } = useDataTable({
    data: redemptions,
    columns,
    enableRowSelection: true,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const id = String(row.getValue('id'))
      const key = row.original.key.toLowerCase()
      const searchValue = String(filterValue).toLowerCase()

      return (
        name.includes(searchValue) ||
        id.includes(searchValue) ||
        key.includes(searchValue)
      )
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const redemptionStatusOptions = useMemo(
    () => getRedemptionStatusOptions(t),
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Redemption Codes Found')}
      emptyDescription={t(
        'No redemption codes available. Create your first redemption code to get started.'
      )}
      skeletonKeyPrefix='redemptions-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name or ID...'),
        additionalSearch: (
          <div className='flex w-full items-center gap-2 sm:w-auto'>
            <Input
              type='number'
              min='0'
              step='0.01'
              value={amountDraft}
              onChange={(event) => setAmountDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applyAmountFilter()
                }
              }}
              placeholder={t('Face value amount')}
              className='w-full sm:w-[150px]'
            />
            <Button
              variant='outline'
              onClick={applyAmountFilter}
              disabled={amountDraft.trim() === amountFilter.trim()}
            >
              <Search />
              {t('Search')}
            </Button>
          </div>
        ),
        hasAdditionalFilters: Boolean(amountFilter.trim()),
        onReset: () => {
          setAmountDraft('')
          navigate({
            search: (prev) => ({
              ...prev,
              page: undefined,
              amount: undefined,
            }),
          })
        },
        preActions: (
          <>
            <Button
              variant='outline'
              onClick={() => handleExport('csv')}
              disabled={exportingFormat != null}
            >
              {exportingFormat === 'csv' ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Download />
              )}
              {t('Export CSV')}
            </Button>
            <Button
              variant='outline'
              onClick={() => handleExport('txt')}
              disabled={exportingFormat != null}
            >
              {exportingFormat === 'txt' ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Download />
              )}
              {t('Export TXT')}
            </Button>
          </>
        ),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: redemptionStatusOptions,
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile }) =>
        isDisabledRedemptionRow(row.original)
          ? isMobile
            ? DISABLED_ROW_MOBILE
            : DISABLED_ROW_DESKTOP
          : undefined
      }
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
