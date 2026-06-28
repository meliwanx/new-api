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
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import {
  completeAffiliateWithdrawal,
  getAdminAffiliateWithdrawals,
  rejectAffiliateWithdrawal,
} from './api'
import type { AffiliateWithdrawal, AffiliateWithdrawalStatus } from './types'

type WithdrawalFilterStatus = AffiliateWithdrawalStatus | 'all'

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

export function AffiliateWithdrawals() {
  const { t } = useTranslation()
  const [items, setItems] = useState<AffiliateWithdrawal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState<WithdrawalFilterStatus>('all')
  const [loading, setLoading] = useState(false)
  const [completeTarget, setCompleteTarget] =
    useState<AffiliateWithdrawal | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AffiliateWithdrawal | null>(
    null
  )

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminAffiliateWithdrawals({
        page,
        pageSize,
        keyword,
        status,
        userId,
      })
      if (response.success && response.data) {
        setItems(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load withdrawal requests'))
        setItems([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize, status, t, userId])

  useEffect(() => {
    fetchWithdrawals()
  }, [fetchWithdrawals])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Affiliate Withdrawals')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4'>
            <div className='grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_128px] md:items-center'>
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('Search by ID, account or name...')}
                  className='pl-10'
                />
              </div>
              <Input
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value)
                  setPage(1)
                }}
                placeholder={t('User ID')}
              />
              <NativeSelect
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as WithdrawalFilterStatus)
                  setPage(1)
                }}
              >
                <option value='all'>{t('All statuses')}</option>
                <option value='processing'>{t('Processing')}</option>
                <option value='completed'>{t('Completed')}</option>
                <option value='rejected'>{t('Rejected')}</option>
              </NativeSelect>
              <NativeSelect
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                <option value={10}>{t('10 / page')}</option>
                <option value={20}>{t('20 / page')}</option>
                <option value={50}>{t('50 / page')}</option>
                <option value={100}>{t('100 / page')}</option>
              </NativeSelect>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
              {loading ? (
                <div className='space-y-3'>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className='rounded-lg border p-4'>
                      <Skeleton className='h-5 w-56' />
                      <div className='mt-4 grid gap-3 sm:grid-cols-5'>
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className='text-muted-foreground flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed text-center'>
                  <Wallet className='mb-3 size-8' />
                  <p className='text-sm font-medium'>
                    {t('No withdrawal requests found')}
                  </p>
                  <p className='mt-1 text-xs'>
                    {t('Affiliate withdrawal requests will appear here')}
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {items.map((withdrawal) => (
                    <WithdrawalCard
                      key={withdrawal.id}
                      withdrawal={withdrawal}
                      onComplete={setCompleteTarget}
                      onReject={setRejectTarget}
                    />
                  ))}
                </div>
              )}
            </div>

            {!loading && items.length > 0 ? (
              <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between'>
                <div className='text-muted-foreground text-xs sm:text-sm'>
                  {t('Showing')} {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, total)} {t('of')} {total}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronLeft className='size-4' />
                  </Button>
                  <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                    <span className='font-medium'>{page}</span>
                    <span>/</span>
                    <span>{totalPages}</span>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page >= totalPages}
                    className='h-8 w-8 p-0'
                  >
                    <ChevronRight className='size-4' />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <CompleteDialog
        withdrawal={completeTarget}
        onClose={() => setCompleteTarget(null)}
        onUpdated={fetchWithdrawals}
      />
      <RejectDialog
        withdrawal={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onUpdated={fetchWithdrawals}
      />
    </>
  )
}

interface WithdrawalCardProps {
  withdrawal: AffiliateWithdrawal
  onComplete: (withdrawal: AffiliateWithdrawal) => void
  onReject: (withdrawal: AffiliateWithdrawal) => void
}

