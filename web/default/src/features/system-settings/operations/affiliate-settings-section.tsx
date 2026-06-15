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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

// 比例以“百分比”形式展示（如 10 表示 10%），保存时换算为后端使用的小数（0.1）。
const affiliateSchema = z.object({
  AffMultiLevelEnabled: z.boolean(),
  AffCommissionRateL1: z.coerce.number().min(0).max(100),
  AffCommissionRateL2: z.coerce.number().min(0).max(100),
  AffCommissionRateL3: z.coerce.number().min(0).max(100),
  AffCommissionMinRecharge: z.coerce.number().min(0),
  AffCommissionValidityDays: z.coerce.number().int().min(0),
  AffCommissionOnlyRealPay: z.boolean(),
})

type AffiliateFormValues = z.infer<typeof affiliateSchema>

type AffiliateSettingsSectionProps = {
  defaultValues: {
    AffMultiLevelEnabled: boolean
    AffCommissionRateL1: number
    AffCommissionRateL2: number
    AffCommissionRateL3: number
    AffCommissionMinRecharge: number
    AffCommissionValidityDays: number
    AffCommissionOnlyRealPay: boolean
  }
}

const toPercent = (decimal: number) =>
  Math.round((decimal ?? 0) * 1000) / 10
const toDecimal = (percent: number) =>
  Math.round((percent ?? 0) * 1000) / 100000

export function AffiliateSettingsSection({
  defaultValues,
}: AffiliateSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults: AffiliateFormValues = {
    AffMultiLevelEnabled: defaultValues.AffMultiLevelEnabled,
    AffCommissionRateL1: toPercent(defaultValues.AffCommissionRateL1),
    AffCommissionRateL2: toPercent(defaultValues.AffCommissionRateL2),
    AffCommissionRateL3: toPercent(defaultValues.AffCommissionRateL3),
    AffCommissionMinRecharge: defaultValues.AffCommissionMinRecharge,
    AffCommissionValidityDays: defaultValues.AffCommissionValidityDays,
    AffCommissionOnlyRealPay: defaultValues.AffCommissionOnlyRealPay,
  }

  const form = useForm({
    resolver: zodResolver(affiliateSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (data: AffiliateFormValues) => {
    // 比例字段换算回小数后再提交，其余原样提交。
    const payload: Record<string, string | number | boolean> = {
      AffMultiLevelEnabled: data.AffMultiLevelEnabled,
      AffCommissionRateL1: toDecimal(data.AffCommissionRateL1),
      AffCommissionRateL2: toDecimal(data.AffCommissionRateL2),
      AffCommissionRateL3: toDecimal(data.AffCommissionRateL3),
      AffCommissionMinRecharge: data.AffCommissionMinRecharge,
      AffCommissionValidityDays: data.AffCommissionValidityDays,
      AffCommissionOnlyRealPay: data.AffCommissionOnlyRealPay,
    }
    for (const [key, value] of Object.entries(payload)) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Multi-level Affiliate')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='AffMultiLevelEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable multi-level commission')}</FormLabel>
                  <FormDescription>
                    {t(
                      'When a downstream user recharges, distribute commission up the invitation chain (requires payment compliance confirmation)'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='grid gap-6 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='AffCommissionRateL1'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Level 1 rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      max='100'
                      step='0.1'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Commission for the direct inviter')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='AffCommissionRateL2'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Level 2 rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      max='100'
                      step='0.1'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("The inviter's inviter")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='AffCommissionRateL3'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Level 3 rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      max='100'
                      step='0.1'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Three levels up the chain')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AffCommissionValidityDays'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Commission validity (days)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      step='1'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Counted from the downstream user registration date. 0 means permanent; e.g. 30 means recharges within 30 days of registration earn commission'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='AffCommissionMinRecharge'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum recharge to qualify')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      step='0.01'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('No commission below this recharge amount. 0 disables the limit')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='AffCommissionOnlyRealPay'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Only real paid recharges')}</FormLabel>
                  <FormDescription>
                    {t('Exclude system gifts and reward credits from commission')}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
