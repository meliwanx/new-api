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
import { Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AffiliateSummary } from '../types'

interface MultiLevelAffiliateCardProps {
  summary: AffiliateSummary | null
  loading?: boolean
}

const LEVEL_LABEL_KEYS: Record<number, string> = {
  1: 'Level 1 (Direct)',
  2: 'Level 2',
  3: 'Level 3',
}

export function MultiLevelAffiliateCard({
  summary,
  loading,
}: MultiLevelAffiliateCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='space-y-3 p-3 sm:p-4'>
          <Skeleton className='h-5 w-40' />
          <div className='grid gap-2 sm:grid-cols-3'>
            <Skeleton className='h-16 rounded-lg' />
            <Skeleton className='h-16 rounded-lg' />
            <Skeleton className='h-16 rounded-lg' />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Only render the multi-level breakdown when the feature is enabled.
  if (!summary || !summary.enabled) {
    return null
  }

  const validityLabel =
    summary.validity_days > 0
      ? t('Commission valid for {{days}} days after sign-up', {
          days: summary.validity_days,
        })
      : t('Commission valid permanently')

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='space-y-3 p-3 sm:space-y-4 sm:p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
              <Network className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-semibold'>
                {t('Multi-level Referral')}
              </h3>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {validityLabel}
              </p>
            </div>
          </div>
          <div className='text-right'>
            <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
              {t('Total Commission')}
            </div>
            <div className='mt-0.5 text-sm font-semibold tabular-nums'>
              {formatQuota(summary.total_commission)}
            </div>
          </div>
        </div>

        <div className='grid gap-2 sm:grid-cols-3'>
          {summary.levels.map((level) => (
            <div
              key={level.level}
              className='bg-background/60 rounded-lg border p-3'
            >
              <div className='flex items-center justify-between'>
                <span className='text-xs font-medium'>
                  {t(LEVEL_LABEL_KEYS[level.level] ?? `Level ${level.level}`)}
                </span>
                <span className='text-muted-foreground text-[11px] tabular-nums'>
                  {Math.round(level.rate * 100)}%
                </span>
              </div>
              <div className='mt-2 flex items-end justify-between gap-2'>
                <div>
                  <div className='text-muted-foreground text-[10px] tracking-wider uppercase'>
                    {t('Members')}
                  </div>
                  <div className='text-base font-semibold tabular-nums'>
                    {level.count}
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-muted-foreground text-[10px] tracking-wider uppercase'>
                    {t('Earned')}
                  </div>
                  <div className='text-sm font-semibold tabular-nums'>
                    {formatQuota(level.commission)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
