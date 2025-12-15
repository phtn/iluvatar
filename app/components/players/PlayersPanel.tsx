'use client'

import { api } from '@/convex/_generated/api'
import { useConvexAuth, useQuery } from 'convex/react'
import { useMemo } from 'react'

type PlayersPanelProps = Readonly<{
  biomeId: string
}>

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function PlayersPanel(props: PlayersPanelProps) {
  const auth = useConvexAuth()
  const myPlayer = useQuery(api.players.getMyPlayer, {})

  const players = useQuery(api.players.listPlayersByBiome, auth.isAuthenticated ? { biomeId: props.biomeId } : 'skip')

  const meId = myPlayer?._id

  const sorted = useMemo(() => {
    const xs = players ?? []
    return [...xs].sort((a, b) => {
      const aIsMe = a._id === meId
      const bIsMe = b._id === meId
      if (aIsMe !== bIsMe) return aIsMe ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [meId, players])

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
        Sign in to see players.
      </div>
    )
  }

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-sm font-semibold'>Online in {props.biomeId}</div>
        <div className='text-xs text-black/55 dark:text-white/55'>{sorted.length} online</div>
      </div>

      {sorted.length === 0 ? (
        <div className='rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70 dark:border-white/10 dark:bg-black dark:text-white/70'>
          No players online.
        </div>
      ) : (
        <div className='grid gap-2'>
          {sorted.map((p) => (
            <div
              key={p._id}
              className={cx(
                'flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
                p._id === meId
                  ? 'border-black/15 bg-white text-black dark:border-white/20 dark:bg-black dark:text-white'
                  : 'border-black/10 bg-white/70 text-black/80 dark:border-white/10 dark:bg-black/60 dark:text-white/80'
              )}>
              <div className='min-w-0'>
                <div className='truncate font-medium'>
                  {p.name} {p._id === meId ? <span className='opacity-60'>(you)</span> : null}
                </div>
                <div className='truncate text-xs opacity-60'>
                  ({p.position.x}, {p.position.y})
                </div>
              </div>
              <div className='text-xs opacity-60'>{p.biomeId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
