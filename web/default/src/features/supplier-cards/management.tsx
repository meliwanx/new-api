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
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  CreditCard,
  Edit3,
  History,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  TicketPercent,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyLabel } from '@/lib/currency'
import {
  formatCurrencyUSD,
  formatQuota,
  formatTimestampToDate,
  parseQuotaFromDollars,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  adminAdjustSupplierCardQuota,
  adminCreateSupplierCardPlan,
  adminGetSupplierCardQuotaLogs,
  adminGetSupplierCardOrders,
  adminGetSupplierCardPlans,
  adminGetSupplierCards,
  adminGetSupplierCardSettings,
  adminGetSupplierCardStats,
  adminGetSupplierCardSuppliers,
  adminUpdateSupplierCardPlan,
  adminUpdateSupplierCardSettings,
} from './api'
import { getSupplierCardStatusMeta } from './components/supplier-card-visual'
import {
  SUPPLIER_CARD_STATUS,
  type SupplierCardAdminListParams,
  type SupplierCardOrderListParams,
  type SupplierCardPlan,
  type SupplierCardPlanPayload,
  type SupplierCardQuotaAdjustPayload,
  type SupplierCardQuotaLogListParams,
  type SupplierCardSupplier,
  type SupplierCardSupplierListParams,
} from './types'

const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1)
const PAGE_SIZE = 10

type FilterState = {
  page: number
  keyword: string
  status: string
  amount: string
  supplierLevel: string
  supplierUserId: string
  redeemedUserId: string
  createdFrom: string
  createdTo: string
  redeemedFrom: string
  redeemedTo: string
}

const defaultFilters: FilterState = {
  page: 1,
  keyword: '',
  status: 'all',
  amount: '',
  supplierLevel: '',
  supplierUserId: '',
  redeemedUserId: '',
  createdFrom: '',
  createdTo: '',
  redeemedFrom: '',
  redeemedTo: '',
}

type BalanceFilterState = {
  page: number
  keyword: string
  action: string
  supplierUserId: string
  operatorUserId: string
  createdFrom: string
  createdTo: string
}

const defaultBalanceFilters: BalanceFilterState = {
  page: 1,
  keyword: '',
  action: 'all',
  supplierUserId: '',
  operatorUserId: '',
  createdFrom: '',
  createdTo: '',
}

type SupplierFilterState = {
  page: number
  keyword: string
  supplierLevel: string
}

const defaultSupplierFilters: SupplierFilterState = {
  page: 1,
  keyword: '',
  supplierLevel: 'all',
}

type Translate = (key: string, options?: Record<string, unknown>) => string

