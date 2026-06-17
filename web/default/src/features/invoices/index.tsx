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
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileUp,
  MailCheck,
  Search,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  getAdminInvoiceDownloadUrl,
  getAdminInvoices,
  issueInvoice,
  markInvoiceProcessing,
  rejectInvoice,
  uploadInvoiceFile,
} from './api'
import type {
  InvoiceDeliveryMethod,
  InvoiceRequest,
  InvoiceStatus,
} from './types'

type InvoiceFilterStatus = InvoiceStatus | 'all'

type InvoiceStatusConfig = {
  label: string
  variant: StatusVariant
}

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, InvoiceStatusConfig> = {
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'info' },
  issued: { label: 'Issued', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

export function Invoices() {
  const { t } = useTranslation()
  const [items, setItems] = useState<InvoiceRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<InvoiceFilterStatus>('all')
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [issueTarget, setIssueTarget] = useState<InvoiceRequest | null>(null)
  const [uploadTarget, setUploadTarget] = useState<InvoiceRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<InvoiceRequest | null>(null)
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getAdminInvoices({
        page,
        pageSize,
        keyword,
        status,
      })
      if (response.success && response.data) {
        setItems(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load invoice requests'))
        setItems([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize, status, t])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleProcessing = async (invoice: InvoiceRequest) => {
    setActingId(invoice.id)
    try {
      const response = await markInvoiceProcessing(invoice.id)
      if (response.success) {
        toast.success(t('Invoice marked as processing'))
        fetchInvoices()
      } else {
        toast.error(response.message || t('Failed to update invoice request'))
      }
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Invoices')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('Search by order, title or email...')}
                  className='pl-10'
                />
              </div>
              <NativeSelect
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as InvoiceFilterStatus)
                  setPage(1)
                }}
                className='w-full sm:w-40'
              >
                <option value='all'>{t('All statuses')}</option>
                <option value='pending'>{t('Pending')}</option>
                <option value='processing'>{t('Processing')}</option>
                <option value='issued'>{t('Issued')}</option>
                <option value='rejected'>{t('Rejected')}</option>
              </NativeSelect>
              <NativeSelect
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
                className='w-full sm:w-32'
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
                      <Skeleton className='h-5 w-64' />
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
                  <MailCheck className='mb-3 size-8' />
                  <p className='text-sm font-medium'>
                    {t('No invoice requests found')}
                  </p>
                  <p className='mt-1 text-xs'>
                    {t('Customer invoice requests will appear here')}
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {items.map((invoice) => (
                    <InvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      copiedText={copiedText}
                      acting={actingId === invoice.id}
                      onCopy={copyToClipboard}
                      onProcessing={handleProcessing}
                      onIssue={setIssueTarget}
                      onUpload={setUploadTarget}
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

      <IssueDialog
        invoice={issueTarget}
        onClose={() => setIssueTarget(null)}
        onUpdated={fetchInvoices}
      />
      <UploadDialog
        invoice={uploadTarget}
        onClose={() => setUploadTarget(null)}
        onUpdated={fetchInvoices}
      />
      <RejectDialog
        invoice={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onUpdated={fetchInvoices}
      />
    </>
  )
}

interface InvoiceCardProps {
  invoice: InvoiceRequest
  copiedText: string | null
  acting: boolean
  onCopy: (text: string) => void
  onProcessing: (invoice: InvoiceRequest) => void
  onIssue: (invoice: InvoiceRequest) => void
  onUpload: (invoice: InvoiceRequest) => void
  onReject: (invoice: InvoiceRequest) => void
}

function InvoiceCard({
  invoice,
  copiedText,
  acting,
  onCopy,
  onProcessing,
  onIssue,
  onUpload,
  onReject,
}: InvoiceCardProps) {
  const { t } = useTranslation()
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status]
  const canAct = invoice.status === 'pending' || invoice.status === 'processing'
  const canDownload =
    invoice.status === 'issued' && invoice.delivery_method === 'upload'

  return (
    <div className='hover:bg-muted/40 rounded-lg border p-3 transition-colors sm:p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <code className='truncate font-mono text-sm'>{invoice.trade_no}</code>
            <Button
              variant='ghost'
              size='sm'
              className='size-5 p-0'
              onClick={() => onCopy(invoice.trade_no)}
            >
              {copiedText === invoice.trade_no ? (
                <Check className='size-3' />
              ) : (
                <Copy className='size-3' />
              )}
            </Button>
          </div>
          <div className='text-muted-foreground text-xs'>
            {t('User ID')}: {invoice.user_id}
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
        <InvoiceField
          label={t('Invoice Title')}
          value={invoice.title || '-'}
        />
        <InvoiceField
          label={t('Invoice Type')}
          value={t(invoice.invoice_type === 'business' ? 'Business' : 'Personal')}
        />
        <InvoiceField
          label={t('Tax Number')}
          value={invoice.tax_no || '-'}
        />
        <InvoiceField label={t('Invoice Email')} value={invoice.email || '-'} />
        <InvoiceField
          label={t('Payment')}
          value={formatNumber(invoice.money)}
        />
        <InvoiceField
          label={t('Amount')}
          value={formatCurrencyFromUSD(invoice.amount, {
            digitsLarge: 2,
            digitsSmall: 2,
            abbreviate: false,
          })}
        />
        <InvoiceField label={t('Provider')} value={invoice.provider || '-'} />
        <InvoiceField
          label={t('Delivery Method')}
          value={invoice.delivery_method ? t(invoice.delivery_method) : '-'}
        />
        <InvoiceField
          label={t('File')}
          value={invoice.file_name || invoice.admin_note || '-'}
        />
        <InvoiceField
          label={t('Remark')}
          value={invoice.remark || invoice.reject_reason || '-'}
        />
      </div>

      <div className='mt-4 flex flex-wrap justify-end gap-2'>
        {invoice.status === 'pending' ? (
          <Button
            size='sm'
            variant='outline'
            onClick={() => onProcessing(invoice)}
            disabled={acting}
          >
            {t('Mark Processing')}
          </Button>
        ) : null}
        {canAct ? (
          <>
            <Button
              size='sm'
              variant='outline'
              className='gap-2'
              onClick={() => onUpload(invoice)}
            >
              <FileUp className='size-4' />
              {t('Upload Invoice')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='gap-2'
              onClick={() => onIssue(invoice)}
            >
              <MailCheck className='size-4' />
              {t('Mark Issued')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='text-destructive hover:text-destructive gap-2'
              onClick={() => onReject(invoice)}
            >
              <XCircle className='size-4' />
              {t('Reject')}
            </Button>
          </>
        ) : null}
        {canDownload ? (
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() =>
              window.open(getAdminInvoiceDownloadUrl(invoice.id), '_blank')
            }
          >
            <Download className='size-4' />
            {t('Download')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function InvoiceField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1'>
      <Label className='text-muted-foreground text-xs'>{label}</Label>
      <div className='truncate text-sm font-medium'>{value}</div>
    </div>
  )
}

function IssueDialog({
  invoice,
  onClose,
  onUpdated,
}: {
  invoice: InvoiceRequest | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [deliveryMethod, setDeliveryMethod] =
    useState<Exclude<InvoiceDeliveryMethod, 'upload'>>('email')
  const [adminNote, setAdminNote] = useState('')
  const [externalId, setExternalId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (invoice) {
      setDeliveryMethod('email')
      setAdminNote('')
      setExternalId('')
    }
  }, [invoice])

  const handleSubmit = async () => {
    if (!invoice) return
    setSubmitting(true)
    try {
      const response = await issueInvoice(invoice.id, {
        delivery_method: deliveryMethod,
        admin_note: adminNote.trim(),
        provider: 'manual',
        external_id: externalId.trim(),
      })
      if (response.success) {
        toast.success(t('Invoice marked as issued'))
        onClose()
        onUpdated()
      } else {
        toast.error(response.message || t('Failed to issue invoice'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(open) => !open && onClose()}
      title={t('Mark Invoice Issued')}
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
        <div className='grid gap-2'>
          <Label>{t('Delivery Method')}</Label>
          <NativeSelect
            className='w-full'
            value={deliveryMethod}
            onChange={(event) =>
              setDeliveryMethod(
                event.target.value as Exclude<InvoiceDeliveryMethod, 'upload'>
              )
            }
          >
            <option value='email'>{t('Email sent')}</option>
            <option value='external'>{t('External invoice system')}</option>
          </NativeSelect>
        </div>
        <div className='grid gap-2'>
          <Label>{t('External ID')}</Label>
          <Input
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
            placeholder={t('Optional provider reference')}
          />
        </div>
        <div className='grid gap-2'>
          <Label>{t('Admin Note')}</Label>
          <Textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder={t('Example: invoice sent to customer email')}
          />
        </div>
      </div>
    </Dialog>
  )
}

function UploadDialog({
  invoice,
  onClose,
  onUpdated,
}: {
  invoice: InvoiceRequest | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (invoice) {
      setFile(null)
      setAdminNote('')
    }
  }, [invoice])

  const handleSubmit = async () => {
    if (!invoice) return
    if (!file) {
      toast.error(t('Please upload an invoice file'))
      return
    }
    setSubmitting(true)
    try {
      const response = await uploadInvoiceFile(invoice.id, file, adminNote)
      if (response.success) {
        toast.success(t('Invoice uploaded'))
        onClose()
        onUpdated()
      } else {
        toast.error(response.message || t('Failed to upload invoice'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(open) => !open && onClose()}
      title={t('Upload Invoice')}
      footer={
        <>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Uploading...') : t('Upload')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-2'>
          <Label>{t('Invoice File')}</Label>
          <Input
            type='file'
            accept='application/pdf,image/png,image/jpeg'
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </div>
        <div className='grid gap-2'>
          <Label>{t('Admin Note')}</Label>
          <Textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder={t('Optional handling note')}
          />
        </div>
      </div>
    </Dialog>
  )
}

function RejectDialog({
  invoice,
  onClose,
  onUpdated,
}: {
  invoice: InvoiceRequest | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (invoice) setReason('')
  }, [invoice])

  const handleSubmit = async () => {
    if (!invoice) return
    if (!reason.trim()) {
      toast.error(t('Reject reason is required'))
      return
    }
    setSubmitting(true)
    try {
      const response = await rejectInvoice(invoice.id, reason.trim())
      if (response.success) {
        toast.success(t('Invoice request rejected'))
        onClose()
        onUpdated()
      } else {
        toast.error(response.message || t('Failed to reject invoice request'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(open) => !open && onClose()}
      title={t('Reject Invoice Request')}
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
          placeholder={t('Tell the customer why this invoice cannot be issued')}
        />
      </div>
    </Dialog>
  )
}

