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
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AffiliateInvitee } from '@/features/wallet/types'

interface InviteesCardProps {
  items: AffiliateInvitee[]
  total: number
  page: number
  totalPages: number
  loading?: boolean
  onPageChange: (page: number) => void
}

const LEVEL_LABEL_KEYS: Record<number, string> = {
  1: 'Level 1 (Direct)',
  2: 'Level 2',
  3: 'Level 3',
}

const LEVEL_BADGE_VARIANT: Record<
  number,
  'default' | 'secondary' | 'outline'
> = {
  1: 'default',
  2: 'secondary',
  3: 'outline',
}

export function InviteesCard({
  items,
  total,
  page,
  totalPages,
  loading,
  onPageChange,
}: InviteesCardProps) {
  const { t } = useTranslation()

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='space-y-3 p-3 sm:space-y-4 sm:p-4'>
        <div className='flex items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <Users className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Invited Users')}
            </h3>
            <p className='text-muted-foreground line-clamp-1 text-xs'>
              {t('Total {{count}} members in your referral network', {
                count: total,
              })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className='space-y-2'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-10 rounded-lg' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center justify-center gap-1 py-10 text-center'>
            <Users className='size-6 opacity-40' />
            <p className='text-sm'>{t('No invited users yet')}</p>
            <p className='text-xs'>
              {t('Share your referral link to start earning commission.')}
            </p>
          </div>
        ) : (
          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Username')}</TableHead>
                  <TableHead>{t('Level')}</TableHead>
                  <TableHead className='hidden sm:table-cell'>
                    {t('Registered')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Earned Commission')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invitee) => (
                  <TableRow key={invitee.user_id}>
                    <TableCell className='font-medium'>
                      {invitee.username || `#${invitee.user_id}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          LEVEL_BADGE_VARIANT[invitee.level] ?? 'outline'
                        }
                      >
                        {t(
                          LEVEL_LABEL_KEYS[invitee.level] ??
                            `Level ${invitee.level}`
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground hidden sm:table-cell'>
                      {formatTimestampToDate(invitee.created_at)}
                    </TableCell>
                    <TableCell className='text-right font-semibold tabular-nums'>
                      {formatQuota(invitee.commission)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              className='size-8'
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              aria-label={t('Previous')}
            >
              <ChevronLeft className='size-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='size-8'
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              aria-label={t('Next')}
            >
              <ChevronRight className='size-4' />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
