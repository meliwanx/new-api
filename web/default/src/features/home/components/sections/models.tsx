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
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { AnimateInView } from '@/components/animate-in-view'

const MODELS: { icon: string; name: string }[] = [
  { icon: 'OpenAI', name: 'OpenAI' },
  { icon: 'Claude', name: 'Claude' },
  { icon: 'Gemini', name: 'Gemini' },
  { icon: 'DeepSeek', name: 'DeepSeek' },
  { icon: 'Qwen', name: 'Qwen' },
  { icon: 'Doubao', name: 'Doubao' },
  { icon: 'Grok', name: 'Grok' },
  { icon: 'Moonshot', name: 'Kimi' },
  { icon: 'Zhipu', name: 'GLM' },
  { icon: 'Minimax', name: 'MiniMax' },
  { icon: 'Mistral', name: 'Mistral' },
  { icon: 'Meta', name: 'Llama' },
]

export function Models() {
  const { t } = useTranslation()

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-20 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 text-center'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Supported Models')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Every mainstream model, one endpoint')}
          </h2>
          <p className='text-muted-foreground mx-auto mt-4 max-w-xl text-sm leading-relaxed md:text-base'>
            {t(
              'Route to the latest models from the providers your team already relies on — without juggling keys, SDKs or protocols'
            )}
          </p>
        </AnimateInView>

        <div className='border-border/40 bg-border/40 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
          {MODELS.map((m, i) => (
            <AnimateInView
              key={m.name}
              delay={i * 40}
              animation='fade-in'
              className='bg-background group flex flex-col items-center justify-center gap-2.5 px-4 py-7 transition-colors duration-300'
            >
              <span className='text-foreground/60 group-hover:text-foreground transition-colors duration-300'>
                {getLobeIcon(m.icon, 30)}
              </span>
              <span className='text-muted-foreground group-hover:text-foreground text-xs font-medium transition-colors duration-300'>
                {m.name}
              </span>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
