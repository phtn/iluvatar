export type ViewTransitionLike = Readonly<{
  finished: Promise<void>
}>

type DocumentWithViewTransition = Document &
  Readonly<{
    startViewTransition?: (callback: () => void) => ViewTransitionLike
  }>

export function withViewTransition(callback: () => void): void {
  const doc = document as DocumentWithViewTransition
  const start = doc.startViewTransition
  if (typeof start !== 'function') {
    callback()
    return
  }

  try {
    const transition = start(callback)
    // Avoid unhandled promise rejections on browsers that implement
    // the API but fail during commit.
    void transition.finished.catch(() => {})
  } catch {
    callback()
  }
}


