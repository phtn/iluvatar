'use client'

import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Activity, startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { withViewTransition } from '../viewTransitions'

type WorldSurfaceProps = Readonly<{
  biomeId: string
}>

type MoveKey = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function isMoveKey(code: string): code is MoveKey {
  return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function randomName(): string {
  const a = ['Ash', 'Briar', 'Cinder', 'Dusk', 'Ember', 'Flint', 'Gale', 'Hollow', 'Ivy', 'Jade', 'Kestrel', 'Lumen']
  const b = [
    'Walker',
    'Warden',
    'Seeker',
    'Smith',
    'Ranger',
    'Mason',
    'Nomad',
    'Weaver',
    'Scout',
    'Scribe',
    'Hunter',
    'Druid'
  ]
  const pick = (xs: readonly string[]) => xs[Math.floor(Math.random() * xs.length)] ?? 'Wanderer'
  return `${pick(a)} ${pick(b)}`
}

export function WorldSurface(props: WorldSurfaceProps) {
  const { biomeId } = props
  const auth = useConvexAuth()
  const { signIn } = useAuthActions()
  const [pending, startUiTransition] = useTransition()

  const [name, setName] = useState(() => randomName())
  const [joining, setJoining] = useState(false)
  const [authStarting, setAuthStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastLoot, setLastLoot] = useState<string | null>(null)
  const [harvestingNodeId, setHarvestingNodeId] = useState<Id<'worldLootNodes'> | null>(null)
  const [selectedStationDocId, setSelectedStationDocId] = useState<Id<'worldStations'> | null>(null)
  const [placingWorkbench, setPlacingWorkbench] = useState(false)
  const activeStationStorageKey = 'iluvatar:activeStationId'

  const myPlayer = useQuery(api.players.getMyPlayer, {})
  const players = useQuery(api.players.listPlayersByBiome, auth.isAuthenticated ? { biomeId } : 'skip')
  const lootNodes = useQuery(
    api.world.listLootNodesByBiome,
    auth.isAuthenticated ? { biomeId, includeDepleted: true } : 'skip'
  )
  const worldStations = useQuery(api.stations.listStationsByBiome, auth.isAuthenticated ? { biomeId } : 'skip')
  const myStations = useQuery(api.crafting.listMyStations, auth.isAuthenticated ? {} : 'skip')

  const createPlayer = useMutation(api.players.createPlayer)
  const moveMyPlayer = useMutation(api.players.moveMyPlayer)
  const touchMyPlayer = useMutation(api.players.touchMyPlayer)
  const spawnLootNode = useMutation(api.world.spawnLootNode)
  const harvestLootNode = useMutation(api.world.harvestLootNode)
  const placeMyWorkbench = useMutation(api.stations.placeMyWorkbench)
  const spawnStation = useMutation(api.stations.spawnStation)

  useEffect(() => {
    if (auth.isLoading) return
    if (auth.isAuthenticated) return
    if (authStarting) return

    setAuthStarting(true)
    setError(null)
    setLastLoot(null)
    startUiTransition(() => {
      void signIn('anonymous').catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to sign in')
      })
    })
  }, [auth.isAuthenticated, auth.isLoading, authStarting, signIn, startUiTransition])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    if (!myPlayer) return

    const interval = window.setInterval(() => {
      void touchMyPlayer({}).catch(() => {
        // ignore transient connectivity issues
      })
    }, 20_000)
    return () => window.clearInterval(interval)
  }, [auth.isAuthenticated, myPlayer, touchMyPlayer])

  const stage = useMemo(() => {
    if (auth.isLoading) return 'booting'
    if (!auth.isAuthenticated) return 'signing-in'
    if (joining) return 'joining'
    if (!myPlayer) return 'needs-player'
    return 'in-world'
  }, [auth.isAuthenticated, auth.isLoading, joining, myPlayer])

  async function onJoin() {
    setError(null)
    setLastLoot(null)
    withViewTransition(() => {
      startTransition(() => setJoining(true))
    })
    try {
      await createPlayer({ name: name.trim() || randomName() })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join')
    } finally {
      startTransition(() => setJoining(false))
    }
  }

  const onMove = useCallback(
    async (dx: number, dy: number) => {
      setError(null)
      setLastLoot(null)
      try {
        await moveMyPlayer({ dx, dy })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to move')
      }
    },
    [moveMyPlayer]
  )

  async function onSpawn(
    sourceId: 'fallen_branch' | 'boulder' | 'abandoned_crate' | 'lore_cache' | 'workbench_blueprint_cache'
  ) {
    if (!myPlayer) return
    setError(null)
    setLastLoot(null)

    const jitter = () => Math.floor(-12 + Math.random() * 25)
    const x = clamp(myPlayer.position.x + jitter(), 0, 100)
    const y = clamp(myPlayer.position.y + jitter(), 0, 100)

    try {
      await spawnLootNode({ biomeId, lootSourceId: sourceId, position: { x, y } })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to spawn node')
    }
  }

  async function onHarvest(lootNodeId: Id<'worldLootNodes'>) {
    setError(null)
    setLastLoot(null)
    withViewTransition(() => startTransition(() => setHarvestingNodeId(lootNodeId)))
    try {
      const result = await harvestLootNode({ lootNodeId })
      const lootText = result.grants
        .map((g) => `${g.qty}× ${g.defId.replaceAll('_', ' ')}${g.stage ? ` (${g.stage})` : ''}`)
        .join(', ')
      const unlockedText =
        result.unlocked.length === 0
          ? ''
          : ` • Unlocked: ${result.unlocked.map((u) => u.defId.replaceAll('_', ' ')).join(', ')}`
      setLastLoot((lootText || 'Nothing found.') + unlockedText)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to harvest')
    } finally {
      startTransition(() => setHarvestingNodeId(null))
    }
  }

  const keysDownRef = useRef<Record<MoveKey, boolean>>({
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false
  })
  const moveInFlightRef = useRef(false)

  useEffect(() => {
    if (stage !== 'in-world') return
    if (!myPlayer) return

    const keysDown = keysDownRef.current

    function onKeyChange(e: KeyboardEvent, isDown: boolean) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!isMoveKey(e.code)) return
      if (isTypingTarget(e.target)) return

      // Prevent browser scrolling / focus changes while moving.
      e.preventDefault()

      keysDown[e.code] = isDown
    }

    const onKeyDown = (e: KeyboardEvent) => onKeyChange(e, true)
    const onKeyUp = (e: KeyboardEvent) => onKeyChange(e, false)

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp, { passive: false })

    const step = 1
    const tickMs = 110
    const interval = window.setInterval(() => {
      const dx = (keysDown.KeyD ? step : 0) + (keysDown.KeyA ? -step : 0)
      const dy = (keysDown.KeyS ? step : 0) + (keysDown.KeyW ? -step : 0)
      if (dx === 0 && dy === 0) return
      if (moveInFlightRef.current) return

      moveInFlightRef.current = true
      void onMove(dx, dy).finally(() => {
        moveInFlightRef.current = false
      })
    }, tickMs)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keysDown.KeyW = false
      keysDown.KeyA = false
      keysDown.KeyS = false
      keysDown.KeyD = false
    }
  }, [myPlayer, onMove, stage])

  const onlineCount = players ? players.length : 0
  const meId = myPlayer?._id
  const mapPlayers = players ?? []
  const mapLootNodes = lootNodes ?? []
  const mapStations = useMemo(() => worldStations ?? [], [worldStations])
  const isDev = process.env.NODE_ENV !== 'production'

  const hasWorkbenchUnlocked = useMemo(() => {
    const xs = myStations?.stations ?? []
    return xs.some((s) => s.id === 'basic_workbench' && s.unlocked)
  }, [myStations?.stations])

  const stationLabelById = useMemo(() => {
    const entries = (myStations?.stations ?? []).map((s) => [s.id, s.label] as const)
    return Object.fromEntries(entries) as Record<string, string>
  }, [myStations?.stations])

  const placedWorkbenchCount = useMemo(() => {
    const xs = mapStations
    return xs.filter((s) => s.stationId === 'basic_workbench').length
  }, [mapStations])

  const selectedStation = useMemo(() => {
    if (!selectedStationDocId) return null
    return mapStations.find((s) => s._id === selectedStationDocId) ?? null
  }, [mapStations, selectedStationDocId])

  const selectedStationLabel = useMemo(() => {
    if (!selectedStation) return null
    return stationLabelById[selectedStation.stationId] ?? selectedStation.stationId.replaceAll('_', ' ')
  }, [selectedStation, stationLabelById])

  function setActiveStation(stationId: string) {
    try {
      window.localStorage.setItem(activeStationStorageKey, stationId)
    } catch {
      // ignore localStorage issues
    }
    setLastLoot(`Active station set: ${stationId.replaceAll('_', ' ')}`)
  }

  async function onPlaceWorkbench() {
    setError(null)
    setLastLoot(null)
    withViewTransition(() => startTransition(() => setPlacingWorkbench(true)))
    try {
      await placeMyWorkbench({})
      setLastLoot('Placed: basic workbench')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to place workbench')
    } finally {
      withViewTransition(() => startTransition(() => setPlacingWorkbench(false)))
    }
  }

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-sm font-semibold tracking-tight'>Forest Surface</div>
          <div className='mt-0.5 text-xs text-black/55 dark:text-white/55'>
            {stage === 'in-world' ? 'You are in-world (anonymous session).' : 'Anonymous players can join instantly.'}
          </div>
        </div>
        <div className='flex items-center gap-2 text-xs text-black/60 dark:text-white/60'>
          <span className={cx('inline-block h-2 w-2 rounded-full', pending ? 'bg-amber-500' : 'bg-emerald-500')} />
          <span>{pending ? 'Activity' : 'Live'}</span>
          <span className='mx-1 opacity-40'>•</span>
          <span>
            {onlineCount} online{stage === 'in-world' ? '' : ''}
          </span>
        </div>
      </div>

      {error ? (
        <div className='rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200'>
          {error}
        </div>
      ) : null}

      {/*{lastLoot ? (
        <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100'>
          Loot: {lastLoot}
        </div>
      ) : null}*/}

      {stage === 'booting' || stage === 'signing-in' ? (
        <div className='rounded-2xl border border-black/10 bg-black/3 p-5 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
          Establishing anonymous session…
        </div>
      ) : null}

      {stage === 'needs-player' ? (
        <div className='grid gap-3 rounded-2xl border border-black/10 bg-black/3 p-5 dark:border-white/10 dark:bg-white/4'>
          <div>
            <div className='text-sm font-semibold'>Join the world</div>
            <div className='mt-0.5 text-xs text-black/55 dark:text-white/55'>
              Pick a name (you can change this later when we add accounts).
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Name'
              className='h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-sm text-black shadow-sm outline-none ring-0 transition focus:border-black/20 dark:border-white/10 dark:bg-black dark:text-white dark:focus:border-white/20 sm:flex-1'
            />
            <button
              type='button'
              onClick={() => void onJoin()}
              disabled={pending}
              className='inline-flex h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90'>
              {pending ? 'Joining…' : 'Join'}
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'joining' ? (
        <div className='rounded-2xl border border-black/10 bg-black/3 p-5 text-sm text-black/70 dark:border-white/10 dark:bg-white/4 dark:text-white/70'>
          Entering world…
        </div>
      ) : null}

      {stage === 'in-world' && myPlayer ? (
        <div className='grid gap-4 lg:grid-cols-3'>
          {/* Map */}
          <div className='lg:col-span-2'>
            <div className='rounded-2xl border border-black/10 bg-black/3 p-4 dark:border-white/10 dark:bg-white/4'>
              <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='mt-0.5 text-xs text-black/55 dark:text-white/55'>
                    <span className='font-bold'>{myPlayer.name}</span> • [
                    <span className='text-[7px]'>
                      {myPlayer.position.x}, {myPlayer.position.y}
                    </span>
                    ]
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {isDev ? (
                    <>
                      <button
                        type='button'
                        onClick={() => void onSpawn('fallen_branch')}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn branch
                      </button>
                      <button
                        type='button'
                        onClick={() => void onSpawn('boulder')}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn boulder
                      </button>
                      <button
                        type='button'
                        onClick={() => void onSpawn('abandoned_crate')}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn crate
                      </button>
                      <button
                        type='button'
                        onClick={() => void onSpawn('lore_cache')}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn cache
                      </button>
                      <button
                        type='button'
                        onClick={() => void onSpawn('workbench_blueprint_cache')}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn workbench cache
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          if (!myPlayer) return
                          void spawnStation({
                            biomeId,
                            stationId: 'basic_workbench',
                            position: { x: myPlayer.position.x + 2, y: myPlayer.position.y + 2 }
                          }).catch(() => {})
                        }}
                        className='hidden h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6 sm:inline-flex'>
                        Spawn workbench
                      </button>
                    </>
                  ) : null}
                  {hasWorkbenchUnlocked ? (
                    <button
                      type='button'
                      onClick={() => void onPlaceWorkbench()}
                      disabled={placingWorkbench || pending}
                      className='hidden h-10 items-center justify-center rounded-xl bg-black px-3 text-xs font-medium text-white transition hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90 sm:inline-flex'>
                      {placingWorkbench ? 'Placing…' : 'Place workbench'}
                    </button>
                  ) : null}
                  <div className='hidden'>
                    <button
                      type='button'
                      onClick={() => void onMove(0, -2)}
                      className='h-10 w-10 rounded-xl border border-black/10 bg-white text-sm font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
                      aria-label='Move north'>
                      ↑
                    </button>
                    <button
                      type='button'
                      onClick={() => void onMove(-2, 0)}
                      className='h-10 w-10 rounded-xl border border-black/10 bg-white text-sm font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
                      aria-label='Move west'>
                      ←
                    </button>
                    <button
                      type='button'
                      onClick={() => void onMove(2, 0)}
                      className='h-10 w-10 rounded-xl border border-black/10 bg-white text-sm font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
                      aria-label='Move east'>
                      →
                    </button>
                    <button
                      type='button'
                      onClick={() => void onMove(0, 2)}
                      className='h-10 w-10 rounded-xl border border-black/10 bg-white text-sm font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
                      aria-label='Move south'>
                      ↓
                    </button>
                  </div>
                </div>
              </div>

              <div className='mt-4'>
                <div className='relative h-85 w-full overflow-hidden rounded-xl border border-black/10 bg-linear-to-b from-emerald-200/40 to-emerald-200/10 dark:border-white/10 dark:from-emerald-400/10 dark:to-emerald-400/0'>
                  {/* faint grid */}
                  <div
                    className='absolute inset-0 opacity-40'
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)',
                      backgroundSize: '34px 34px'
                    }}
                  />

                  {mapLootNodes.map((n) => {
                    const x = clamp01(n.position.x / 100)
                    const y = clamp01(n.position.y / 100)
                    const isDepleted = n.depletion.isDepleted
                    const inRange =
                      (myPlayer.position.x - n.position.x) * (myPlayer.position.x - n.position.x) +
                        (myPlayer.position.y - n.position.y) * (myPlayer.position.y - n.position.y) <=
                      12 * 12
                    const isHarvesting = harvestingNodeId === n._id
                    return (
                      <button
                        key={n._id}
                        type='button'
                        onClick={() => void onHarvest(n._id)}
                        disabled={isDepleted || !inRange || isHarvesting}
                        className={cx(
                          'absolute -translate-x-1/2 -translate-y-1/2 rounded-md border shadow-sm transition',
                          isDepleted
                            ? 'h-3 w-3 border-black/20 bg-black/20 opacity-40 dark:border-white/20 dark:bg-white/20'
                            : inRange
                              ? 'h-3.5 w-3.5 border-black/30 bg-amber-200 hover:bg-amber-300 dark:border-white/30 dark:bg-amber-400/40 dark:hover:bg-amber-400/55'
                              : 'h-3 w-3 border-black/20 bg-amber-200/50 opacity-60 dark:border-white/20 dark:bg-amber-400/20',
                          isHarvesting ? 'animate-pulse' : ''
                        )}
                        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                        title={
                          isDepleted
                            ? `Depleted: ${n.lootSourceId}`
                            : inRange
                              ? `Harvest: ${n.lootSourceId}`
                              : `Too far: ${n.lootSourceId}`
                        }
                        aria-label={`Loot node ${n.lootSourceId}`}
                      />
                    )
                  })}

                  {mapStations.map((s) => {
                    const x = clamp01(s.position.x / 100)
                    const y = clamp01(s.position.y / 100)
                    const isWorkbench = s.stationId === 'basic_workbench'
                    const isSelected = selectedStationDocId === s._id
                    return (
                      <button
                        key={s._id}
                        type='button'
                        onClick={() =>
                          withViewTransition(() => startTransition(() => setSelectedStationDocId((v) => (v === s._id ? null : s._id))))
                        }
                        className={cx(
                          'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm transition',
                          isWorkbench
                            ? 'h-3 w-3 border-black/30 bg-sky-200 dark:border-white/30 dark:bg-sky-400/40'
                            : 'h-3 w-3 border-black/30 bg-white dark:border-white/30 dark:bg-black',
                          isSelected ? 'ring-2 ring-sky-400/60 dark:ring-sky-300/60' : ''
                        )}
                        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                        title={s.stationId}
                        aria-label={`Station ${s.stationId}`}
                      />
                    )
                  })}

                  {mapPlayers.map((p) => {
                    const x = clamp01(p.position.x / 100)
                    const y = clamp01(p.position.y / 100)
                    const isMe = p._id === meId
                    return (
                      <div
                        key={p._id}
                        className={cx(
                          'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm',
                          isMe
                            ? 'h-3 w-3 border-white bg-black dark:border-black dark:bg-white'
                            : 'h-2.5 w-2.5 border-black/30 bg-white dark:border-white/30 dark:bg-black'
                        )}
                        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                        title={p.name}
                      />
                    )
                  })}
                </div>
                <div className='h-14 flex items-center'>
                  <Activity mode={lastLoot ? 'visible' : 'hidden'}>
                    <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100'>
                      Loot: {lastLoot}
                    </div>
                  </Activity>
                  <Activity mode={!lastLoot ? 'visible' : 'hidden'}>
                    <div className='mt-3 text-xs text-black/55 dark:text-white/55'>
                      Tip: Click a loot node when you are close to it to harvest (respawns ~60s).
                    </div>
                  </Activity>
                </div>

                <Activity mode={selectedStation ? 'visible' : 'hidden'}>
                  <div className='mt-3 rounded-2xl border border-black/10 bg-black/3 p-4 text-sm text-black/80 dark:border-white/10 dark:bg-white/4 dark:text-white/80'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <div className='text-sm font-semibold'>{selectedStationLabel ?? ''}</div>
                        <div className='mt-0.5 text-xs opacity-70'>
                          ({selectedStation?.position.x ?? 0},{selectedStation?.position.y ?? 0}) • biome {biomeId}
                        </div>
                      </div>
                      <button
                        type='button'
                        onClick={() => withViewTransition(() => startTransition(() => setSelectedStationDocId(null)))}
                        className='inline-flex h-9 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-black transition hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'>
                        Close
                      </button>
                    </div>
                    {selectedStation ? (
                      <div className='mt-3 flex flex-wrap items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => setActiveStation(selectedStation.stationId)}
                          className='inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-medium text-white transition hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90'>
                          Use for crafting
                        </button>
                        <div className='text-xs opacity-70'>
                          Tip: select this station in the Craft tab (auto-selected next time).
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Activity>

                <Activity mode={hasWorkbenchUnlocked && placedWorkbenchCount === 0 ? 'visible' : 'hidden'}>
                  <div className='mt-3 rounded-2xl border border-black/10 bg-black/3 p-4 dark:border-white/10 dark:bg-white/4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <div className='text-sm font-semibold'>Build a Basic Workbench</div>
                        <div className='mt-0.5 text-xs text-black/55 dark:text-white/55'>
                          Place it at your current position.
                        </div>
                      </div>
                      <button
                        type='button'
                        disabled={placingWorkbench || pending}
                        onClick={() => void onPlaceWorkbench()}
                        className='inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-medium text-white transition hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90'>
                        {placingWorkbench ? 'Placing…' : 'Place'}
                      </button>
                    </div>
                    <div className='mt-3 text-xs text-black/55 dark:text-white/55'>
                      Requires: 6× scrap wood, 4× rusted nails
                    </div>
                  </div>
                </Activity>
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className='rounded-2xl border border-black/10 bg-black/3 p-4 dark:border-white/10 dark:bg-white/4'>
            <div className='flex items-center justify-between'>
              <div className='text-sm font-semibold'>Players</div>
              <div className='text-xs text-black/55 dark:text-white/55'>{onlineCount} online</div>
            </div>
            <div className='mt-3 grid gap-2'>
              {mapPlayers.length === 0 ? (
                <div className='rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70 dark:border-white/10 dark:bg-black dark:text-white/70'>
                  No players online.
                </div>
              ) : (
                mapPlayers.map((p) => (
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
                        ({p.position.x},{p.position.y})
                      </div>
                    </div>
                    <div className='text-xs opacity-60'>forest</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
