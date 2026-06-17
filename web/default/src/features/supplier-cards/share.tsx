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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogIn, TicketCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { PublicLayout } from '@/components/layout'
import { getSupplierCardShare, redeemSupplierCardShare } from './api'
import { SupplierCardVisual } from './components/supplier-card-visual'
import { SUPPLIER_CARD_STATUS } from './types'

interface SupplierCardSharePageProps {
  token: string
}

export function SupplierCardSharePage({ token }: SupplierCardSharePageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { auth } = useAuthStore()

  const shareQuery = useQuery({
    queryKey: ['supplier-card-share', token],
    queryFn: () => getSupplierCardShare(token),
    retry: false,
  })

  const redeemMutation = useMutation({
    mutationFn: () => redeemSupplierCardShare(token),
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(
        t('Redeemed {{quota}} to your account.', {
          quota: formatQuota(response.data?.quota ?? 0),
        })
      )
      await queryClient.invalidateQueries({
        queryKey: ['supplier-card-share', token],
      })
    },
  })

  const handleRedeem = () => {
    if (!auth.user) {
      navigate({
        to: '/sign-in',
        search: {
          redirect:
            typeof window === 'undefined'
              ? `/supplier-card/${token}`
              : window.location.pathname,
        },
      })
      return
    }
    redeemMutation.mutate()
  }

  const card = shareQuery.data?.data
  const canRedeem = card?.status === SUPPLIER_CARD_STATUS.UNUSED

  return (
    <PublicLayout>
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 py-10 sm:py-16'>
        {shareQuery.isLoading ? (
          <>
            <Skeleton className='h-72 rounded-lg' />
            <Skeleton className='h-36 rounded-lg' />
          </>
        ) : !shareQuery.data?.success || !card ? (
          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle>{t('Recharge card unavailable')}</CardTitle>
              <CardDescription>
                {shareQuery.data?.message ||
                  t(
                    'This recharge card link is invalid or no longer available.'
                  )}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <SupplierCardVisual
              amount={card.amount}
              quota={card.quota}
              codePreview={card.code_preview}
              status={card.status}
              supplierName={card.supplier_display_name}
              redeemedTime={card.redeemed_time}
            />

            <Card className='rounded-lg py-0'>
              <CardHeader className='border-b py-4'>
                <CardTitle>{t('Redeem Supplier Card')}</CardTitle>
                <CardDescription>
                  {t(
                    'Anyone can preview this card, but redemption requires a signed-in account.'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3 p-4 text-sm sm:grid-cols-3'>
                <div>
                  <div className='text-muted-foreground'>{t('Supplier')}</div>
                  <div className='mt-1 font-medium'>
                    {card.supplier_display_name || '-'}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Code Preview')}
                  </div>
                  <div className='mt-1 font-mono font-medium'>
                    {card.code_preview}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Token Preview')}
                  </div>
                  <div className='mt-1 font-mono font-medium'>
                    {card.share_token_preview}
                  </div>
                </div>
              </CardContent>
              <CardFooter className='rounded-b-lg'>
                <Button
                  disabled={!canRedeem || redeemMutation.isPending}
                  onClick={handleRedeem}
                >
                  {redeemMutation.isPending ? (
                    <Spinner data-icon='inline-start' />
                  ) : auth.user ? (
                    <TicketCheck data-icon='inline-start' />
                  ) : (
                    <LogIn data-icon='inline-start' />
                  )}
                  {auth.user
                    ? t('Redeem to My Account')
                    : t('Sign in to Redeem')}
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </PublicLayout>
  )
}