function numberOrUndefined(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function timeOrUndefined(value: string) {
  if (!value) return undefined
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return undefined
  return Math.floor(parsed / 1000)
}

function makeDefaultPrices(amount: number) {
  return Object.fromEntries(LEVELS.map((level) => [String(level), amount]))
}

function parsePlanPrices(plan: SupplierCardPlan | null) {
  const fallback = plan?.amount ?? 10
  if (!plan) return makeDefaultPrices(fallback)
  try {
    const parsed = JSON.parse(plan.prices) as Record<string, number>
    return Object.fromEntries(
      LEVELS.map((level) => [
        String(level),
        Number(parsed[String(level)] ?? fallback),
      ])
    )
  } catch {
    return makeDefaultPrices(fallback)
  }
}

function buildCardParams(filters: FilterState): SupplierCardAdminListParams {
  return {
    p: filters.page,
    page_size: PAGE_SIZE,
    keyword: filters.keyword.trim(),
    status: filters.status === 'all' ? undefined : Number(filters.status),
    amount: numberOrUndefined(filters.amount),
    supplier_level: numberOrUndefined(filters.supplierLevel),
    supplier_user_id: numberOrUndefined(filters.supplierUserId),
    redeemed_user_id: numberOrUndefined(filters.redeemedUserId),
    created_time_from: timeOrUndefined(filters.createdFrom),
    created_time_to: timeOrUndefined(filters.createdTo),
    redeemed_time_from: timeOrUndefined(filters.redeemedFrom),
    redeemed_time_to: timeOrUndefined(filters.redeemedTo),
  }
}

function buildOrderParams(filters: FilterState): SupplierCardOrderListParams {
  return {
    p: filters.page,
    page_size: PAGE_SIZE,
    keyword: filters.keyword.trim(),
    amount: numberOrUndefined(filters.amount),
    supplier_level: numberOrUndefined(filters.supplierLevel),
    supplier_user_id: numberOrUndefined(filters.supplierUserId),
    created_time_from: timeOrUndefined(filters.createdFrom),
    created_time_to: timeOrUndefined(filters.createdTo),
  }
}

function buildBalanceLogParams(
  filters: BalanceFilterState
): SupplierCardQuotaLogListParams {
  return {
    p: filters.page,
    page_size: PAGE_SIZE,
    keyword: filters.keyword.trim(),
    action: filters.action === 'all' ? undefined : filters.action,
    supplier_user_id: numberOrUndefined(filters.supplierUserId),
    operator_user_id: numberOrUndefined(filters.operatorUserId),
    created_time_from: timeOrUndefined(filters.createdFrom),
    created_time_to: timeOrUndefined(filters.createdTo),
  }
}

function buildSupplierParams(
  filters: SupplierFilterState
): SupplierCardSupplierListParams {
  return {
    p: filters.page,
    page_size: PAGE_SIZE,
    keyword: filters.keyword.trim(),
    supplier_level:
      filters.supplierLevel === 'all'
        ? undefined
        : numberOrUndefined(filters.supplierLevel),
  }
}

function getBalanceActionLabel(action: string) {
  switch (action) {
    case 'admin_add':
      return 'Admin Added'
    case 'admin_subtract':
      return 'Admin Subtracted'
    case 'admin_override':
      return 'Admin Overrode'
    case 'purchase':
      return 'Card Purchase'
    default:
      return action || 'Unknown'
  }
}

function getSupplierStatusMeta(status: number) {
  switch (status) {
    case 1:
      return { label: 'Enabled', variant: 'success' as const }
    case 2:
      return { label: 'Disabled', variant: 'neutral' as const }
    default:
      return { label: 'Unknown', variant: 'warning' as const }
  }
}

function getCardStatusFilterLabel(value: string, t: Translate) {
  switch (value) {
    case 'all':
      return t('All statuses')
    case String(SUPPLIER_CARD_STATUS.UNUSED):
      return t('Unused')
    case String(SUPPLIER_CARD_STATUS.REDEEMED):
      return t('Redeemed')
    case String(SUPPLIER_CARD_STATUS.DISABLED):
      return t('Disabled')
    default:
      return value || t('All statuses')
  }
}

function getBalanceActionFilterLabel(value: string, t: Translate) {
  if (value === 'all') return t('All actions')
  return t(getBalanceActionLabel(value))
}

function PlanEditor({
  plans,
  saving,
  onSave,
}: {
  plans: SupplierCardPlan[]
  saving: boolean
  onSave: (id: number | null, payload: SupplierCardPlanPayload) => void
}) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<number | null>(null)
  const editingPlan = plans.find((plan) => plan.id === editingId) ?? null

  return (
    <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]'>
      <Card className='rounded-lg py-0'>
        <CardHeader className='border-b py-4'>
          <CardTitle>{t('Card Plans')}</CardTitle>
          <CardDescription>
            {t('Manage card face values and whether suppliers can buy them.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Face Value')}</TableHead>
                <TableHead>{t('Quota')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Sort Order')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className='font-mono font-semibold'>
                    {formatCurrencyUSD(plan.amount)}
                  </TableCell>
                  <TableCell>{formatQuota(plan.quota)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={plan.enabled ? t('Enabled') : t('Disabled')}
                      variant={plan.enabled ? 'success' : 'neutral'}
                      copyable={false}
                    />
                  </TableCell>
                  <TableCell>{plan.sort_order}</TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setEditingId(plan.id)}
                    >
                      <Edit3 data-icon='inline-start' />
                      {t('Edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlanForm
        key={editingPlan?.id ?? 'new'}
        editingPlan={editingPlan}
        saving={saving}
        onNew={() => setEditingId(null)}
        onSave={onSave}
      />
    </div>
  )
}

function PlanForm({
  editingPlan,
  saving,
  onNew,
  onSave,
}: {
  editingPlan: SupplierCardPlan | null
  saving: boolean
  onNew: () => void
  onSave: (id: number | null, payload: SupplierCardPlanPayload) => void
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(editingPlan?.amount ?? 10)
  const [sortOrder, setSortOrder] = useState(editingPlan?.sort_order ?? 0)
  const [enabled, setEnabled] = useState(editingPlan?.enabled ?? true)
  const [prices, setPrices] = useState<Record<string, number>>(
    parsePlanPrices(editingPlan)
  )

  const handleSubmit = () => {
    onSave(editingPlan?.id ?? null, {
      amount,
      sort_order: sortOrder,
      enabled,
      prices,
    })
  }

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{editingPlan ? t('Edit Plan') : t('New Plan')}</CardTitle>
        <CardDescription>
          {t('Set supplier purchase prices for levels 1 to 10.')}
        </CardDescription>
        <CardAction>
          <Button variant='outline' size='sm' onClick={onNew}>
            {t('New')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className='flex flex-col gap-4 p-4'>
        <FieldGroup className='gap-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field>
              <FieldLabel>{t('Face Value')}</FieldLabel>
              <Input
                type='number'
                min={1}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel>{t('Sort Order')}</FieldLabel>
              <Input
                type='number'
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value))}
              />
            </Field>
          </div>
          <Field orientation='horizontal'>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <div>
              <FieldLabel>{t('Enabled')}</FieldLabel>
              <FieldDescription>
                {t('Disabled plans are hidden from suppliers.')}
              </FieldDescription>
            </div>
          </Field>
        </FieldGroup>

        <div className='grid gap-2 sm:grid-cols-2'>
          {LEVELS.map((level) => (
            <Field key={level} className='gap-1'>
              <FieldLabel>{t('Level {{level}} Price', { level })}</FieldLabel>
              <Input
                type='number'
                min={0}
                step='0.01'
                value={prices[String(level)] ?? 0}
                onChange={(event) =>
                  setPrices((current) => ({
                    ...current,
                    [String(level)]: Number(event.target.value),
                  }))
                }
              />
            </Field>
          ))}
        </div>

        <Button disabled={saving} onClick={handleSubmit}>
          <Save data-icon='inline-start' />
          {t('Save Plan')}
        </Button>
      </CardContent>
    </Card>
  )
}

