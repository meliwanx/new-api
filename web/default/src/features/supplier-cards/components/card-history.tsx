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
import { ChevronLeft, ChevronRight, Search, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatCurrencyUSD,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import { type SupplierCard, type SupplierCardStatus } from '../types'
import { SupplierCardVisual } from './supplier-card-visual'

interface CardHistoryProps {
  items: SupplierCard[]
  total: number
  page: number
  pageSize: number
  keyword: string
  loading?: boolean
  onFilterChange: (filters: {
    keyword: string
  }) => void
  onPageChange: (page: number) => void
}

function getShareUrl(token?: string) {
  if (!token || typeof window === 'undefined') return ''
  return `${window.location.origin}/c/${token}`
}

function getShareCopyText(
  card: SupplierCard,
  shareUrl: string,
  t: (key: string, options?: Record<string, string>) => string
) {
  if (!shareUrl) return ''
  return [
    t('Recharge card gift: {{amount}} value, redeemable for {{quota}} quota.', {
      amount: formatCurrencyUSD(card.amount),
      quota: formatQuota(card.quota),
    }),
    t(
      'Open the link to preview the card, then sign in to redeem it to your account.'
    ),
    shareUrl,
  ].join('\n')
}

export function CardHistory({
  items,
  total,
  page,
  pageSize,
  keyword,
  loading,
  onFilterChange,
  onPageChange,
}: CardHistoryProps) {
  const { t } = useTranslation()
  const [draftKeyword, setDraftKeyword] = useState(keyword)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const applyKeyword = () => {
    onFilterChange({ keyword: draftKeyword.trim() })
  }

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Available Cards')}</CardTitle>
        <CardDescription>
          {t('Only unused purchased recharge cards are shown here.')}
        </CardDescription>
      </CardHeader>

      <CardContent className='flex flex-col gap-4 p-4'>
        <div className='grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]'>
          <div className='flex min-w-0 gap-2'>
            <Input
              value={draftKeyword}
              placeholder={t('Search code, preview, or order number')}
              onChange={(event) => setDraftKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyKeyword()
              }}
            />
            <Button variant='outline' onClick={applyKeyword}>
              <Search data-icon='inline-start' />
              {t('Search')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className='h-72 rounded-lg' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty className='rounded-lg border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Ticket />
              </EmptyMedia>
              <EmptyTitle>{t('No supplier cards found')}</EmptyTitle>
              <EmptyDescription>
                {t('Unused purchased recharge cards will appear here.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {items.map((card) => {
              const shareUrl = getShareUrl(card.share_token)
              const shareCopyText = getShareCopyText(card, shareUrl, t)
              return (
                <SupplierCardVisual
                  key={card.id}
                  amount={card.amount}
                  quota={card.quota}
                  code={card.code}
                  codePreview={card.code_preview}
                  status={card.status as SupplierCardStatus}
                  redeemedTime={card.redeemed_time}
                >
                  <div className='text-muted-foreground grid gap-2 border-t pt-3 text-xs sm:grid-cols-2'>
                    <div>
                      <span>{t('Order No.')}</span>
                      <div className='text-foreground mt-0.5 truncate font-mono'>
                        {card.order_no}
                      </div>
                    </div>
                    <div>
                      <span>{t('Purchased At')}</span>
                      <div className='text-foreground mt-0.5'>
                        {formatTimestampToDate(card.created_time)}
                      </div>
                    </div>
                    <div>
                      <span>{t('Purchase Price')}</span>
                      <div className='text-foreground mt-0.5 font-mono'>
                        {formatCurrencyUSD(card.purchase_price)}
                      </div>
                    </div>
                    <div>
                      <span>{t('Redeemed User ID')}</span>
                      <div className='text-foreground mt-0.5 font-mono'>
                        {card.redeemed_user_id || '-'}
                      </div>
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-2 border-t pt-3'>
                    {card.code && (
                      <CopyButton
                        value={card.code}
                        variant='outline'
                        size='sm'
                        tooltip={t('Copy redeem code')}
                        successTooltip={t('Redeem code copied')}
                      >
                        {t('Copy Code')}
                      </CopyButton>
                    )}
                    {shareUrl && (
                      <CopyButton
                        value={shareCopyText}
                        variant='outline'
                        size='sm'
                        tooltip={t('Copy marketing text and redeem link')}
                        successTooltip={t(
                          'Marketing text and redeem link copied'
                        )}
                      >
                        {t('Copy Redeem Link')}
                      </CopyButton>
                    )}
                  </div>
                </SupplierCardVisual>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className='flex items-center justify-end gap-2'>
            <span className='text-muted-foreground text-xs'>
              {t('Page {{page}} of {{total}}', { page, total: totalPages })}
            </span>
            <Button
              variant='outline'
              size='icon'
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              aria-label={t('Previous')}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant='outline'
              size='icon'
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              aria-label={t('Next')}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
