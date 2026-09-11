// ────────────────────────────────────────────────────────────────────────────
// Android / browser Back button.
//
// The app has no router, so Back would otherwise close the PWA outright and
// lose the tour in progress. One listener lives in App; the active page
// registers what "going back" means for it, and the app only lets the browser
// leave once there is nothing left to step back through.
//
// Nothing here touches saved data: every screen persists as you type, so
// stepping back never discards an entry — it just shows the previous screen.
// ────────────────────────────────────────────────────────────────────────────

/** Returns true when the page consumed the Back press itself. */
export type BackHandler = () => boolean

let current: BackHandler | null = null

export function setBackHandler(handler: BackHandler | null): void {
  current = handler
}

export function runBackHandler(): boolean {
  return current ? current() : false
}
