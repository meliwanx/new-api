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
import { getChannelImportOptions, importChannels } from '../../api'
import { channelsQueryKeys, getChannelTypeLabel } from '../../lib'
import type {
  ChannelExportGroups,
  ChannelExportItem,
  ChannelExportModelPricing,
  ChannelExportPayload,
  ChannelImportConflictChoice,
  ChannelImportConflictResolution,
  ChannelImportOption,
  ChannelImportOptionKey,
} from '../../types'

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
  const [exportedAt, setExportedAt] = useState<number | undefined>()
  const [groups, setGroups] = useState<ChannelExportGroups | undefined>()
  const [modelPricing, setModelPricing] =
    useState<ChannelExportModelPricing | undefined>()
  const [currentOptions, setCurrentOptions] = useState<ChannelImportOption[]>([])
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, ChannelImportConflictChoice>
  >({})
  const [channels, setChannels] = useState<ChannelExportItem[]>([])
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    () => new Set()
  )
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const selectedCount = selectedIndexes.size
  const allSelected = channels.length > 0 && selectedCount === channels.length
  const someSelected = selectedCount > 0 && !allSelected

  const selectedChannels = useMemo(
    () => channels.filter((_, index) => selectedIndexes.has(index)),
    [channels, selectedIndexes]
  )
  const currentSettings = useMemo(
    () => buildCurrentImportSettings(currentOptions),
    [currentOptions]
  )
  const conflictRows = useMemo(
    () =>
      buildImportConflictRows({
        channels: selectedChannels,
        groups,
        modelPricing,
        currentSettings,
      }),
    [selectedChannels, groups, modelPricing, currentSettings]
  )

  const reset = () => {
    setFileName('')
    setVersion(undefined)
    setExportedAt(undefined)
    setGroups(undefined)
    setModelPricing(undefined)
    setCurrentOptions([])
    setConflictChoices({})
    setChannels([])
    setSelectedIndexes(new Set())
    setIsLoadingOptions(false)
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

  const handleConflictChoiceChange = (
    id: string,
    choice: ChannelImportConflictChoice
  ) => {
    setConflictChoices((current) => ({ ...current, [id]: choice }))
  }

  const handleSetAllConflicts = (choice: ChannelImportConflictChoice) => {
    setConflictChoices((current) => {
      const next = { ...current }
      for (const row of conflictRows) {
        next[row.id] = choice
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
      setExportedAt(payload.exported_at)
      setGroups(payload.groups)
      setModelPricing(payload.model_pricing)
      setChannels(payload.channels)
      setConflictChoices({})
      setSelectedIndexes(new Set(payload.channels.map((_, index) => index)))

      if (payload.groups || payload.model_pricing) {
        setIsLoadingOptions(true)
        try {
          const response = await getChannelImportOptions()
          if (!response.success || !response.data) {
            throw new Error('Failed to load current system configuration')
          }
          setCurrentOptions(response.data)
        } finally {
          setIsLoadingOptions(false)
        }
      } else {
        setCurrentOptions([])
      }

      toast.success(
        t('Loaded {{count}} channels from file', {
          count: payload.channels.length,
        })
      )
    } catch (error) {
      reset()
      toast.error(
        t(
          error instanceof Error &&
            error.message === 'Failed to load current system configuration'
            ? 'Failed to load current system configuration'
            : 'Invalid channel export JSON'
        )
      )
    }
  }

  const handleImport = async () => {
    if (selectedChannels.length === 0) {
      toast.warning(t('Select at least one channel to import'))
      return
    }

    setIsImporting(true)
    try {
      const conflictResolution = buildConflictResolution(
        conflictRows,
        conflictChoices
      )
      const response = await importChannels({
        version,
        exported_at: exportedAt,
        channels: selectedChannels,
        groups,
        model_pricing: modelPricing,
        conflict_resolution: conflictResolution,
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
            disabled={
              selectedChannels.length === 0 || isImporting || isLoadingOptions
            }
          >
            {isImporting || isLoadingOptions ? (
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
            'Imported channels will be created as new channels. Existing configuration conflicts keep the current system value unless you choose the JSON value.'
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

          {isLoadingOptions ? (
            <div className='text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {t('Loading current system configuration')}
            </div>
          ) : conflictRows.length > 0 ? (
            <div className='rounded-md border'>
              <div className='flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
                <div className='flex flex-col gap-1'>
                  <p className='font-medium'>{t('Configuration conflicts')}</p>
                  <p className='text-muted-foreground text-sm'>
                    {t('{{count}} conflicting settings found', {
                      count: conflictRows.length,
                    })}
                  </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleSetAllConflicts('system')}
                  >
                    {t('Keep system for all')}
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleSetAllConflicts('json')}
                  >
                    {t('Use JSON for all')}
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Setting')}</TableHead>
                    <TableHead>{t('Key')}</TableHead>
                    <TableHead>{t('Current system')}</TableHead>
                    <TableHead>{t('JSON file')}</TableHead>
                    <TableHead>{t('Decision')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflictRows.map((row) => {
                    const choice = conflictChoices[row.id] ?? 'system'
                    return (
                      <TableRow key={row.id}>
                        <TableCell className='whitespace-nowrap'>
                          {t(row.label)}
                        </TableCell>
                        <TableCell className='font-mono'>{row.itemKey}</TableCell>
                        <TableCell className='max-w-44 truncate font-mono'>
                          {formatConflictValue(row.systemValue)}
                        </TableCell>
                        <TableCell className='max-w-44 truncate font-mono'>
                          {formatConflictValue(row.jsonValue)}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              type='button'
                              size='sm'
                              variant={
                                choice === 'system' ? 'default' : 'outline'
                              }
                              onClick={() =>
                                handleConflictChoiceChange(row.id, 'system')
                              }
                            >
                              {t('Keep System')}
                            </Button>
                            <Button
                              type='button'
                              size='sm'
                              variant={choice === 'json' ? 'default' : 'outline'}
                              onClick={() =>
                                handleConflictChoiceChange(row.id, 'json')
                              }
                            >
                              {t('Use JSON')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}

type ImportSettingValue = number | string

type ImportSettingsMap = Partial<
  Record<ChannelImportOptionKey, Record<string, ImportSettingValue>>
>

type ImportConflictRow = {
  id: string
  optionKey: ChannelImportOptionKey
  label: string
  itemKey: string
  systemValue: ImportSettingValue
  jsonValue: ImportSettingValue
}

type ImportConfigSpec = {
  optionKey: ChannelImportOptionKey
  label: string
  valueType: 'number' | 'string'
  getIncoming: (payload: {
    groups?: ChannelExportGroups
    modelPricing?: ChannelExportModelPricing
  }) => Record<string, ImportSettingValue> | undefined
  scope: 'group' | 'model'
}

const IMPORT_CONFIG_SPECS: ImportConfigSpec[] = [
  {
    optionKey: 'GroupRatio',
    label: 'Group ratio',
    valueType: 'number',
    getIncoming: ({ groups }) => groups?.group_ratio,
    scope: 'group',
  },
  {
    optionKey: 'UserUsableGroups',
    label: 'Selectable groups',
    valueType: 'string',
    getIncoming: ({ groups }) => groups?.user_usable_groups,
    scope: 'group',
  },
  {
    optionKey: 'ModelPrice',
    label: 'Model fixed price',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.model_price,
    scope: 'model',
  },
  {
    optionKey: 'ModelRatio',
    label: 'Model ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.model_ratio,
    scope: 'model',
  },
  {
    optionKey: 'CompletionRatio',
    label: 'Completion ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.completion_ratio,
    scope: 'model',
  },
  {
    optionKey: 'CacheRatio',
    label: 'Cache ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.cache_ratio,
    scope: 'model',
  },
  {
    optionKey: 'CreateCacheRatio',
    label: 'Cache write ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.create_cache_ratio,
    scope: 'model',
  },
  {
    optionKey: 'ImageRatio',
    label: 'Image ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.image_ratio,
    scope: 'model',
  },
  {
    optionKey: 'AudioCompletionRatio',
    label: 'Audio completion ratio',
    valueType: 'number',
    getIncoming: ({ modelPricing }) => modelPricing?.audio_completion_ratio,
    scope: 'model',
  },
]

function buildCurrentImportSettings(
  options: ChannelImportOption[]
): ImportSettingsMap {
  const optionMap = new Map(options.map((option) => [option.key, option.value]))
  const settings: ImportSettingsMap = {}

  for (const spec of IMPORT_CONFIG_SPECS) {
    const rawValue = optionMap.get(spec.optionKey)
    const parsed =
      spec.valueType === 'number'
        ? parseNumberMap(rawValue)
        : parseStringMap(rawValue)
    if (parsed) {
      settings[spec.optionKey] = parsed
    }
  }

  return settings
}

function buildImportConflictRows({
  channels,
  groups,
  modelPricing,
  currentSettings,
}: {
  channels: ChannelExportItem[]
  groups?: ChannelExportGroups
  modelPricing?: ChannelExportModelPricing
  currentSettings: ImportSettingsMap
}): ImportConflictRow[] {
  if (!groups && !modelPricing) return []

  const groupKeys = collectGroupKeys(channels)
  const modelKeys = collectModelKeys(channels)
  const rows: ImportConflictRow[] = []

  for (const spec of IMPORT_CONFIG_SPECS) {
    const incoming = spec.getIncoming({ groups, modelPricing })
    const current = currentSettings[spec.optionKey]
    if (!incoming || !current) continue

    const allowedKeys = spec.scope === 'group' ? groupKeys : modelKeys
    for (const [rawKey, jsonValue] of Object.entries(incoming)) {
      const itemKey = rawKey.trim()
      if (!itemKey || !allowedKeys.has(itemKey)) continue

      const systemValue = current[itemKey]
      if (systemValue === undefined || valuesEqual(systemValue, jsonValue)) {
        continue
      }
      rows.push({
        id: `${spec.optionKey}:${itemKey}`,
        optionKey: spec.optionKey,
        label: spec.label,
        itemKey,
        systemValue,
        jsonValue,
      })
    }
  }

  return rows
}

function buildConflictResolution(
  rows: ImportConflictRow[],
  choices: Record<string, ChannelImportConflictChoice>
): ChannelImportConflictResolution | undefined {
  if (rows.length === 0) return undefined

  const resolution: ChannelImportConflictResolution = {}
  for (const row of rows) {
    const choice = choices[row.id] ?? 'system'
    if (!resolution[row.optionKey]) {
      resolution[row.optionKey] = {}
    }
    resolution[row.optionKey]![row.itemKey] = choice
  }
  return resolution
}

function parseNumberMap(value: string | undefined): Record<string, number> | undefined {
  const parsed = parseJsonRecord(value)
  if (!parsed) return undefined

  const result: Record<string, number> = {}
  for (const [key, rawValue] of Object.entries(parsed)) {
    const numberValue = Number(rawValue)
    if (Number.isFinite(numberValue)) {
      result[key] = numberValue
    }
  }
  return result
}

function parseStringMap(value: string | undefined): Record<string, string> | undefined {
  const parsed = parseJsonRecord(value)
  if (!parsed) return undefined

  const result: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(parsed)) {
    if (typeof rawValue === 'string') {
      result[key] = rawValue
    }
  }
  return result
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function collectGroupKeys(channels: ChannelExportItem[]): Set<string> {
  const keys = new Set<string>()
  for (const channel of channels) {
    for (const group of splitCommaFields(channel.group)) {
      keys.add(group)
    }
  }
  return keys
}

function collectModelKeys(channels: ChannelExportItem[]): Set<string> {
  const keys = new Set<string>()
  for (const channel of channels) {
    for (const model of splitCommaFields(channel.models)) {
      keys.add(model)
      keys.add(formatMatchingModelName(model))
    }
    if (channel.test_model) {
      const testModel = channel.test_model.trim()
      if (testModel) {
        keys.add(testModel)
        keys.add(formatMatchingModelName(testModel))
      }
    }
  }
  return keys
}

function formatMatchingModelName(name: string): string {
  if (
    name.startsWith('gemini-2.5-flash-lite') &&
    name.includes('-thinking-')
  ) {
    return 'gemini-2.5-flash-lite-thinking-*'
  }
  if (name.startsWith('gemini-2.5-flash') && name.includes('-thinking-')) {
    return 'gemini-2.5-flash-thinking-*'
  }
  if (name.startsWith('gemini-2.5-pro') && name.includes('-thinking-')) {
    return 'gemini-2.5-pro-thinking-*'
  }
  if (name.startsWith('gpt-4-gizmo')) {
    return 'gpt-4-gizmo-*'
  }
  if (name.startsWith('gpt-4o-gizmo')) {
    return 'gpt-4o-gizmo-*'
  }
  return name
}

function splitCommaFields(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function valuesEqual(a: ImportSettingValue, b: ImportSettingValue): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b)
  }
  return a === b
}

function formatConflictValue(value: ImportSettingValue): string {
  return typeof value === 'number' ? String(value) : value
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
    exported_at:
      isRecord(parsed) && typeof parsed.exported_at === 'number'
        ? parsed.exported_at
        : undefined,
    groups:
      isRecord(parsed) && isRecord(parsed.groups)
        ? (parsed.groups as ChannelExportGroups)
        : undefined,
    model_pricing:
      isRecord(parsed) && isRecord(parsed.model_pricing)
        ? (parsed.model_pricing as ChannelExportModelPricing)
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
