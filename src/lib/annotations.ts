// ────────────────────────────────────────────────────────────────────────────
// Photo annotation model (pure).
//
// Annotations are stored as resolution-independent shapes: every coordinate is
// normalized to 0..1 relative to the image, so the same annotation renders
// correctly at thumbnail size, on the editor canvas, and at full resolution when
// baking the annotated copy. The ORIGINAL image is never mutated — the annotated
// version is a separate rendered copy.
// ────────────────────────────────────────────────────────────────────────────

export type AnnotationTool = 'arrow' | 'circle' | 'rect' | 'freehand' | 'text' | 'marker'

export interface Point { x: number; y: number }  // normalized 0..1

export interface Annotation {
  id: string
  type: AnnotationTool
  color: string
  x1: number
  y1: number
  x2?: number          // arrow/circle/rect end point
  y2?: number
  points?: Point[]     // freehand path
  text?: string        // text tool
  n?: number           // marker number
}

export const ANNOTATION_COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#111827', '#ffffff'] as const

/** Next sequential number for a numbered marker. */
export function nextMarkerNumber(annotations: Annotation[]): number {
  return annotations.reduce((m, a) => a.type === 'marker' && typeof a.n === 'number' ? Math.max(m, a.n) : m, 0) + 1
}

/** Remove the last annotation (undo). Returns a new array. */
export function undoLast(annotations: Annotation[]): Annotation[] {
  return annotations.slice(0, -1)
}

/** Clamp a normalized coordinate into [0, 1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Denormalize a shape's coordinates to pixel space for a given size. */
export function toPixels(a: Annotation, w: number, h: number) {
  return {
    x1: a.x1 * w, y1: a.y1 * h,
    x2: a.x2 === undefined ? undefined : a.x2 * w,
    y2: a.y2 === undefined ? undefined : a.y2 * h,
    points: a.points?.map(p => ({ x: p.x * w, y: p.y * h })),
  }
}

export function summarizeAnnotations(annotations: Annotation[]): string {
  if (annotations.length === 0) return 'aucune annotation'
  const n = annotations.length
  return `${n} annotation${n > 1 ? 's' : ''}`
}
