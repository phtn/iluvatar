'use client'

import type { ReactElement } from 'react'
import { startTransition, useMemo, useState, useTransition } from 'react'
import styles from './GameShell.module.css'
import { CraftQueuePanel } from './crafting/CraftQueuePanel'
import { CraftingPanel } from './crafting/CraftingPanel'
import { IconBackpack, IconBolt, IconHammer, IconMap, IconMenu, IconUsers } from './icons'
import { InventoryPanel } from './inventory/InventoryPanel'
import { PlayersPanel } from './players/PlayersPanel'
import { withViewTransition } from './viewTransitions'
import { WorldSurface } from './world/WorldSurface'

type PanelId = 'world' | 'players' | 'inventory' | 'crafting'

type NavItem = Readonly<{
  id: PanelId
  label: string
  description: string
  icon: (props: { className?: string }) => ReactElement
}>

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function StatPill(props: Readonly<{ label: string; value: string }>) {
  return (
    <div
      className={cx(
        styles.glassCard,
        'flex items-center gap-2 rounded-full px-3 py-1 text-xs text-black/70 dark:text-white/70'
      )}>
      <span className='opacity-70'>{props.label}</span>
      <span className='font-medium opacity-90'>{props.value}</span>
    </div>
  )
}

function Card(props: Readonly<{ title: string; subtitle?: string; children: React.ReactNode }>) {
  return (
    <section className={cx(styles.glassCard, '')}>
      <div className='hidden _flex items-start justify-between gap-4'>
        <div className=''>
          <div className='flex items-center space-x-4'>
            <h2 className='text-base font-semibold tracking-tight text-black dark:text-white'>{props.title}</h2>
          </div>
          {props.subtitle ? <p className='mt-1 text-sm text-black/55 dark:text-white/55'>{props.subtitle}</p> : null}
        </div>
      </div>
      <div className=''>{props.children}</div>
    </section>
  )
}
function Panel(props: Readonly<{ id: PanelId }>) {
  switch (props.id) {
    case 'world':
      return (
        <div className='grid lg:grid-cols-2'>
          <div className='lg:col-span-2'>
            <Card title='World' subtitle='Anonymous players can join and appear in the shared world.'>
              <WorldSurface biomeId='forest' />
            </Card>
          </div>
        </div>
      )
    case 'players':
      return (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card title='Players' subtitle='Active players, parties, and status.'>
            <PlayersPanel biomeId='forest' />
          </Card>
          <Card title='Party' subtitle='Quick party overview.'>
            <div className='grid gap-3'>
              <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
                Party UI goes here (invite, ready checks, roles).
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <StatPill label='Members' value='1/4' />
                <StatPill label='Queue' value='off' />
              </div>
            </div>
          </Card>
        </div>
      )
    case 'inventory':
      return (
        <div className='grid gap-4 lg:grid-cols-3'>
          <div className='lg:col-span-2'>
            <Card title='Inventory' subtitle='Items, stacks, and sorting.'>
              <InventoryPanel biomeId='forest' />
            </Card>
          </div>
          <Card title='Details' subtitle='Select an item to see stats.'>
            <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
              No item selected.
            </div>
          </Card>
        </div>
      )
    case 'crafting':
      return (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card title='Crafting' subtitle='Recipes and station workflow.'>
            <CraftingPanel biomeId='forest' />
          </Card>
          <Card title='Queue' subtitle='Craft queue and progress.'>
            <CraftQueuePanel biomeId='forest' />
          </Card>
        </div>
      )
    default: {
      const _exhaustive: never = props.id
      return _exhaustive
    }
  }
}