function WithdrawalCard({
  withdrawal,
  onComplete,
  onReject,
}: WithdrawalCardProps) {
  const { t } = useTranslation()
  const statusConfig = WITHDRAWAL_STATUS_CONFIG[withdrawal.status]
  const canAct = withdrawal.status === 'processing'

  return (
    <div className='hover:bg-muted/40 rounded-lg border p-3 transition-colors sm:p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='font-mono text-sm'>#{withdrawal.id}</div>
          <div className='text-muted-foreground text-xs'>
            {t('User ID')}: {withdrawal.user_id}
          </div>
        </div>
        <StatusBadge
          label={t(statusConfig.label)}
          variant={statusConfig.variant}
          showDot
          copyable={false}
        />
      </div>

      <div className='mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5'>
        <WithdrawalField
          label={t('Amount')}
          value={formatQuota(withdrawal.amount)}
        />
        <WithdrawalField label={t('Withdrawal Method')} value={t('Alipay')} />
        <WithdrawalField
          label={t('Alipay Account')}
          value={withdrawal.account || '-'}
        />
        <WithdrawalField
          label={t('Account Name')}
          value={withdrawal.account_name || '-'}
        />
        <WithdrawalField
          label={t('Created At')}
          value={formatTimestampToDate(withdrawal.created_at)}
        />
        <WithdrawalField
          label={t('Processed At')}
          value={formatTimestampToDate(withdrawal.processed_at)}
        />
        <WithdrawalField
          label={t('Admin Note')}
          value={withdrawal.admin_note || '-'}
        />
        <WithdrawalField
          label={t('Reject Reason')}
          value={withdrawal.reject_reason || '-'}
        />
      </div>

      {canAct ? (
        <div className='mt-4 flex flex-wrap justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() => onComplete(withdrawal)}
          >
            <CheckCircle2 className='size-4' />
            {t('Mark Completed')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='text-destructive hover:text-destructive gap-2'
            onClick={() => onReject(withdrawal)}
          >
            <XCircle className='size-4' />
            {t('Reject')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function WithdrawalField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1'>
      <Label className='text-muted-foreground text-xs'>{label}</Label>
      <div className='truncate text-sm font-medium'>{value}</div>
    </div>
  )
}

function CompleteDialog({
  withdrawal,
  onClose,
  onUpdated,
}: {
  withdrawal: AffiliateWithdrawal | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (withdrawal) setAdminNote('')
  }, [withdrawal])

  const handleSubmit = async () => {
    if (!withdrawal) return
    setSubmitting(true)
    try {
      const response = await completeAffiliateWithdrawal(
        withdrawal.id,
        adminNote.trim()
      )
      if (response.success) {
        toast.success(t('Withdrawal marked as completed'))
        onClose()
        onUpdated()
      } else {
        toast.error(
          response.message || t('Failed to update withdrawal request')
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!withdrawal}
      onOpenChange={(open) => !open && onClose()}
      title={t('Complete Withdrawal')}
      footer={
        <>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Processing...') : t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs'>{t('Amount')}</div>
          <div className='mt-1 text-lg font-semibold'>
            {withdrawal ? formatQuota(withdrawal.amount) : '-'}
          </div>
        </div>
        <div className='grid gap-2'>
          <Label>{t('Admin Note')}</Label>
          <Textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder={t('Example: Alipay transfer completed')}
          />
        </div>
      </div>
    </Dialog>
  )
}

function RejectDialog({
  withdrawal,
  onClose,
  onUpdated,
}: {
  withdrawal: AffiliateWithdrawal | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (withdrawal) setReason('')
  }, [withdrawal])

  const handleSubmit = async () => {
    if (!withdrawal) return
    if (!reason.trim()) {
      toast.error(t('Reject reason is required'))
      return
    }
    setSubmitting(true)
    try {
      const response = await rejectAffiliateWithdrawal(
        withdrawal.id,
        reason.trim()
      )
      if (response.success) {
        toast.success(t('Withdrawal request rejected'))
        onClose()
        onUpdated()
      } else {
        toast.error(
          response.message || t('Failed to reject withdrawal request')
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!withdrawal}
      onOpenChange={(open) => !open && onClose()}
      title={t('Reject Withdrawal Request')}
      footer={
        <>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Processing...') : t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='grid gap-2'>
        <Label>{t('Reject Reason')}</Label>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('Tell the user why this withdrawal cannot be paid')}
        />
      </div>
    </Dialog>
  )
}
