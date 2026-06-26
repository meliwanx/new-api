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
import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, FileJson, Loader2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog } from '@/components/dialog'
import { importChannels } from '../../api'
import { channelsQueryKeys, getChannelTypeLabel } from '../../lib'
import type { ChannelExportItem, ChannelExportPayload } from '../../types'

type ChannelImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelImportDialog({
  open,
  onOpenChange,
}: ChannelImportDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [version, setVersion] = useState<number | undefined>()
  const [channels, setChannels] = useState<ChannelExportItem[]>([])
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    () => new Set()
  )
  const [isImporting, setIsImporting] = useState(false)

  const selectedCount = selectedIndexes.size
  const allSelected = channels.length > 0 && selectedCount === channels.length
  const someSelected = selectedCount > 0 && !allSelected

  const selectedChannels = useMemo(
    () => channels.filter((_, index) => selectedIndexes.has(index)),
    [channels, selectedIndexes]
  )

  const reset = () => {
    setFileName('')
    setVersion(undefined)
    setChannels([])
    setSelectedIndexes(new Set())
    setIsImporting(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIndexes(
      checked ? new Set(channels.map((_, index) => index)) : new Set()
    )
  }

  const handleToggleRow = (index: number, checked: boolean) => {
    setSelectedIndexes((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }
      return next
    })
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const payload = parseChannelExportPayload(text)
      setFileName(file.name)
      setVersion(payload.version)
      setChannels(payload.channels)
      setSelectedIndexes(new Set(payload.channels.map((_, index) => index)))
      toast.success(
        t('Loaded {{count}} channels from file', {
          count: payload.channels.length,
        })
      )
    } catch {
      reset()
      toast.error(t('Invalid channel export JSON'))
    }
  }

  const handleImport = async () => {
    if (selectedChannels.length === 0) {
      toast.warning(t('Select at least one channel to import'))
      return
    }

    setIsImporting(true)
    try {
      const response = await importChannels({
        version,
        channels: selectedChannels,
      })
      if (response.success) {
        toast.success(
          t('Imported {{count}} channels', {
            count: response.data?.imported ?? selectedChannels.length,
          })
        )
        await queryClient.invalidateQueries({
          queryKey: channelsQueryKeys.all,
        })
        handleClose()
      } else {
        toast.error(response.message || t('Failed to import channels'))
      }
    } catch (_error) {
      toast.error(t('Failed to import channels'))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) handleClose()
      }}
      title={t('Import Channels')}
      description={t(
        'Review exported channels before importing. API keys are included in this file.'
      )}
      contentClassName='sm:max-w-5xl'
      contentHeight='min(62vh, 640px)'
      bodyClassName='flex flex-col gap-4'
      footer={
        <>
          <Button variant='outline' onClick={handleClose} disabled={isImporting}>
            {t('Cancel')}
          </Button>
          <Button
            variant='outline'
            onClick={handleChooseFile}
            disabled={isImporting}
          >
            <FileJson className='mr-2 h-4 w-4' />
            {channels.length > 0 ? t('Choose Another File') : t('Choose JSON File')}
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedChannels.length === 0 || isImporting}
          >
            {isImporting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Upload className='mr-2 h-4 w-4' />
            )}
            {t('Import Selected')} ({selectedChannels.length})
          </Button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        className='hidden'
        type='file'
        accept='application/json,.json'
        onChange={handleFileChange}
      />

      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          {t(
            'Imported channels will be created as new channels. Existing channels will not be overwritten.'
          )}
        </AlertDescription>
      </Alert>

      {channels.length === 0 ? (
        <div className='flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center'>
          <FileJson className='text-muted-foreground h-8 w-8' />
          <div className='flex flex-col gap-1'>
            <p className='font-medium'>{t('No channel export file loaded')}</p>
            <p className='text-muted-foreground text-sm'>
              {t('Choose a JSON file exported from the channel page.')}
            </p>
          </div>
          <Button variant='outline' onClick={handleChooseFile}>
            {t('Choose JSON File')}
          </Button>
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm'>
            <span>
              {t('File')}: <span className='font-medium'>{fileName}</span>
            </span>
            <span>
              {t('Selected {{selected}} of {{total}} channels', {
                selected: selectedCount,
                total: channels.length,
              })}
            </span>
          </div>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10'>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={(value) => handleSelectAll(!!value)}
                      aria-label={t('Select all')}
                    />
                  </TableHead>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('Type')}</TableHead>
                  <TableHead>{t('Group')}</TableHead>
                  <TableHead>{t('Models')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Key Preview')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel, index) => (
                  <TableRow key={`${channel.name}-${index}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIndexes.has(index)}
                        onCheckedChange={(value) =>
                          handleToggleRow(index, !!value)
                        }
                        aria-label={t('Select channel')}
                      />
                    </TableCell>
                    <TableCell className='max-w-52 truncate font-medium'>
                      {channel.name || '-'}
                    </TableCell>
                    <TableCell>{getChannelTypeLabel(channel.type)}</TableCell>
                    <TableCell className='max-w-36 truncate'>
                      {channel.group || 'default'}
                    </TableCell>
                    <TableCell className='max-w-72 truncate'>
                      {channel.models || '-'}
                    </TableCell>
                    <TableCell>{getStatusLabel(channel.status, t)}</TableCell>
                    <TableCell className='font-mono'>
                      {previewKey(channel.key)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function parseChannelExportPayload(text: string): ChannelExportPayload {
  const parsed = JSON.parse(text) as unknown
  const rawChannels = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed)
      ? parsed.channels
      : undefined

  if (!Array.isArray(rawChannels)) {
    throw new Error('channels must be an array')
  }

  const channels = rawChannels.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`channel ${index + 1} must be an object`)
    }

    const type = Number(raw.type)
    const status = Number(raw.status ?? 1)
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const key = typeof raw.key === 'string' ? raw.key.trim() : ''
    if (!Number.isFinite(type) || type <= 0 || !name || !key) {
      throw new Error(`channel ${index + 1} is missing required fields`)
    }

    return {
      ...(raw as Partial<ChannelExportItem>),
      type,
      key,
      status: Number.isFinite(status) ? status : 1,
      name,
      models: typeof raw.models === 'string' ? raw.models : '',
      group:
        typeof raw.group === 'string' && raw.group.trim()
          ? raw.group.trim()
          : 'default',
    } as ChannelExportItem
  })

  return {
    version:
      isRecord(parsed) && typeof parsed.version === 'number'
        ? parsed.version
        : undefined,
    channels,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function previewKey(key: string): string {
  if (key.length <= 16) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

function getStatusLabel(
  status: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (status === 1) return t('Enabled')
  if (status === 2) return t('Disabled')
  if (status === 3) return t('Auto Disabled')
  return t('Unknown')
}
