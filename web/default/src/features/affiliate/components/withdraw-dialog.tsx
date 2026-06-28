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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  formatQuota,
  formatTimestampToDate,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/dialog'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import {
  createAffiliateWithdrawal,
  getUserAffiliateWithdrawals,
} from '@/features/affiliate-withdrawals/api'
import type {
  AffiliateWithdrawal,
  AffiliateWithdrawalStatus,
} from '@/features/affiliate-withdrawals/types'

interface WithdrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableQuota: number
  onSubmitted: () => Promise<void> | void
}

type WithdrawalStatusConfig = {
  label: string
  variant: StatusVariant
}

const WITHDRAWAL_STATUS_CONFIG: Record<
  AffiliateWithdrawalStatus,
  WithdrawalStatusConfig
> = {
  processing: { label: 'Processing', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

export function WithdrawDialog({
  open,
  onOpenChange,
  availableQuota,
  onSubmitted,
}: WithdrawDialogProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<AffiliateWithdrawal[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const maxDisplayAmount = useMemo(
    () => quotaUnitsToDollars(availableQuota),
    [availableQuota]
  )

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await getUserAffiliateWithdrawals({
        page: 1,
        pageSize: 5,
      })
      if (response.success && response.data) {
        setHistory(response.data.items || [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setAmount(
      maxDisplayAmount > 0 ? String(Number(maxDisplayAmount.toFixed(4))) : ''
    )
    setAccount('')
    setAccountName('')
    fetchHistory()
  }, [fetchHistory, maxDisplayAmount, open])

  const handleSubmit = async () => {
    const displayAmount = Number(amount)
    const quotaAmount = parseQuotaFromDollars(displayAmount)

    if (
      !Number.isFinite(displayAmount) ||
      displayAmount <= 0 ||
      quotaAmount <= 0
    ) {
      toast.error(t('Withdrawal amount is required'))
      return
    }
    if (quotaAmount > availableQuota) {
      toast.error(t('Withdrawal amount exceeds available rewards'))
      return
    }
    if (!account.trim()) {
      toast.error(t('Alipay account is required'))
      return
    }
    if (!accountName.trim()) {
      toast.error(t('Account name is required'))
      return
    }

    setSubmitting(true)
    try {
      const response = await createAffiliateWithdrawal({
        amount: quotaAmount,
        method: 'alipay',
        account: account.trim(),
        account_name: accountName.trim(),
      })
      if (response.success) {
        toast.success(t('Withdrawal request submitted'))
        await onSubmitted()
        await fetchHistory()
        onOpenChange(false)
      } else {
        toast.error(
          response.message || t('Failed to submit withdrawal request')
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Withdraw Rewards')}
      description={t('Withdraw affiliate commission rewards to Alipay.')}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-xl'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || availableQuota <= 0}
          >
            {submitting && <Loader2 className='mr-2 size-4 animate-spin' />}
            {t('Submit Withdrawal')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Available Rewards')}
          </div>
          <div className='mt-1 text-2xl font-semibold tabular-nums'>
            {formatQuota(availableQuota)}
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='grid gap-2 sm:col-span-2'>
            <Label htmlFor='withdraw-amount'>{t('Withdrawal Amount')}</Label>
            <Input
              id='withdraw-amount'
              type='number'
              min='0'
              max={maxDisplayAmount || undefined}
              step='0.01'
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t('Enter withdrawal amount')}
            />
          </div>

          <div className='grid gap-2 sm:col-span-2'>
            <Label>{t('Withdrawal Method')}</Label>
            <div className='bg-muted/30 flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium'>
              <CreditCard className='text-muted-foreground size-4' />
              {t('Alipay')}
            </div>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='alipay-account'>{t('Alipay Account')}</Label>
            <Input
              id='alipay-account'
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder={t('Email or phone number')}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='alipay-name'>{t('Account Name')}</Label>
            <Input
              id='alipay-name'
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder={t('Real name on the Alipay account')}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-semibold'>{t('Recent Withdrawals')}</div>
          <div className='space-y-2'>
            {historyLoading ? (
              <div className='text-muted-foreground rounded-lg border p-3 text-sm'>
                {t('Loading...')}
              </div>
            ) : history.length === 0 ? (
              <div className='text-muted-foreground rounded-lg border border-dashed p-3 text-sm'>
                {t('No withdrawal requests found')}
              </div>
            ) : (
              history.map((item) => {
                const statusConfig = WITHDRAWAL_STATUS_CONFIG[item.status]
                return (
                  <div
                    key={item.id}
                    className='flex items-center justify-between gap-3 rounded-lg border p-3'
                  >
                    <div className='min-w-0'>
                      <div className='font-medium tabular-nums'>
                        {formatQuota(item.amount)}
                      </div>
                      <div className='text-muted-foreground mt-0.5 truncate text-xs'>
                        {formatTimestampToDate(item.created_at)}
                      </div>
                    </div>
                    <StatusBadge
                      label={t(statusConfig.label)}
                      variant={statusConfig.variant}
                      showDot
                      copyable={false}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