export function GameShell() {
  const [active, setActive] = useState<PanelId>('world')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startUiTransition] = useTransition()

  const nav: readonly NavItem[] = useMemo(
    () => [
      { id: 'world', label: 'World', description: 'Map, events, systems', icon: IconMap },
      { id: 'players', label: 'Players', description: 'Roster and party', icon: IconUsers },
      { id: 'inventory', label: 'Inventory', description: 'Items and gear', icon: IconBackpack },
      { id: 'crafting', label: 'Crafting', description: 'Recipes and queue', icon: IconHammer }
    ],
    []
  )

  function selectPanel(id: PanelId) {
    withViewTransition(() => {
      startTransition(() => {
        setActive(id)
        setMobileOpen(false)
      })
    })
  }

  function toggleMobile() {
    startUiTransition(() => setMobileOpen((v) => !v))
  }

  return (
    <div className='min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50'>
      <div className='mx-auto flex min-h-dvh w-full md:max-w-7xl lg:max-w-screen'>
        {/* Sidebar (desktop) */}
        <aside className='hidden w-12 border-r border-zinc-700 shrink-0 flex-col lg:flex'>
          <div className={cx(styles.glassCard, 'p-4')}>
            <div className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2 text-xs text-black/55 dark:text-white/55'>
                <IconBolt className={cx('h-4 w-4', isPending ? 'animate-pulse' : '')} />
              </div>
            </div>
          </div>

          <nav className={cx(styles.glassCard)}>
            <ul className='grid'>
              {nav.map((item) => {
                const isActive = item.id === active
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type='button'
                      onClick={() => selectPanel(item.id)}
                      className={cx(
                        'group flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
                        isActive
                          ? 'bg-black/6 text-black dark:bg-white/8 dark:text-white'
                          : 'hover:bg-black/4 dark:hover:bg-white/6'
                      )}>
                      <Icon className='h-5 w-5 opacity-80' />
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <div className='flex min-w-0 flex-1 flex-col'>
          {/* Top bar (mobile + desktop) */}
          <header
            className={cx(styles.glassCard, 'hidden _flex items-center justify-between gap-3 rounded-2xl p-3 sm:p-4')}>
            <div className='flex min-w-0 items-center gap-3'>
              <button
                type='button'
                className='inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-black/3 text-black/80 transition hover:bg-black/6 dark:border-white/10 dark:bg-white/4 dark:text-white/80 dark:hover:bg-white/8 lg:hidden'
                onClick={toggleMobile}
                aria-label='Open menu'>
                <IconMenu className='h-5 w-5' />
              </button>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold tracking-tight'>Dashboard</div>
                <div className='truncate text-xs text-black/55 dark:text-white/55'>
                  {nav.find((n) => n.id === active)?.description ?? ''}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <div className='hidden sm:flex'>
                <StatPill label='Build' value='alpha' />
              </div>
              <div className='flex items-center gap-2 text-xs text-black/55 dark:text-white/55'>
                <IconBolt className={cx('h-4 w-4', isPending ? 'animate-pulse' : '')} />
                <span className='hidden sm:inline'>{isPending ? 'Updating' : 'Idle'}</span>
              </div>
            </div>
          </header>

          {/* Mobile drawer */}
          {mobileOpen ? (
            <div className='fixed inset-0 z-50 lg:hidden'>
              <button
                type='button'
                className='absolute inset-0 bg-black/40'
                aria-label='Close menu overlay'
                onClick={() => setMobileOpen(false)}
              />
              <div className='absolute left-0 top-0 h-full w-[82vw] max-w-sm'>
                <div className={cx(styles.glassCard, 'h-full')}>
                  <div className='px-2 pb-2 pt-1'>
                    <div className='text-sm font-semibold tracking-tight'>Iluvatar</div>
                    <div className='mt-0.5 text-xs text-black/55 dark:text-white/55'>Navigation</div>
                  </div>
                  <nav>
                    <ul className='grid gap-1'>
                      {nav.map((item) => {
                        const isActive = item.id === active
                        const Icon = item.icon
                        return (
                          <li key={item.id}>
                            <button
                              type='button'
                              onClick={() => selectPanel(item.id)}
                              className={cx(
                                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                                isActive
                                  ? 'bg-black/6 text-black dark:bg-white/8 dark:text-white'
                                  : 'hover:bg-black/4 dark:hover:bg-white/6'
                              )}>
                              <Icon className='h-5 w-5 opacity-80' />
                              <div className='min-w-0'>
                                <div className='truncate text-sm font-medium'>{item.label}</div>
                                <div className='truncate text-xs text-black/55 dark:text-white/55'>
                                  {item.description}
                                </div>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          ) : null}

          <main className={cx(styles.panel, 'min-w-0 flex-1')}>
            <Panel id={active} />
          </main>
        </div>
      </div>
    </div>
  )
}
