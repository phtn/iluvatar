'use client'

import { api } from '@/convex/_generated/api'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { withViewTransition } from '../viewTransitions'

type CraftQueuePanelProps = Readonly<{
  biomeId?: string
}>

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function prettyDefId(defId: string): string {
  return defId.replaceAll('_', ' ')
}

function msLeft(now: number, endTime: number): number {
  return Math.max(0, endTime - now)
}

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

export function CraftQueuePanel(props: CraftQueuePanelProps) {
  const auth = useConvexAuth()
  const [now, setNow] = useState(() => Date.now())
  const [claiming, setClaiming] = useState(false)

  const myPlayer = useQuery(api.players.getMyPlayer, {})
  const queueRes = useQuery(api.crafting.listMyQueue, auth.isAuthenticated ? {} : 'skip')

  const claimMyCompletedCrafts = useMutation(api.crafting.claimMyCompletedCrafts)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 400)
    return () => window.clearInterval(t)
  }, [])

  const active = useMemo(() => {
    const jobs = queueRes?.jobs ?? []
    return jobs.filter((j) => j.status === 'inProgress')
  }, [queueRes?.jobs])

  async function claim() {
    withViewTransition(() => startTransition(() => setClaiming(true)))
    try {
      await claimMyCompletedCrafts({})
    } finally {
      withViewTransition(() => startTransition(() => setClaiming(false)))
    }
  }

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
        Sign in to view your craft queue.
      </div>
    )
  }

  if (!myPlayer) {
    return (
      <div className='rounded-xl border border-black/10 bg-black/3 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
        Join the world to start crafting.
      </div>
    )
  }

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-sm font-semibold'>Queue</div>
        <div className='text-xs text-black/55 dark:text-white/55'>
          {active.length} active
          {props.biomeId ? <span className='opacity-60'> • {props.biomeId}</span> : null}
        </div>
      </div>

      <div className='flex items-center justify-between gap-2'>
        <div className='text-xs text-black/55 dark:text-white/55'>Claim finishes to receive outputs.</div>
        <button
          type='button'
          onClick={() => void claim()}
          disabled={claiming}
          className={cx(
            'inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-medium transition',
            'border-black/10 bg-white text-black hover:bg-black/3 disabled:opacity-60 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
          )}>
          {claiming ? 'Claiming…' : 'Claim'}
        </button>
      </div>

      {active.length === 0 ? (
        <div className='rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70 dark:border-white/10 dark:bg-black dark:text-white/70'>
          Queue empty.
        </div>
      ) : (
        <div className='grid gap-2'>
          {active.map((j) => {
            const left = formatMs(msLeft(now, j.endTime))
            return (
              <div
                key={j._id}
                className='rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-black/90 dark:border-white/10 dark:bg-black/70 dark:text-white/90'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{j.recipeId.replaceAll('_', ' ')}</div>
                    <div className='mt-0.5 text-xs opacity-60'>
                      Ends in {left} • outputs: {j.outputs.map((o) => `${o.qty}× ${prettyDefId(o.defId)}`).join(', ')}
                    </div>
                  </div>
                  <div className='text-xs opacity-60'>x{j.qty}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
