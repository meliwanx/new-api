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
import { Ticket, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatCurrencyUSD,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { SUPPLIER_CARD_STATUS, type SupplierCardStatus } from '../types'

const statusMeta: Record<
  SupplierCardStatus,
  { label: string; variant: StatusVariant }
> = {
  [SUPPLIER_CARD_STATUS.UNUSED]: {
    label: 'Unused',
    variant: 'success',
  },
  [SUPPLIER_CARD_STATUS.REDEEMED]: {
    label: 'Redeemed',
    variant: 'neutral',
  },
  [SUPPLIER_CARD_STATUS.DISABLED]: {
    label: 'Disabled',
    variant: 'danger',
  },
}

export function getSupplierCardStatusMeta(status: SupplierCardStatus) {
  return statusMeta[status] ?? { label: 'Unknown', variant: 'neutral' as const }
}

interface SupplierCardVisualProps {
  amount: number
  quota: number
  codePreview?: string
  code?: string
  status?: SupplierCardStatus
  supplierName?: string
  redeemedTime?: number
  className?: string
  children?: React.ReactNode
}

export function SupplierCardVisual({
  amount,
  quota,
  codePreview,
  code,
  status = SUPPLIER_CARD_STATUS.UNUSED,
  supplierName,
  redeemedTime,
  className,
  children,
}: SupplierCardVisualProps) {
  const { t } = useTranslation()
  const meta = getSupplierCardStatusMeta(status)
  const displayCode = code ?? codePreview ?? '----'

  return (
    <div
      className={cn(
        'bg-card text-card-foreground ring-foreground/5 relative isolate overflow-hidden rounded-lg border shadow-sm ring-1',
        className
      )}
    >
      <div className='bg-primary absolute inset-x-0 top-0 h-1' />
      <div className='bg-muted/30 pointer-events-none absolute inset-y-0 right-0 w-1/3 border-l' />

      <div className='relative flex min-h-48 flex-col justify-between gap-5 p-4 sm:min-h-52 sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <div className='bg-background flex size-9 items-center justify-center rounded-lg border'>
              <Ticket className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                {t('Supplier Recharge Card')}
              </div>
              <div className='truncate text-sm font-semibold'>
                {supplierName || t('Official supplier card')}
              </div>
            </div>
          </div>
          <StatusBadge
            label={t(meta.label)}
            variant={meta.variant}
            copyable={false}
          />
        </div>

        <div className='flex items-end justify-between gap-3'>
          <div className='min-w-0'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Face Value')}
            </div>
            <div className='mt-1 font-mono text-3xl font-bold tracking-tight sm:text-4xl'>
              {formatCurrencyUSD(amount)}
            </div>
            <div className='text-muted-foreground mt-1 text-xs'>
              {t('Redeems {{quota}} to the account balance', {
                quota: formatQuota(quota),
              })}
            </div>
          </div>
          <div className='bg-background/70 hidden shrink-0 rounded-lg border p-2 sm:block'>
            <Sparkles className='text-muted-foreground size-5' />
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'>
          <div className='min-w-0'>
            <div className='text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase'>
              {t('Redeem Code')}
            </div>
            <div className='bg-background rounded-lg border px-3 py-2 font-mono text-sm font-semibold tracking-wider break-all'>
              {displayCode}
            </div>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <ShieldCheck className='size-4 shrink-0' />
            <span className='truncate'>
              {redeemedTime
                ? t('Redeemed at {{time}}', {
                    time: formatTimestampToDate(redeemedTime),
                  })
                : t('Login required to redeem')}
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
