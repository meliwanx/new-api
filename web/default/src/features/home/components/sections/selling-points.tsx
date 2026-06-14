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
import { Activity, Check, Network, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { AnimateInView } from '@/components/animate-in-view'

interface SellingPoint {
  id: string
  num: string
  icon: ReactNode
  title: string
  desc: string
  points: string[]
  visual: ReactNode
}

export function SellingPoints() {
  const { t } = useTranslation()

  const items: SellingPoint[] = [
    {
      id: 'stability',
      num: '01',
      icon: <ShieldCheck className='size-5' strokeWidth={1.5} />,
      title: t('Rock-solid Stability'),
      desc: t(
        'Multi-channel failover, automatic retries and real-time health checks keep every request flowing — even when an upstream provider degrades'
      ),
      points: [
        `99.9% ${t('uptime SLA')}`,
        t('Automatic failover & retry'),
        t('Real-time health monitoring'),
      ],
      visual: <UptimeVisual />,
    },
    {
      id: 'enterprise',
      num: '02',
      icon: <Activity className='size-5' strokeWidth={1.5} />,
      title: t('Enterprise-grade Service'),
      desc: t(
        'Fine-grained access control, audit logs, token and quota management with dedicated support — purpose-built for teams and organizations'
      ),
      points: [
        t('Role-based access & multi-tenant'),
        t('Audit logs & usage analytics'),
        t('SLA-backed dedicated support'),
      ],
      visual: <ControlsVisual />,
    },
    {
      id: 'cluster',
      num: '03',
      icon: <Network className='size-5' strokeWidth={1.5} />,
      title: t('High-concurrency Cluster'),
      desc: t(
        'Horizontally scalable stateless nodes with Redis-backed coordination and intelligent load balancing absorb massive parallel traffic with ease'
      ),
      points: [
        t('Horizontal auto-scaling'),
        t('Intelligent load balancing'),
        t('Redis-backed distributed cache'),
      ],
      visual: <ClusterVisual />,
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-14 max-w-2xl md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Why teams choose us')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('A relay station engineered for production')}
          </h2>
          <p className='text-muted-foreground mt-4 text-sm leading-relaxed md:text-base'>
            {t(
              'Three pillars that let you ship AI features on top of mainstream large models with confidence'
            )}
          </p>
        </AnimateInView>

        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {items.map((item, i) => (
            <AnimateInView
              key={item.id}
              delay={i * 120}
              animation='fade-up'
              className='bg-background group flex flex-col p-7 transition-colors duration-300 md:p-8'
            >
              <div className='flex items-center justify-between'>
                <div className='text-foreground border-border/60 bg-muted/40 group-hover:bg-foreground group-hover:text-background flex size-11 items-center justify-center rounded-xl border transition-colors duration-300'>
                  {item.icon}
                </div>
                <span className='text-muted-foreground/50 text-xs font-semibold tabular-nums'>
                  {item.num}
                </span>
              </div>

              <h3 className='mt-6 text-base font-semibold'>{item.title}</h3>
              <p className='text-muted-foreground mt-2.5 text-sm leading-relaxed'>
                {item.desc}
              </p>

              <ul className='mt-5 space-y-2.5'>
                {item.points.map((p) => (
                  <li
                    key={p}
                    className='text-foreground/80 flex items-center gap-2.5 text-sm'
                  >
                    <span className='border-border/60 bg-muted/50 flex size-4 shrink-0 items-center justify-center rounded-full border'>
                      <Check className='size-2.5' strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>

              <div className='border-border/40 mt-7 border-t pt-6'>
                {item.visual}
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Minimal uptime bar chart — all bars healthy, monochrome. */
function UptimeVisual() {
  const bars = [90, 96, 88, 99, 94, 100, 92, 98, 91, 97, 95, 99]
  return (
    <div className='flex h-12 items-end gap-1' aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className='bg-foreground/15 group-hover:bg-foreground/30 flex-1 rounded-[2px] transition-colors duration-300'
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

/** Stacked permission rows — represents access control & audit. */
function ControlsVisual() {
  const rows = ['Admin', 'Team', 'Viewer']
  return (
    <div className='space-y-2' aria-hidden>
      {rows.map((r, i) => (
        <div key={r} className='flex items-center gap-2'>
          <span className='bg-foreground/40 size-1.5 rounded-full' />
          <div className='bg-muted/60 relative h-1.5 flex-1 overflow-hidden rounded-full'>
            <span
              className='bg-foreground/30 absolute inset-y-0 left-0 rounded-full'
              style={{ width: `${100 - i * 28}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Node grid with a highlighted center — represents distributed cluster. */
function ClusterVisual() {
  return (
    <div className='grid grid-cols-6 gap-1.5' aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => {
        const active = i % 5 === 0 || i === 9
        return (
          <span
            key={i}
            className={
              active
                ? 'bg-foreground/70 aspect-square rounded-[3px]'
                : 'bg-foreground/15 group-hover:bg-foreground/25 aspect-square rounded-[3px] transition-colors duration-300'
            }
          />
        )
      })}
    </div>
  )
}
