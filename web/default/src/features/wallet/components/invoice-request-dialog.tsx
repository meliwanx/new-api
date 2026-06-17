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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/dialog'
import type { InvoiceType } from '@/features/invoices/types'
import { createInvoiceRequest, isApiSuccess } from '../api'
import type { TopupRecord } from '../types'

interface InvoiceRequestDialogProps {
  open: boolean
  record: TopupRecord | null
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

export function InvoiceRequestDialog({
  open,
  record,
  onOpenChange,
  onSubmitted,
}: InvoiceRequestDialogProps) {
  const { t } = useTranslation()
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('business')
  const [title, setTitle] = useState('')
  const [taxNo, setTaxNo] = useState('')
  const [email, setEmail] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setInvoiceType('business')
      setTitle('')
      setTaxNo('')
      setEmail(record?.invoice_request?.email || '')
      setRemark('')
    }
  }, [open, record?.invoice_request?.email])

  const handleSubmit = async () => {
    if (!record) return
    if (!title.trim()) {
      toast.error(t('Invoice title is required'))
      return
    }
    if (!email.trim()) {
      toast.error(t('Invoice email is required'))
      return
    }
    if (invoiceType === 'business' && !taxNo.trim()) {
      toast.error(t('Tax number is required for business invoices'))
      return
    }

    setSubmitting(true)
    try {
      const response = await createInvoiceRequest({
        trade_no: record.trade_no,
        invoice_type: invoiceType,
        title: title.trim(),
        tax_no: taxNo.trim(),
        email: email.trim(),
        remark: remark.trim(),
      })
      if (isApiSuccess(response)) {
        toast.success(t('Invoice request submitted'))
        onOpenChange(false)
        onSubmitted()
      } else {
        toast.error(response.message || t('Failed to submit invoice request'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Request Invoice')}
      description={record ? `${t('Order')}: ${record.trade_no}` : undefined}
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Submitting...') : t('Submit')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-2'>
          <Label>{t('Invoice Type')}</Label>
          <NativeSelect
            className='w-full'
            value={invoiceType}
            onChange={(event) =>
              setInvoiceType(event.target.value as InvoiceType)
            }
          >
            <option value='business'>{t('Business')}</option>
            <option value='personal'>{t('Personal')}</option>
          </NativeSelect>
        </div>
        <div className='grid gap-2'>
          <Label>{t('Invoice Title')}</Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Company or personal name')}
          />
        </div>
        {invoiceType === 'business' ? (
          <div className='grid gap-2'>
            <Label>{t('Tax Number')}</Label>
            <Input
              value={taxNo}
              onChange={(event) => setTaxNo(event.target.value)}
              placeholder={t('Tax registration number')}
            />
          </div>
        ) : null}
        <div className='grid gap-2'>
          <Label>{t('Invoice Email')}</Label>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder='billing@example.com'
          />
        </div>
        <div className='grid gap-2'>
          <Label>{t('Remark')}</Label>
          <Textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder={t('Optional invoice notes')}
          />
        </div>
      </div>
    </Dialog>
  )
}

