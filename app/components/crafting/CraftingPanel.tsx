'use client'

import { api } from '@/convex/_generated/api'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Activity, startTransition, useEffect, useMemo, useState, useTransition } from 'react'
import { withViewTransition } from '../viewTransitions'

type CraftingPanelProps = Readonly<{
  biomeId?: string
}>

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function prettyDefId(defId: string): string {
  return defId.replaceAll('_', ' ')
}

export function CraftingPanel(props: CraftingPanelProps) {
  const auth = useConvexAuth()
  const [isPending, startUiTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [submittingRecipeId, setSubmittingRecipeId] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const activeStationStorageKey = 'iluvatar:activeStationId'
  const [didEnsureDefaults, setDidEnsureDefaults] = useState(false)

  const myPlayer = useQuery(api.players.getMyPlayer, {})
  const recipesRes = useQuery(api.crafting.listMyRecipes, auth.isAuthenticated ? {} : 'skip')
  const stationsRes = useQuery(api.crafting.listMyStations, auth.isAuthenticated ? {} : 'skip')
  const queueRes = useQuery(api.crafting.listMyQueue, auth.isAuthenticated ? {} : 'skip')
  const stacks = useQuery(api.inventory.listInventory, auth.isAuthenticated && myPlayer ? { playerId: myPlayer._id } : 'skip')

  const startMyCraft = useMutation(api.crafting.startMyCraft)
  const claimMyCompletedCrafts = useMutation(api.crafting.claimMyCompletedCrafts)
  const ensureDefaults = useMutation(api.crafting.ensureDefaults)

  useEffect(() => {
    if (!auth.isAuthenticated) return
    if (!myPlayer) return

    const interval = window.setInterval(() => {
      void claimMyCompletedCrafts({}).catch(() => {
        // ignore transient connectivity issues
      })
    }, 1500)

    return () => window.clearInterval(interval)
  }, [auth.isAuthenticated, claimMyCompletedCrafts, myPlayer])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    if (!myPlayer) return
    if (didEnsureDefaults) return
    if (!recipesRes) return
    if (recipesRes.recipes.length !== 0) return

    setDidEnsureDefaults(true)
    startUiTransition(() => {
      setError(null)
      setToast('Initializing crafting data…')
    })
    void ensureDefaults({})
      .then(() => {
        startUiTransition(() => setToast('Crafting data initialized.'))
      })
      .catch((e: unknown) => {
        startUiTransition(() => setError(e instanceof Error ? e.message : 'Failed to initialize crafting data'))
      })
  }, [auth.isAuthenticated, didEnsureDefaults, ensureDefaults, myPlayer, recipesRes, startUiTransition])

  const unlockedStations = useMemo(() => {
    const xs = stationsRes?.stations ?? []
    return xs.filter((s) => s.unlocked)
  }, [stationsRes?.stations])

  useEffect(() => {
    if (selectedStationId !== null) return
    const stored = (() => {
      try {
        return window.localStorage.getItem(activeStationStorageKey)
      } catch {
        return null
      }
    })()
    const isStoredUnlocked = stored ? unlockedStations.some((s) => s.id === stored) : false
    const fallback = (isStoredUnlocked ? stored : null) ?? unlockedStations[0]?.id ?? 'campfire'
    setSelectedStationId(fallback)
  }, [selectedStationId, unlockedStations])

  const stationId = selectedStationId ?? 'campfire'
  const stationLabel =
    (stationsRes?.stations ?? []).find((s) => s.id === stationId)?.label ?? stationId.replaceAll('_', ' ')

  const qtyByKey = useMemo(() => {
    const xs = stacks ?? []
    const out: Record<string, number> = {}
    for (const s of xs) out[`${s.kind}:${s.defId}`] = s.qty
    return out
  }, [stacks])

  const tier1Checklist = useMemo(() => {
    if (!myPlayer) return null
    const tier = recipesRes?.player?.craftingTier ?? myPlayer.craftingTier
    if (tier >= 1) return null
    const torchRecipe = recipesRes?.recipes.find((r) => r.id === 'craft_crude_torch') ?? null
    const hasTorchRecipe = torchRecipe?.unlocked ?? false

    const have = (kind: 'material' | 'component' | 'item' | 'currency', defId: string) => qtyByKey[`${kind}:${defId}`] ?? 0
    const needs = (kind: 'material' | 'component' | 'item' | 'currency', defId: string, qty: number) => ({
      kind,
      defId,
      need: qty,
      have: have(kind, defId)
    })

    // This is the current hard-coded Tier 1 milestone in Convex:
    // claim a craft job that outputs crude_torch.
    return {
      tier,
      hasTorchRecipe,
      materials: [
        needs('material', 'fibrous_wood_strips', 2),
        needs('material', 'bark_shavings', 3),
        // optional but commonly needed soon after:
        needs('material', 'resin_node', 1)
      ],
      components: [needs('component', 'fiber_cord', 1), needs('component', 'bark_tinder', 1)],
      torch: needs('item', 'crude_torch', 1)
    }
  }, [myPlayer, qtyByKey, recipesRes])

  const recipesForStation = useMemo(() => {
    if (!recipesRes) return []
    return recipesRes.recipes.filter((r) => r.stationId === stationId)
  }, [recipesRes, stationId])

  function selectStation(nextId: string) {
    withViewTransition(() => {
      startTransition(() => {
        setSelectedStationId(nextId)
        try {
          window.localStorage.setItem(activeStationStorageKey, nextId)
        } catch {
          // ignore localStorage issues
        }
      })
    })
  }

  async function craft(recipeId: string, qty: number) {
    startUiTransition(() => {
      setError(null)
      setToast(null)
    })
    withViewTransition(() => startTransition(() => setSubmittingRecipeId(recipeId)))
    try {
      await startMyCraft({ recipeId, qty })
      startUiTransition(() => setToast(`Queued: ${recipeId.replaceAll('_', ' ')}`))
      void claimMyCompletedCrafts({}).catch(() => {})
    } catch (e: unknown) {
      startUiTransition(() => setError(e instanceof Error ? e.message : 'Failed to craft'))
    } finally {
      withViewTransition(() => startTransition(() => setSubmittingRecipeId(null)))
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
        Sign in to craft.
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
        <div className='text-sm font-semibold'>{isPending ? 'Crafting' : 'Craft'}</div>
        <div className='text-xs text-black/55 dark:text-white/55'>
          Station: <span className='font-medium'>{stationLabel}</span>
          <span className='opacity-60'> • tier {recipesRes?.player?.craftingTier ?? myPlayer.craftingTier}</span>
          {props.biomeId ? <span className='opacity-60'> • {props.biomeId}</span> : null}
        </div>
      </div>

      {stationsRes ? (
        <div className='flex flex-wrap items-center gap-2'>
          {(stationsRes.stations ?? []).map((s) => {
            const isActive = s.id === stationId
            return (
              <button
                key={s.id}
                type='button'
                disabled={!s.unlocked || isPending}
                onClick={() => selectStation(s.id)}
                className={cx(
                  'inline-flex h-8 items-center justify-center rounded-xl border px-3 text-xs font-medium transition',
                  isActive
                    ? 'border-black/15 bg-black/6 text-black dark:border-white/20 dark:bg-white/8 dark:text-white'
                    : 'border-black/10 bg-white text-black hover:bg-black/3 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6',
                  !s.unlocked ? 'opacity-40' : ''
                )}>
                {s.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <div className='rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200'>
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100'>
          {toast}
        </div>
      ) : null}

      <Activity mode={tier1Checklist ? 'visible' : 'hidden'}>
        <div className='rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100'>
          <div className='font-semibold'>Unlock Tier 1</div>
          <div className='mt-1 text-xs opacity-80'>
            Tier 1 is granted when you <span className='font-medium'>craft and claim</span> a <span className='font-medium'>crude torch</span>.
          </div>

          <div className='mt-3 grid gap-2 text-xs'>
            <div>
              <span className='font-medium'>Step 1:</span> Unlock the torch recipe via <span className='font-medium'>Lore Cache</span> (harvest
              <span className='font-mono'> lore_cache</span> in World).{' '}
              <span className='opacity-80'>{tier1Checklist?.hasTorchRecipe ? '(unlocked)' : '(locked)'}</span>
            </div>

            <div className='grid gap-1'>
              <div className='font-medium'>Step 2: Gather & craft prerequisites</div>
              <div className='opacity-80'>Materials:</div>
              <ul className='grid gap-1 pl-4'>
                {tier1Checklist?.materials.map((m) => (
                  <li key={`${m.kind}:${m.defId}`}>
                    {m.have}/{m.need} {prettyDefId(m.defId)}
                  </li>
                )) ?? null}
              </ul>
              <div className='opacity-80'>Components (Campfire recipes):</div>
              <ul className='grid gap-1 pl-4'>
                {tier1Checklist?.components.map((c) => (
                  <li key={`${c.kind}:${c.defId}`}>
                    {c.have}/{c.need} {prettyDefId(c.defId)}
                  </li>
                )) ?? null}
              </ul>
            </div>

            <div>
              <span className='font-medium'>Step 3:</span> Craft <span className='font-medium'>crude torch</span> and then press{' '}
              <span className='font-medium'>Claim</span> in the Queue. (Owning the item isn’t enough; claiming the job is what upgrades you.)
            </div>
          </div>
        </div>
      </Activity>

      {!recipesRes || recipesForStation.length === 0 ? (
        <div className='rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70 dark:border-white/10 dark:bg-black dark:text-white/70'>
          No recipes for this station yet.
        </div>
      ) : (
        <div className='grid gap-2'>
          {recipesForStation.map((r) => {
            const missingText =
              r.missing.length === 0 ? null : r.missing.map((m) => `${m.qty}× ${prettyDefId(m.defId)}`).join(', ')
            const canMax = r.maxQty >= 2
            const canCraft = r.craftable
            const disabled = submittingRecipeId !== null || isPending

            return (
              <div
                key={r.id}
                className={cx(
                  'rounded-xl border px-4 py-3 text-sm',
                  canCraft
                    ? 'border-black/10 bg-white/80 text-black/90 dark:border-white/10 dark:bg-black/70 dark:text-white/90'
                    : 'border-black/10 bg-white/50 text-black/60 dark:border-white/10 dark:bg-black/50 dark:text-white/60'
                )}>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{r.label}</div>
                    <div className='mt-0.5 text-xs opacity-60'>
                      Tier {r.tier} • outputs: {r.outputs.map((o) => `${o.qty}× ${prettyDefId(o.defId)}`).join(', ')}
                    </div>
                    <Activity mode={missingText ? 'visible' : 'hidden'}>
                      <div className='mt-1 text-xs opacity-70'>Missing: {missingText ?? ''}</div>
                    </Activity>
                    <Activity mode={!r.unlocked ? 'visible' : 'hidden'}>
                      <div className='mt-1 text-xs text-amber-800 dark:text-amber-200'>
                        Locked recipe. {r.hint ?? 'Unlock it in the world.'}
                      </div>
                    </Activity>
                    <Activity
                      mode={
                        r.unlocked && (r.lockReason === 'locked_station' || r.lockReason === 'station_not_placed')
                          ? 'visible'
                          : 'hidden'
                      }>
                      <div className='mt-1 text-xs text-amber-800 dark:text-amber-200'>
                        Requires station: {prettyDefId(r.stationId)}.
                      </div>
                    </Activity>
                    <Activity mode={r.unlocked && r.lockReason === 'station_too_far' ? 'visible' : 'hidden'}>
                      <div className='mt-1 text-xs text-amber-800 dark:text-amber-200'>
                        Too far from station: {prettyDefId(r.stationId)}.
                      </div>
                    </Activity>
                    <Activity mode={r.unlocked && r.lockReason === 'locked_tier' ? 'visible' : 'hidden'}>
                      <div className='mt-1 text-xs text-amber-800 dark:text-amber-200'>
                        Requires tier {r.tier}.
                        {r.tier === 1 && (recipesRes?.player?.craftingTier ?? myPlayer.craftingTier) < 1
                          ? ' Reach Tier 1 by crafting + claiming a crude torch (see Unlock Tier 1 above).'
                          : ''}
                      </div>
                    </Activity>
                    <div className='mt-1 text-xs opacity-60'>Max craftable now: {r.maxQty}</div>
                  </div>

                  <div className='flex shrink-0 items-center gap-2'>
                    <button
                      type='button'
                      disabled={!canCraft || disabled}
                      onClick={() => void craft(r.id, 1)}
                      className={cx(
                        'inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-medium transition',
                        canCraft
                          ? 'bg-black text-white hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90'
                          : 'bg-black/20 text-black/50 dark:bg-white/10 dark:text-white/50'
                      )}>
                      {submittingRecipeId === r.id ? 'Crafting…' : 'Craft'}
                    </button>

                    <button
                      type='button'
                      disabled={!canMax || disabled}
                      onClick={() => void craft(r.id, r.maxQty)}
                      className={cx(
                        'inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-medium transition',
                        canMax
                          ? 'border-black/10 bg-white text-black hover:bg-black/3 disabled:opacity-60 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/6'
                          : 'border-black/10 bg-white/40 text-black/50 dark:border-white/10 dark:bg-black/40 dark:text-white/50'
                      )}>
                      Max
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className='text-xs text-black/55 dark:text-white/55'>
        Queue: {queueRes?.jobs?.filter((j) => j.status === 'inProgress').length ?? 0} active
      </div>
    </div>
  )
}