function SupplierBalanceTable({
  suppliers,
  filters,
  isLoading,
  selectedSupplierId,
  updateFilter,
  onSelect,
}: {
  suppliers: SupplierCardSupplier[]
  filters: SupplierFilterState
  isLoading: boolean
  selectedSupplierId: number | null
  updateFilter: (key: keyof SupplierFilterState, value: string) => void
  onSelect: (supplierId: number) => void
}) {
  const { t } = useTranslation()

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Supplier Balances')}</CardTitle>
        <CardDescription>
          {t(
            'List suppliers and adjust their dedicated card purchase balance.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,1fr)_180px]'>
          <Field>
            <FieldLabel>{t('Keyword')}</FieldLabel>
            <Input
              value={filters.keyword}
              placeholder={t('Filter by supplier name, email, or ID...')}
              onChange={(event) => updateFilter('keyword', event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t('Supplier Level')}</FieldLabel>
            <Select
              value={filters.supplierLevel}
              onValueChange={(value) =>
                updateFilter('supplierLevel', value ?? 'all')
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue>
                  {filters.supplierLevel === 'all'
                    ? t('All levels')
                    : t('Level {{level}}', {
                        level: Number(filters.supplierLevel),
                      })}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='all'>{t('All levels')}</SelectItem>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      {t('Level {{level}}', { level })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ID')}</TableHead>
              <TableHead>{t('Supplier')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Ordinary Balance')}</TableHead>
              <TableHead>{t('Card Purchase Balance')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className='h-16 rounded-lg' />
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>{t('No suppliers found')}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => {
                const status = getSupplierStatusMeta(supplier.status)
                const supplierName =
                  supplier.display_name ||
                  supplier.username ||
                  `#${supplier.id}`
                const isSelected = selectedSupplierId === supplier.id
                return (
                  <TableRow
                    key={supplier.id}
                    className={cn(
                      'cursor-pointer',
                      isSelected && 'bg-muted/50'
                    )}
                    onClick={() => onSelect(supplier.id)}
                  >
                    <TableCell className='font-mono'>#{supplier.id}</TableCell>
                    <TableCell>
                      <div className='min-w-0'>
                        <div className='truncate font-medium'>
                          {supplierName}
                        </div>
                        <div className='text-muted-foreground truncate text-xs'>
                          {supplier.username}
                          {supplier.email ? ` · ${supplier.email}` : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        <StatusBadge
                          label={t(status.label)}
                          variant={status.variant}
                          copyable={false}
                        />
                        <StatusBadge
                          label={t('Level {{level}}', {
                            level: supplier.supplier_level,
                          })}
                          variant='success'
                          copyable={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{supplier.group || '-'}</TableCell>
                    <TableCell className='font-mono'>
                      {formatQuota(supplier.quota)}
                    </TableCell>
                    <TableCell className='font-mono font-semibold'>
                      {formatQuota(supplier.supplier_card_quota)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant={isSelected ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => onSelect(supplier.id)}
                      >
                        <WalletCards data-icon='inline-start' />
                        {t('Adjust Balance')}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BalanceAdjustmentPanel({
  supplier,
  saving,
  onAdjust,
}: {
  supplier: SupplierCardSupplier | null
  saving: boolean
  onAdjust: (payload: SupplierCardQuotaAdjustPayload) => void
}) {
  const { t } = useTranslation()
  const currencyLabel = getCurrencyLabel()
  const [mode, setMode] =
    useState<SupplierCardQuotaAdjustPayload['mode']>('add')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')

  const amountValue = Number(amount)
  const parsedQuota =
    mode === 'override'
      ? parseQuotaFromDollars(amountValue)
      : parseQuotaFromDollars(Math.abs(amountValue))
  const canSubmit =
    supplier != null &&
    Number.isFinite(amountValue) &&
    (mode === 'override' ? parsedQuota >= 0 : parsedQuota > 0)

  const handleSubmit = () => {
    if (!canSubmit || supplier == null) return
    onAdjust({
      user_id: supplier.id,
      mode,
      value: parsedQuota,
      memo: memo.trim(),
    })
  }

  if (supplier == null) {
    return (
      <Card className='rounded-lg py-0'>
        <CardHeader className='border-b py-4'>
          <CardTitle>{t('Adjust Card Purchase Balance')}</CardTitle>
          <CardDescription>
            {t('Dedicated balance used by suppliers to buy cards.')}
          </CardDescription>
        </CardHeader>
        <CardContent className='p-4'>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <UserRoundCheck />
              </EmptyMedia>
              <EmptyTitle>{t('Select a supplier')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  const supplierName =
    supplier.display_name || supplier.username || `#${supplier.id}`

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Adjust Card Purchase Balance')}</CardTitle>
        <CardDescription>
          {supplierName} · #{supplier.id}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4 p-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs'>
              {t('Card Purchase Balance')}
            </div>
            <div className='mt-1 font-mono text-lg font-semibold'>
              {formatQuota(supplier.supplier_card_quota)}
            </div>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs'>
              {t('Ordinary Balance')}
            </div>
            <div className='mt-1 font-mono text-lg font-semibold'>
              {formatQuota(supplier.quota)}
            </div>
          </div>
        </div>
        <FieldGroup className='gap-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field>
              <FieldLabel>{t('Mode')}</FieldLabel>
              <Select
                value={mode}
                onValueChange={(value) =>
                  setMode(value as SupplierCardQuotaAdjustPayload['mode'])
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue>
                    {{
                      add: t('Add'),
                      subtract: t('Subtract'),
                      override: t('Override'),
                    }[mode] ?? mode}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='add'>{t('Add')}</SelectItem>
                    <SelectItem value='subtract'>{t('Subtract')}</SelectItem>
                    <SelectItem value='override'>{t('Override')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>
                {t('Amount')} ({currencyLabel})
              </FieldLabel>
              <Input
                type='number'
                step='0.000001'
                min={mode === 'override' ? 0 : 0.000001}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <FieldDescription>
                {t('Internal quota value: {{quota}}', {
                  quota: formatQuota(parsedQuota),
                })}
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel>{t('Memo')}</FieldLabel>
            <Textarea
              value={memo}
              maxLength={255}
              onChange={(event) => setMemo(event.target.value)}
              placeholder={t('Optional internal note')}
            />
          </Field>
        </FieldGroup>
        <div className='flex justify-end'>
          <Button disabled={!canSubmit || saving} onClick={handleSubmit}>
            <WalletCards data-icon='inline-start' />
            {saving ? t('Processing...') : t('Adjust Balance')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SupplierCardManagement() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [balanceFilters, setBalanceFilters] = useState<BalanceFilterState>(
    defaultBalanceFilters
  )
  const [supplierFilters, setSupplierFilters] = useState<SupplierFilterState>(
    defaultSupplierFilters
  )
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    null
  )
  const [maxPurchaseCountInput, setMaxPurchaseCountInput] = useState('')

  const cardParams = useMemo(() => buildCardParams(filters), [filters])
  const orderParams = useMemo(() => buildOrderParams(filters), [filters])
  const balanceLogParams = useMemo(
    () => buildBalanceLogParams(balanceFilters),
    [balanceFilters]
  )
  const supplierParams = useMemo(
    () => buildSupplierParams(supplierFilters),
    [supplierFilters]
  )

  const plansQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'plans'],
    queryFn: adminGetSupplierCardPlans,
  })
  const settingsQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'settings'],
    queryFn: adminGetSupplierCardSettings,
  })
  const statsQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'stats', cardParams],
    queryFn: () => adminGetSupplierCardStats(cardParams),
  })
  const ordersQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'orders', orderParams],
    queryFn: () => adminGetSupplierCardOrders(orderParams),
  })
  const cardsQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'cards', cardParams],
    queryFn: () => adminGetSupplierCards(cardParams),
  })
  const balanceLogsQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'balance-logs', balanceLogParams],
    queryFn: () => adminGetSupplierCardQuotaLogs(balanceLogParams),
  })
  const suppliersQuery = useQuery({
    queryKey: ['supplier-cards-admin', 'suppliers', supplierParams],
    queryFn: () => adminGetSupplierCardSuppliers(supplierParams),
  })

  const maxPurchaseCount =
    maxPurchaseCountInput === ''
      ? (settingsQuery.data?.data?.max_purchase_count ?? 100)
      : Number(maxPurchaseCountInput)
  const maxPurchaseCountValue =
    maxPurchaseCountInput === ''
      ? String(maxPurchaseCount)
      : maxPurchaseCountInput

  const planMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | null
      payload: SupplierCardPlanPayload
    }) =>
      id == null
        ? adminCreateSupplierCardPlan(payload)
        : adminUpdateSupplierCardPlan(id, payload),
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(t('Supplier card plan saved.'))
      await queryClient.invalidateQueries({
        queryKey: ['supplier-cards-admin'],
      })
    },
  })

  const settingsMutation = useMutation({
    mutationFn: adminUpdateSupplierCardSettings,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(t('Supplier card settings saved.'))
      await queryClient.invalidateQueries({
        queryKey: ['supplier-cards-admin'],
      })
    },
  })

  const balanceMutation = useMutation({
    mutationFn: adminAdjustSupplierCardQuota,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(t('Supplier card balance adjusted.'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supplier-cards-admin'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier-cards'] }),
      ])
    },
  })

  const plans = plansQuery.data?.data ?? []
  const stats = statsQuery.data?.data
  const orders = ordersQuery.data?.data
  const cards = cardsQuery.data?.data
  const balanceLogs = balanceLogsQuery.data?.data
  const suppliers = suppliersQuery.data?.data
  const selectedSupplier =
    suppliers?.items.find((supplier) => supplier.id === selectedSupplierId) ??
    null
  const totalOrderPages = Math.max(
    1,
    Math.ceil((orders?.total ?? 0) / PAGE_SIZE)
  )
  const totalCardPages = Math.max(1, Math.ceil((cards?.total ?? 0) / PAGE_SIZE))
  const totalBalanceLogPages = Math.max(
    1,
    Math.ceil((balanceLogs?.total ?? 0) / PAGE_SIZE)
  )
  const totalSupplierPages = Math.max(
    1,
    Math.ceil((suppliers?.total ?? 0) / PAGE_SIZE)
  )

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const updateBalanceFilter = (
    key: keyof BalanceFilterState,
    value: string
  ) => {
    setBalanceFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const updateSupplierFilter = (
    key: keyof SupplierFilterState,
    value: string
  ) => {
    setSupplierFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Supplier Card Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
            {[
              {
                label: t('Sold Cards'),
                value: stats?.sold_count ?? 0,
                icon: TicketPercent,
              },
              {
                label: t('Redeemed Cards'),
                value: stats?.redeemed_count ?? 0,
                icon: CreditCard,
              },
              {
                label: t('Unused Cards'),
                value: stats?.unused_count ?? 0,
                icon: SlidersHorizontal,
              },
              {
                label: t('Disabled Cards'),
                value: stats?.disabled_count ?? 0,
                icon: Settings2,
              },
              {
                label: t('Total Sales'),
                value: formatCurrencyUSD(stats?.total_sales ?? 0),
                icon: BarChart3,
              },
            ].map((item) => (
              <Card key={item.label} className='rounded-lg py-0'>
                <CardContent className='flex items-center gap-3 p-4'>
                  <div className='bg-background flex size-9 items-center justify-center rounded-lg border'>
                    <item.icon className='text-muted-foreground size-4' />
                  </div>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground truncate text-xs'>
                      {item.label}
                    </div>
                    <div className='truncate font-mono text-lg font-bold'>
                      {item.value}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue='plans'>
            <TabsList>
              <TabsTrigger value='plans'>{t('Plans')}</TabsTrigger>
              <TabsTrigger value='balances'>
                {t('Purchase Balances')}
              </TabsTrigger>
              <TabsTrigger value='orders'>{t('Sales Orders')}</TabsTrigger>
              <TabsTrigger value='cards'>
                {t('Cards & Redemptions')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value='plans' className='flex flex-col gap-4'>
              <Card className='rounded-lg py-0'>
                <CardHeader className='border-b py-4'>
                  <CardTitle>{t('Supplier Card Settings')}</CardTitle>
                  <CardDescription>
                    {t('Control purchase limits for supplier card orders.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-end'>
                  <Field className='max-w-xs'>
                    <FieldLabel>{t('Max Cards Per Purchase')}</FieldLabel>
                    <Input
                      type='number'
                      min={1}
                      max={1000}
                      value={maxPurchaseCountValue}
                      onChange={(event) =>
                        setMaxPurchaseCountInput(event.target.value)
                      }
                    />
                  </Field>
                  <Button
                    disabled={settingsMutation.isPending}
                    onClick={() =>
                      settingsMutation.mutate({
                        max_purchase_count: maxPurchaseCount,
                      })
                    }
                  >
                    <Save data-icon='inline-start' />
                    {t('Save Settings')}
                  </Button>
                </CardContent>
              </Card>

              {plansQuery.isLoading ? (
                <Skeleton className='h-80 rounded-lg' />
              ) : (
                <PlanEditor
                  plans={plans}
                  saving={planMutation.isPending}
                  onSave={(id, payload) => planMutation.mutate({ id, payload })}
                />
              )}
            </TabsContent>

            <TabsContent value='balances' className='flex flex-col gap-4'>
              <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]'>
                <div className='flex flex-col gap-4'>
                  <SupplierBalanceTable
                    suppliers={suppliers?.items ?? []}
                    filters={supplierFilters}
                    isLoading={suppliersQuery.isLoading}
                    selectedSupplierId={selectedSupplierId}
                    updateFilter={updateSupplierFilter}
                    onSelect={setSelectedSupplierId}
                  />
                  <PaginationBar
                    page={supplierFilters.page}
                    totalPages={totalSupplierPages}
                    onPageChange={(page) =>
                      setSupplierFilters((current) => ({ ...current, page }))
                    }
                  />
                </div>
                <BalanceAdjustmentPanel
                  key={selectedSupplier?.id ?? 'no-supplier'}
                  supplier={selectedSupplier}
                  saving={balanceMutation.isPending}
                  onAdjust={(payload) => balanceMutation.mutate(payload)}
                />
              </div>
              <BalanceFilterPanel
                filters={balanceFilters}
                updateFilter={updateBalanceFilter}
              />
              <Card className='rounded-lg py-0'>
                <CardHeader className='border-b py-4'>
                  <CardTitle>{t('Balance Movements')}</CardTitle>
                  <CardDescription>
                    {t(
                      'Audit supplier card purchase balance funding and purchase deductions.'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Supplier')}</TableHead>
                        <TableHead>{t('Action')}</TableHead>
                        <TableHead>{t('Change')}</TableHead>
                        <TableHead>{t('Before')}</TableHead>
                        <TableHead>{t('After')}</TableHead>
                        <TableHead>{t('Operator')}</TableHead>
                        <TableHead>{t('Order No.')}</TableHead>
                        <TableHead>{t('Memo')}</TableHead>
                        <TableHead>{t('Created At')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceLogsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9}>
                            <Skeleton className='h-16 rounded-lg' />
                          </TableCell>
                        </TableRow>
                      ) : (balanceLogs?.items ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9}>
                            <Empty>
                              <EmptyHeader>
                                <EmptyMedia variant='icon'>
                                  <History />
                                </EmptyMedia>
                                <EmptyTitle>
                                  {t('No balance movements found')}
                                </EmptyTitle>
                              </EmptyHeader>
                            </Empty>
                          </TableCell>
                        </TableRow>
                      ) : (
                        balanceLogs?.items.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>#{movement.supplier_user_id}</TableCell>
                            <TableCell>
                              <StatusBadge
                                label={t(
                                  getBalanceActionLabel(movement.action)
                                )}
                                variant={
                                  movement.action === 'purchase'
                                    ? 'neutral'
                                    : movement.quota_delta >= 0
                                      ? 'success'
                                      : 'warning'
                                }
                                copyable={false}
                              />
                            </TableCell>
                            <TableCell className='font-mono font-semibold'>
                              {movement.quota_delta > 0 ? '+' : ''}
                              {formatQuota(movement.quota_delta)}
                            </TableCell>
                            <TableCell className='font-mono'>
                              {formatQuota(movement.quota_before)}
                            </TableCell>
                            <TableCell className='font-mono'>
                              {formatQuota(movement.quota_after)}
                            </TableCell>
                            <TableCell>
                              {movement.operator_user_id
                                ? `#${movement.operator_user_id}`
                                : '-'}
                            </TableCell>
                            <TableCell className='font-mono'>
                              {movement.order_no || '-'}
                            </TableCell>
                            <TableCell className='max-w-48 truncate'>
                              {movement.memo || '-'}
                            </TableCell>
                            <TableCell>
                              {formatTimestampToDate(movement.created_time)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <PaginationBar
                page={balanceFilters.page}
                totalPages={totalBalanceLogPages}
                onPageChange={(page) =>
                  setBalanceFilters((current) => ({ ...current, page }))
                }
              />
            </TabsContent>

            <TabsContent value='orders' className='flex flex-col gap-4'>
              <FilterPanel filters={filters} updateFilter={updateFilter} />
              <Card className='rounded-lg py-0'>
                <CardHeader className='border-b py-4'>
                  <CardTitle>{t('Supplier Card Sales')}</CardTitle>
                  <CardDescription>
                    {t(
                      'Review supplier purchases by time, amount, level, and supplier.'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Order No.')}</TableHead>
                        <TableHead>{t('Supplier')}</TableHead>
                        <TableHead>{t('Level')}</TableHead>
                        <TableHead>{t('Amount')}</TableHead>
                        <TableHead>{t('Count')}</TableHead>
                        <TableHead>{t('Sales')}</TableHead>
                        <TableHead>{t('Created At')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Skeleton className='h-16 rounded-lg' />
                          </TableCell>
                        </TableRow>
                      ) : (orders?.items ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Empty>
                              <EmptyHeader>
                                <EmptyMedia variant='icon'>
                                  <CreditCard />
                                </EmptyMedia>
                                <EmptyTitle>{t('No orders found')}</EmptyTitle>
                              </EmptyHeader>
                            </Empty>
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders?.items.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className='font-mono'>
                              {order.order_no}
                            </TableCell>
                            <TableCell>#{order.supplier_user_id}</TableCell>
                            <TableCell>{order.supplier_level}</TableCell>
                            <TableCell>
                              {formatCurrencyUSD(order.amount)}
                            </TableCell>
                            <TableCell>{order.count}</TableCell>
                            <TableCell className='font-mono font-semibold'>
                              {formatCurrencyUSD(order.total_price)}
                            </TableCell>
                            <TableCell>
                              {formatTimestampToDate(order.created_time)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <PaginationBar
                page={filters.page}
                totalPages={totalOrderPages}
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
              />
            </TabsContent>

            <TabsContent value='cards' className='flex flex-col gap-4'>
              <FilterPanel
                filters={filters}
                updateFilter={updateFilter}
                includeRedeemFilters
              />
              <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'>
                <Card className='rounded-lg py-0'>
                  <CardHeader className='border-b py-4'>
                    <CardTitle>{t('Card Redemption Details')}</CardTitle>
                    <CardDescription>
                      {t(
                        'Filter sold cards by status, supplier, redeemer, and time range.'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='p-0'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Code')}</TableHead>
                          <TableHead>{t('Status')}</TableHead>
                          <TableHead>{t('Supplier')}</TableHead>
                          <TableHead>{t('Redeemer')}</TableHead>
                          <TableHead>{t('Amount')}</TableHead>
                          <TableHead>{t('Created At')}</TableHead>
                          <TableHead>{t('Redeemed At')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cardsQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Skeleton className='h-16 rounded-lg' />
                            </TableCell>
                          </TableRow>
                        ) : (cards?.items ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Empty>
                                <EmptyHeader>
                                  <EmptyMedia variant='icon'>
                                    <TicketPercent />
                                  </EmptyMedia>
                                  <EmptyTitle>{t('No cards found')}</EmptyTitle>
                                </EmptyHeader>
                              </Empty>
                            </TableCell>
                          </TableRow>
                        ) : (
                          cards?.items.map((card) => {
                            const meta = getSupplierCardStatusMeta(card.status)
                            return (
                              <TableRow key={card.id}>
                                <TableCell className='font-mono'>
                                  {card.code_preview}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    label={t(meta.label)}
                                    variant={meta.variant}
                                    copyable={false}
                                  />
                                </TableCell>
                                <TableCell>#{card.supplier_user_id}</TableCell>
                                <TableCell>
                                  {card.redeemed_user_id
                                    ? `#${card.redeemed_user_id}`
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {formatCurrencyUSD(card.amount)}
                                </TableCell>
                                <TableCell>
                                  {formatTimestampToDate(card.created_time)}
                                </TableCell>
                                <TableCell>
                                  {formatTimestampToDate(card.redeemed_time)}
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className='rounded-lg py-0'>
                  <CardHeader className='border-b py-4'>
                    <CardTitle>{t('Breakdown')}</CardTitle>
                    <CardDescription>
                      {t(
                        'Current filter statistics by amount and supplier level.'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-4 p-4'>
                    <div>
                      <div className='mb-2 text-sm font-medium'>
                        {t('By Amount')}
                      </div>
                      <div className='flex flex-col gap-2'>
                        {(stats?.by_amount ?? []).map((item) => (
                          <div
                            key={item.amount}
                            className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'
                          >
                            <span>{formatCurrencyUSD(item.amount)}</span>
                            <span className='font-mono'>
                              {item.count} / {formatCurrencyUSD(item.sales)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className='mb-2 text-sm font-medium'>
                        {t('By Supplier Level')}
                      </div>
                      <div className='flex flex-col gap-2'>
                        {(stats?.by_level ?? []).map((item) => (
                          <div
                            key={item.supplier_level}
                            className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'
                          >
                            <span>
                              {t('Level {{level}}', {
                                level: item.supplier_level,
                              })}
                            </span>
                            <span className='font-mono'>
                              {item.count} / {formatCurrencyUSD(item.sales)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <PaginationBar
                page={filters.page}
                totalPages={totalCardPages}
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
              />
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function FilterPanel({
  filters,
  updateFilter,
  includeRedeemFilters,
}: {
  filters: FilterState
  updateFilter: (key: keyof FilterState, value: string) => void
  includeRedeemFilters?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Filters')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Field>
          <FieldLabel>{t('Keyword')}</FieldLabel>
          <Input
            value={filters.keyword}
            placeholder={t('Order, code, or token')}
            onChange={(event) => updateFilter('keyword', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('Status')}</FieldLabel>
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter('status', value ?? 'all')}
          >
            <SelectTrigger className='w-full'>
              <SelectValue>
                {getCardStatusFilterLabel(filters.status, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='all'>{t('All statuses')}</SelectItem>
                <SelectItem value={String(SUPPLIER_CARD_STATUS.UNUSED)}>
                  {t('Unused')}
                </SelectItem>
                <SelectItem value={String(SUPPLIER_CARD_STATUS.REDEEMED)}>
                  {t('Redeemed')}
                </SelectItem>
                <SelectItem value={String(SUPPLIER_CARD_STATUS.DISABLED)}>
                  {t('Disabled')}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t('Amount')}</FieldLabel>
          <Input
            value={filters.amount}
            type='number'
            placeholder='10'
            onChange={(event) => updateFilter('amount', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('Supplier Level')}</FieldLabel>
          <Input
            value={filters.supplierLevel}
            type='number'
            min={1}
            max={10}
            onChange={(event) =>
              updateFilter('supplierLevel', event.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('Supplier User ID')}</FieldLabel>
          <Input
            value={filters.supplierUserId}
            type='number'
            onChange={(event) =>
              updateFilter('supplierUserId', event.target.value)
            }
          />
        </Field>
        {includeRedeemFilters && (
          <Field>
            <FieldLabel>{t('Redeemed User ID')}</FieldLabel>
            <Input
              value={filters.redeemedUserId}
              type='number'
              onChange={(event) =>
                updateFilter('redeemedUserId', event.target.value)
              }
            />
          </Field>
        )}
        <Field>
          <FieldLabel>{t('Created From')}</FieldLabel>
          <Input
            value={filters.createdFrom}
            type='datetime-local'
            onChange={(event) =>
              updateFilter('createdFrom', event.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('Created To')}</FieldLabel>
          <Input
            value={filters.createdTo}
            type='datetime-local'
            onChange={(event) => updateFilter('createdTo', event.target.value)}
          />
        </Field>
        {includeRedeemFilters && (
          <>
            <Field>
              <FieldLabel>{t('Redeemed From')}</FieldLabel>
              <Input
                value={filters.redeemedFrom}
                type='datetime-local'
                onChange={(event) =>
                  updateFilter('redeemedFrom', event.target.value)
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t('Redeemed To')}</FieldLabel>
              <Input
                value={filters.redeemedTo}
                type='datetime-local'
                onChange={(event) =>
                  updateFilter('redeemedTo', event.target.value)
                }
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BalanceFilterPanel({
  filters,
  updateFilter,
}: {
  filters: BalanceFilterState
  updateFilter: (key: keyof BalanceFilterState, value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <Card className='rounded-lg py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>{t('Balance Filters')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Field>
          <FieldLabel>{t('Keyword')}</FieldLabel>
          <Input
            value={filters.keyword}
            placeholder={t('Order No. or memo')}
            onChange={(event) => updateFilter('keyword', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('Action')}</FieldLabel>
          <Select
            value={filters.action}
            onValueChange={(value) => updateFilter('action', value ?? 'all')}
          >
            <SelectTrigger className='w-full'>
              <SelectValue>
                {getBalanceActionFilterLabel(filters.action, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='all'>{t('All actions')}</SelectItem>
                <SelectItem value='admin_add'>{t('Admin Added')}</SelectItem>
                <SelectItem value='admin_subtract'>
                  {t('Admin Subtracted')}
                </SelectItem>
                <SelectItem value='admin_override'>
                  {t('Admin Overrode')}
                </SelectItem>
                <SelectItem value='purchase'>{t('Card Purchase')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t('Supplier User ID')}</FieldLabel>
          <Input
            value={filters.supplierUserId}
            type='number'
            onChange={(event) =>
              updateFilter('supplierUserId', event.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('Operator User ID')}</FieldLabel>
          <Input
            value={filters.operatorUserId}
            type='number'
            onChange={(event) =>
              updateFilter('operatorUserId', event.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('Created From')}</FieldLabel>
          <Input
            value={filters.createdFrom}
            type='datetime-local'
            onChange={(event) =>
              updateFilter('createdFrom', event.target.value)
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('Created To')}</FieldLabel>
          <Input
            value={filters.createdTo}
            type='datetime-local'
            onChange={(event) => updateFilter('createdTo', event.target.value)}
          />
        </Field>
      </CardContent>
    </Card>
  )
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className='flex items-center justify-end gap-2'>
      <span className='text-muted-foreground text-xs'>
        {t('Page {{page}} of {{total}}', { page, total: totalPages })}
      </span>
      <Button
        variant='outline'
        size='sm'
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('Previous')}
      </Button>
      <Button
        variant='outline'
        size='sm'
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('Next')}
      </Button>
    </div>
  )
}
