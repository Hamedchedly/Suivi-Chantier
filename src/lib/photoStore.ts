// ────────────────────────────────────────────────────────────────────────────
// Visit photo store (IndexedDB).
//
// Photos are far too large for localStorage, so they live in IndexedDB. Each
// record keeps the ORIGINAL (downscaled) image plus, optionally, a baked
// annotated copy and its annotation shapes — the original is never overwritten.
// This module is the only place that talks to IndexedDB; the UI calls its
// async helpers. Supabase mapping (future): a `visit_photos` table + storage
// bucket for the binaries.
// ────────────────────────────────────────────────────────────────────────────

import type { Annotation } from './annotations'

export interface VisitPhoto {
  id: string
  visitId: string
  zoneRefId: string
  zoneLabel: string
  lotId?: string
  reserveId?: string
  caption?: string
  original: string       // dataURL, downscaled (~1600px)
  annotated?: string     // dataURL, baked original + shapes
  annotations: Annotation[]
  includeInCr: boolean
  order: number
  createdAt: string      // ISO
}

const DB_NAME = 'suivi-chantier'
const STORE = 'visit-photos'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('visitId', 'visitId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE))
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** All photos of a visit, ordered by `order` then creation time. */
export async function listPhotos(visitId: string): Promise<VisitPhoto[]> {
  const store = await tx('readonly')
  const index = store.index('visitId')
  const all = await reqToPromise(index.getAll(visitId)) as VisitPhoto[]
  return all.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export async function savePhoto(photo: VisitPhoto): Promise<void> {
  const store = await tx('readwrite')
  await reqToPromise(store.put(photo))
}

export async function deletePhoto(id: string): Promise<void> {
  const store = await tx('readwrite')
  await reqToPromise(store.delete(id))
}

/** Downscale an image file to a bounded JPEG data URL (keeps the "original"). */
export function fileToDataUrl(file: File, max = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
