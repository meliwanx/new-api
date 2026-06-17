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
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  CreditCard,
  Edit3,
  Save,
  Settings2,
  SlidersHorizontal,
  TicketPercent,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  formatCurrencyUSD,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
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
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  adminCreateSupplierCardPlan,
  adminGetSupplierCardOrders,
  adminGetSupplierCardPlans,
  adminGetSupplierCards,
  adminGetSupplierCardSettings,
  adminGetSupplierCardStats,
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
  const [amount, setAmount] = useState(10)
  const [sortOrder, setSortOrder] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [prices, setPrices] = useState<Record<string, number>>(
    makeDefaultPrices(10)
  )

  useEffect(() => {
    if (!editingPlan) {
      setAmount(10)
      setSortOrder(0)
      setEnabled(true)
      setPrices(makeDefaultPrices(10))
      return
    }
    setAmount(editingPlan.amount)
    setSortOrder(editingPlan.sort_order)
    setEnabled(editingPlan.enabled)
    setPrices(parsePlanPrices(editingPlan))
  }, [editingPlan])

  const handleSubmit = () => {
    onSave(editingId, {
      amount,
      sort_order: sortOrder,
      enabled,
      prices,
    })
  }

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

      <Card className='rounded-lg py-0'>
        <CardHeader className='border-b py-4'>
          <CardTitle>{editingPlan ? t('Edit Plan') : t('New Plan')}</CardTitle>
          <CardDescription>
            {t('Set supplier purchase prices for levels 1 to 10.')}
          </CardDescription>
          <CardAction>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setEditingId(null)}
            >
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
    </div>
  )
}

export function SupplierCardManagement() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [maxPurchaseCount, setMaxPurchaseCount] = useState(100)

  const cardParams = useMemo(() => buildCardParams(filters), [filters])
  const orderParams = useMemo(() => buildOrderParams(filters), [filters])

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

  useEffect(() => {
    const value = settingsQuery.data?.data?.max_purchase_count
    if (value) setMaxPurchaseCount(value)
  }, [settingsQuery.data?.data?.max_purchase_count])

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

  const plans = plansQuery.data?.data ?? []
  const stats = statsQuery.data?.data
  const orders = ordersQuery.data?.data
  const cards = cardsQuery.data?.data
  const totalOrderPages = Math.max(
    1,
    Math.ceil((orders?.total ?? 0) / PAGE_SIZE)
  )
  const totalCardPages = Math.max(1, Math.ceil((cards?.total ?? 0) / PAGE_SIZE))

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
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
                      value={maxPurchaseCount}
                      onChange={(event) =>
                        setMaxPurchaseCount(Number(event.target.value))
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
              <SelectValue />
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
