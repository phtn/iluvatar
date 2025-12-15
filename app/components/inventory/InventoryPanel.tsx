'use client'

import { api } from '@/convex/_generated/api'
import { useConvexAuth, useQuery } from 'convex/react'
import { useMemo } from 'react'

type InventoryPanelProps = Readonly<{
  biomeId?: string
}>

const GRID_COLS = 8
const GRID_ROWS = 10
const GRID_SLOTS = GRID_COLS * GRID_ROWS

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function InventoryPanel(props: InventoryPanelProps) {
  const auth = useConvexAuth()
  const myPlayer = useQuery(api.players.getMyPlayer, {})

  const stacks = useQuery(
    api.inventory.listInventory,
    auth.isAuthenticated && myPlayer ? { playerId: myPlayer._id } : 'skip'
  )

  const sorted = useMemo(() => {
    const xs = stacks ?? []
    return [...xs].sort((a, b) => b.qty - a.qty)
  }, [stacks])

  if (auth.isLoading) {
    return (
      <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
        Loading session…
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
        Sign in to view inventory.
      </div>
    )
  }

  if (!myPlayer) {
    return (
      <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
        Join the world to start collecting items.
      </div>
    )
  }

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-sm font-semibold'>Inventory</div>
        <div className='text-xs text-black/55 dark:text-white/55'>
          <span className='font-medium'>{myPlayer.name}</span>
          {props.biomeId ? <span className='opacity-60'> • {props.biomeId}</span> : null}
        </div>
      </div>

      <div
        className={cx('grid gap-2')}
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`
        }}
        aria-label={`Inventory grid ${GRID_COLS} by ${GRID_ROWS}`}>
        {Array.from({ length: GRID_SLOTS }, (_, i) => {
          const stack = sorted[i]
          const isFilled = stack !== undefined

          if (!isFilled) {
            return (
              <div
                key={`empty-${i}`}
                className={cx(
                  'aspect-square rounded-xl border',
                  'border-black/10 bg-white/40 dark:border-white/10 dark:bg-black/40'
                )}
                aria-label='Empty slot'
              />
            )
          }

          const label = stack.defId.replaceAll('_', ' ')
          // const sub = `${stack.kind}${stack.stage ? `• ${stack.stage}` : ''}`
          const sub = `${stack.kind}`

          return (
            <div
              key={stack._id}
              className={cx(
                'flex flex-col justify-between relative aspect-square overflow-hidden rounded-xl border p-1',
                'border-black/10 bg-white/80 text-black/90 dark:border-white/10 dark:bg-black/70 dark:text-white/90'
              )}
              title={`${label}\n${sub}\nqty: ${stack.qty}`}
              aria-label={`${label}, ${sub}, qty ${stack.qty}`}>
              <div className='line-clamp-2 text-[10px] font-medium leading-tight'>{label}</div>
              <div className='mt-1 truncate text-[6px] opacity-60'>{sub}</div>
              <div className='absolute bottom-0 right-0 rounded-md bg-black/75 flex items-center justify-center size-4 text-[8px] aspect-square font-semibold tabular-nums text-white dark:bg-white/80 dark:text-black'>
                {stack.qty}
              </div>
            </div>
          )
        })}
      </div>

      <div className='text-xs text-black/55 dark:text-white/55'>
        Slots: {Math.min(sorted.length, GRID_SLOTS)}/{GRID_SLOTS}
        {sorted.length > GRID_SLOTS ? (
          <span className='ml-1 text-amber-700 dark:text-amber-200'>(overflow hidden)</span>
        ) : null}
      </div>
    </div>
  )
}
