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
  FileText,
  ReceiptText,
  Search,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import type { InvoiceStatus } from '@/features/invoices/types'
import {
  getUserBillingHistory,
  getUserInvoiceDownloadUrl,
  isApiSuccess,
} from '../api'
import {
  formatTimestamp,
  getPaymentMethodName,
  getStatusConfig,
} from '../lib/billing'
import type { TopupRecord } from '../types'
import { InvoiceRequestDialog } from './invoice-request-dialog'

type InvoiceStatusConfig = {
  label: string
  variant: StatusVariant
}

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, InvoiceStatusConfig> = {
  pending: { label: 'Invoice Pending', variant: 'warning' },
  processing: { label: 'Invoice Processing', variant: 'info' },
  issued: { label: 'Invoice Issued', variant: 'success' },
  rejected: { label: 'Invoice Rejected', variant: 'danger' },
}

export function WalletOrdersPage() {
  const { t } = useTranslation()
  const [records, setRecords] = useState<TopupRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [invoiceRecord, setInvoiceRecord] = useState<TopupRecord | null>(null)
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getUserBillingHistory(page, pageSize, keyword)
      if (isApiSuccess(response) && response.data) {
        setRecords(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        toast.error(response.message || t('Failed to load order history'))
        setRecords([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize, t])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  const handleDownloadInvoice = (record: TopupRecord) => {
    const invoice = record.invoice_request
    if (!invoice) return
    window.open(getUserInvoiceDownloadUrl(invoice.id), '_blank')
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Orders')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder={t('Search by order number...')}
                  className='pl-10'
                />
              </div>
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
                      <div className='mt-4 grid gap-3 sm:grid-cols-4'>
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                        <Skeleton className='h-12 w-full' />
                      </div>
                    </div>
                  ))}
                </div>
              ) : records.length === 0 ? (
                <div className='text-muted-foreground flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed text-center'>
                  <ReceiptText className='mb-3 size-8' />
                  <p className='text-sm font-medium'>
                    {t('No order records found')}
                  </p>
                  <p className='mt-1 text-xs'>
                    {keyword
                      ? t('Try adjusting your search')
                      : t('Your wallet orders will appear here')}
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {records.map((record) => (
                    <OrderCard
                      key={record.id}
                      record={record}
                      copiedText={copiedText}
                      onCopy={copyToClipboard}
                      onRequestInvoice={setInvoiceRecord}
                      onDownloadInvoice={handleDownloadInvoice}
                    />
                  ))}
                </div>
              )}
            </div>

            {!loading && records.length > 0 ? (
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

      <InvoiceRequestDialog
        open={!!invoiceRecord}
        record={invoiceRecord}
        onOpenChange={(open) => !open && setInvoiceRecord(null)}
        onSubmitted={fetchOrders}
      />
    </>
  )
}

interface OrderCardProps {
  record: TopupRecord
  copiedText: string | null
  onCopy: (text: string) => void
  onRequestInvoice: (record: TopupRecord) => void
  onDownloadInvoice: (record: TopupRecord) => void
}

function OrderCard({
  record,
  copiedText,
  onCopy,
  onRequestInvoice,
  onDownloadInvoice,
}: OrderCardProps) {
  const { t } = useTranslation()
  const statusConfig = getStatusConfig(record.status)
  const invoice = record.invoice_request
  const invoiceConfig = invoice ? INVOICE_STATUS_CONFIG[invoice.status] : null
  const canRequestInvoice = record.status === 'success' && !invoice
  const canDownloadInvoice =
    invoice?.status === 'issued' && invoice.delivery_method === 'upload'

  return (
    <div className='hover:bg-muted/40 rounded-lg border p-3 transition-colors sm:p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <code className='truncate font-mono text-sm'>{record.trade_no}</code>
            <Button
              variant='ghost'
              size='sm'
              className='size-5 p-0'
              onClick={() => onCopy(record.trade_no)}
            >
              {copiedText === record.trade_no ? (
                <Check className='size-3' />
              ) : (
                <Copy className='size-3' />
              )}
            </Button>
          </div>
          <div className='text-muted-foreground text-xs'>
            {formatTimestamp(record.create_time)}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <StatusBadge
            label={t(statusConfig.label)}
            variant={statusConfig.variant}
            showDot
            copyable={false}
          />
          {invoiceConfig ? (
            <StatusBadge
              label={t(invoiceConfig.label)}
              variant={invoiceConfig.variant}
              showDot
              copyable={false}
            />
          ) : null}
        </div>
      </div>

      <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <OrderField
          label={t('Payment Method')}
          value={getPaymentMethodName(record.payment_method, t)}
        />
        <OrderField
          label={t('Amount')}
          value={formatCurrencyFromUSD(record.amount, {
            digitsLarge: 2,
            digitsSmall: 2,
            abbreviate: false,
          })}
        />
        <OrderField label={t('Payment')} value={formatNumber(record.money)} />
        <OrderField
          label={t('Invoice')}
          value={
            invoice
              ? invoice.file_name || invoice.admin_note || t('Requested')
              : t('Not requested')
          }
        />
      </div>

      <div className='mt-4 flex flex-wrap justify-end gap-2'>
        {canRequestInvoice ? (
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() => onRequestInvoice(record)}
          >
            <FileText className='size-4' />
            {t('Request Invoice')}
          </Button>
        ) : null}
        {canDownloadInvoice ? (
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() => onDownloadInvoice(record)}
          >
            <Download className='size-4' />
            {t('Download Invoice')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function OrderField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1'>
      <Label className='text-muted-foreground text-xs'>{label}</Label>
      <div className='truncate text-sm font-medium'>{value}</div>
    </div>
  )
}

