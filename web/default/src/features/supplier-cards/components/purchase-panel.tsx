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
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatCurrencyUSD,
  formatQuota,
  parseQuotaFromDollars,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import type { SupplierCardPlan } from '../types'

interface PurchasePanelProps {
  plans: SupplierCardPlan[]
  supplierLevel: number
  maxPurchaseCount: number
  balanceQuota: number
  loading?: boolean
  purchasing?: boolean
  onPurchase: (planId: number, count: number) => void
}

export function PurchasePanel({
  plans,
  supplierLevel,
  maxPurchaseCount,
  balanceQuota,
  loading,
  purchasing,
  onPurchase,
}: PurchasePanelProps) {
  const { t } = useTranslation()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [count, setCount] = useState(1)
  const [pendingPurchase, setPendingPurchase] = useState<{
    plan: SupplierCardPlan
    count: number
  } | null>(null)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId]
  )
  const safeCount = Math.min(Math.max(count, 1), maxPurchaseCount || 1)
  const totalPrice = (selectedPlan?.price ?? 0) * safeCount
  const pendingTotalPrice =
    (pendingPurchase?.plan.price ?? 0) * (pendingPurchase?.count ?? 0)

  const updateCount = (value: number) => {
    setCount(Math.min(Math.max(value, 1), maxPurchaseCount || 1))
  }

  return (
    <>
      <Card className='rounded-lg py-0'>
        <CardHeader className='border-b py-4'>
          <CardTitle>{t('Buy Recharge Cards')}</CardTitle>
          <CardDescription>
            {t(
              'Supplier level {{level}} pricing, paid from your card purchase balance.',
              {
                level: supplierLevel,
              }
            )}
          </CardDescription>
          <CardAction>
            <div className='text-right'>
              <div className='text-muted-foreground text-xs'>
                {t('Card Purchase Balance')}
              </div>
              <div className='font-mono text-sm font-semibold'>
                {formatQuota(balanceQuota)}
              </div>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className='flex flex-col gap-4 p-4'>
          {loading ? (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className='h-24 rounded-lg' />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
              {t('No recharge card plans are available.')}
            </div>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlan?.id
                return (
                  <button
                    key={plan.id}
                    type='button'
                    className={cn(
                      'bg-background hover:bg-muted/60 flex min-h-24 flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors',
                      selected &&
                        'border-primary bg-primary/5 ring-primary/30 ring-1'
                    )}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <span className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Face Value')}
                    </span>
                    <span className='font-mono text-2xl font-bold'>
                      {formatCurrencyUSD(plan.amount)}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {t('Cost {{price}} each', {
                        price: formatCurrencyUSD(plan.price),
                      })}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <FieldGroup className='gap-4'>
            <Field>
              <FieldLabel>{t('Purchase Quantity')}</FieldLabel>
              <div className='flex max-w-xs items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  disabled={safeCount <= 1 || purchasing}
                  onClick={() => updateCount(safeCount - 1)}
                  aria-label={t('Decrease quantity')}
                >
                  <Minus />
                </Button>
                <Input
                  className='text-center font-mono'
                  type='number'
                  min={1}
                  max={maxPurchaseCount}
                  value={safeCount}
                  disabled={purchasing}
                  onChange={(event) => updateCount(Number(event.target.value))}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  disabled={safeCount >= maxPurchaseCount || purchasing}
                  onClick={() => updateCount(safeCount + 1)}
                  aria-label={t('Increase quantity')}
                >
                  <Plus />
                </Button>
              </div>
              <FieldDescription>
                {t('You can buy up to {{count}} cards per order.', {
                  count: maxPurchaseCount,
                })}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className='flex flex-col items-stretch gap-3 rounded-b-lg sm:flex-row sm:items-center sm:justify-between'>
          <div className='text-sm'>
            <span className='text-muted-foreground'>{t('Order Total')}</span>
            <span className='ml-2 font-mono font-semibold'>
              {formatCurrencyUSD(totalPrice)}
            </span>
          </div>
          <Button
            disabled={!selectedPlan || purchasing || loading}
            onClick={() =>
              selectedPlan &&
              setPendingPurchase({ plan: selectedPlan, count: safeCount })
            }
          >
            {purchasing ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <ShoppingCart data-icon='inline-start' />
            )}
            {t('Buy Cards')}
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={pendingPurchase != null}
        onOpenChange={(open) => {
          if (!open) setPendingPurchase(null)
        }}
        title={t('Confirm recharge card purchase')}
        desc={
          pendingPurchase == null ? (
            ''
          ) : (
            <div className='flex flex-col gap-3'>
              <p>
                {t(
                  'You are buying {{count}} recharge card(s) with face value {{amount}}.',
                  {
                    count: String(pendingPurchase.count),
                    amount: formatCurrencyUSD(pendingPurchase.plan.amount),
                  }
                )}
              </p>
              <div className='grid gap-2 rounded-lg border p-3 text-sm'>
                <div className='flex items-center justify-between gap-3'>
                  <span>{t('Order Total')}</span>
                  <span className='font-mono font-semibold'>
                    {formatCurrencyUSD(pendingTotalPrice)}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-3'>
                  <span>{t('Balance Deduction')}</span>
                  <span className='font-mono font-semibold'>
                    {formatQuota(parseQuotaFromDollars(pendingTotalPrice))}
                  </span>
                </div>
              </div>
              <p>
                {t(
                  'This will deduct {{total}} from your card purchase balance.',
                  {
                    total: formatCurrencyUSD(pendingTotalPrice),
                  }
                )}
              </p>
            </div>
          )
        }
        confirmText={t('Confirm Purchase')}
        isLoading={purchasing}
        handleConfirm={() => {
          if (pendingPurchase == null) return
          onPurchase(pendingPurchase.plan.id, pendingPurchase.count)
          setPendingPurchase(null)
        }}
      />
    </>
  )
}
