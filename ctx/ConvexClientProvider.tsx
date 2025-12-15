'use client'

import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { ReactNode, useState } from 'react'

type RequiredPublicEnvName = 'NEXT_PUBLIC_CONVEX_URL'

function getRequiredPublicEnv(name: RequiredPublicEnvName): string {
  // IMPORTANT: Next.js only inlines NEXT_PUBLIC_* vars for static access like:
  // process.env.NEXT_PUBLIC_CONVEX_URL
  // Dynamic access (process.env[name]) is not reliably available in the browser bundle.
  const value = (() => {
    switch (name) {
      case 'NEXT_PUBLIC_CONVEX_URL':
        return process.env.NEXT_PUBLIC_CONVEX_URL
      default: {
        const _exhaustive: never = name
        return _exhaustive
      }
    }
  })()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function ConvexClientProvider(props: { children: ReactNode }) {
  const { children } = props
  const [client] = useState(() => {
    const url = getRequiredPublicEnv('NEXT_PUBLIC_CONVEX_URL')
    return new ConvexReactClient(url)
  })

  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
}
