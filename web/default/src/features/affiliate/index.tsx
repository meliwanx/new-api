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
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSelf } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'
import { AffiliateRewardsCard } from '@/features/wallet/components/affiliate-rewards-card'
import { MultiLevelAffiliateCard } from '@/features/wallet/components/multi-level-affiliate-card'
import { useAffiliate } from '@/features/wallet/hooks'
import type { UserWalletData } from '@/features/wallet/types'
import { InviteesCard } from './components/invitees-card'
import { WithdrawDialog } from './components/withdraw-dialog'
import { useInvitees } from './hooks/use-invitees'

export function Affiliate() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)

  const { affiliateLink, summary, loading: affiliateLoading } = useAffiliate()
  const {
    items,
    total,
    page,
    totalPages,
    loading: inviteesLoading,
    setPage,
  } = useInvitees()

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Affiliate')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            size='sm'
            className='gap-2'
            onClick={() => setWithdrawDialogOpen(true)}
            disabled={userLoading}
          >
            <Wallet className='size-4' />
            {t('Withdraw')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              loading={affiliateLoading || userLoading}
            />

            <MultiLevelAffiliateCard
              summary={summary}
              loading={affiliateLoading}
            />

            <InviteesCard
              items={items}
              total={total}
              page={page}
              totalPages={totalPages}
              loading={inviteesLoading}
              onPageChange={setPage}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        availableQuota={user?.aff_quota ?? 0}
        onSubmitted={fetchUser}
      />
    </>
  )
}
