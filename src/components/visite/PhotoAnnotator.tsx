import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ArrowUpRight, Circle, Square, Pencil, Type, Hash, Undo2, Trash2, Check, X } from 'lucide-react'
import {
  Annotation, AnnotationTool, ANNOTATION_COLORS, Point,
  nextMarkerNumber, undoLast, clamp01, toPixels,
} from '../../lib/annotations'

interface Props {
  src: string                 // original image dataURL (never mutated)
  initial: Annotation[]
  onSave: (annotations: Annotation[], annotatedDataUrl: string) => void
  onClose: () => void
}

const TOOLS: { id: AnnotationTool; label: string; icon: React.ReactNode }[] = [
  { id: 'arrow', label: 'Flèche', icon: <ArrowUpRight size={16} /> },
  { id: 'circle', label: 'Cercle', icon: <Circle size={16} /> },
  { id: 'rect', label: 'Rectangle', icon: <Square size={16} /> },
  { id: 'freehand', label: 'Dessin', icon: <Pencil size={16} /> },
  { id: 'text', label: 'Texte', icon: <Type size={16} /> },
  { id: 'marker', label: 'Repère', icon: <Hash size={16} /> },
]

/** Draw one shape onto a 2D context sized (w × h) in pixels. */
function drawShape(ctx: CanvasRenderingContext2D, a: Annotation, w: number, h: number) {
  const p = toPixels(a, w, h)
  const lw = Math.max(2, Math.round(w / 250))
  ctx.lineWidth = lw
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (a.type === 'arrow' && p.x2 !== undefined && p.y2 !== undefined) {
    ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke()
    const ang = Math.atan2(p.y2 - p.y1, p.x2 - p.x1)
    const head = Math.max(10, lw * 4)
    ctx.beginPath()
    ctx.moveTo(p.x2, p.y2)
    ctx.lineTo(p.x2 - head * Math.cos(ang - Math.PI / 6), p.y2 - head * Math.sin(ang - Math.PI / 6))
    ctx.moveTo(p.x2, p.y2)
    ctx.lineTo(p.x2 - head * Math.cos(ang + Math.PI / 6), p.y2 - head * Math.sin(ang + Math.PI / 6))
    ctx.stroke()
  } else if (a.type === 'circle' && p.x2 !== undefined && p.y2 !== undefined) {
    const cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(p.x2 - p.x1) / 2, Math.abs(p.y2 - p.y1) / 2, 0, 0, Math.PI * 2); ctx.stroke()
  } else if (a.type === 'rect' && p.x2 !== undefined && p.y2 !== undefined) {
    ctx.strokeRect(Math.min(p.x1, p.x2), Math.min(p.y1, p.y2), Math.abs(p.x2 - p.x1), Math.abs(p.y2 - p.y1))
  } else if (a.type === 'freehand' && p.points && p.points.length > 1) {
    ctx.beginPath(); ctx.moveTo(p.points[0].x, p.points[0].y)
    for (const pt of p.points.slice(1)) ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
  } else if (a.type === 'text' && a.text) {
    const fs = Math.max(14, Math.round(w / 28))
    ctx.font = `700 ${fs}px system-ui, sans-serif`
    ctx.textBaseline = 'top'
    // legibility halo
    ctx.lineWidth = Math.max(2, fs / 6); ctx.strokeStyle = 'rgba(0,0,0,.55)'
    ctx.strokeText(a.text, p.x1, p.y1); ctx.fillText(a.text, p.x1, p.y1)
  } else if (a.type === 'marker' && a.n !== undefined) {
    const r = Math.max(12, Math.round(w / 30))
    ctx.beginPath(); ctx.arc(p.x1, p.y1, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(a.n), p.x1, p.y1)
    ctx.textAlign = 'start'
  }
}

export function PhotoAnnotator({ src, initial, onSave, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>(initial)
  const [tool, setTool] = useState<AnnotationTool>('arrow')
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0])
  const drawing = useRef<Annotation | null>(null)

  const redraw = () => {
    const canvas = canvasRef.current, img = imgRef.current
    if (!canvas || !img) return
    const w = img.clientWidth, h = img.clientHeight
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    for (const a of annotations) drawShape(ctx, a, w, h)
    if (drawing.current) drawShape(ctx, drawing.current, w, h)
  }

  useEffect(redraw, [annotations])
  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations])

  const norm = (e: RPointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) }
  }

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pt = norm(e)
    if (tool === 'text') {
      const text = window.prompt('Texte de l’annotation :')?.trim()
      if (text) setAnnotations(prev => [...prev, { id: `an${Date.now()}`, type: 'text', color, x1: pt.x, y1: pt.y, text }])
      return
    }
    if (tool === 'marker') {
      setAnnotations(prev => [...prev, { id: `an${Date.now()}`, type: 'marker', color, x1: pt.x, y1: pt.y, n: nextMarkerNumber(prev) }])
      return
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = tool === 'freehand'
      ? { id: `an${Date.now()}`, type: 'freehand', color, x1: pt.x, y1: pt.y, points: [pt] }
      : { id: `an${Date.now()}`, type: tool, color, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }
    redraw()
  }

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const pt = norm(e)
    if (drawing.current.type === 'freehand') drawing.current.points!.push(pt)
    else { drawing.current.x2 = pt.x; drawing.current.y2 = pt.y }
    redraw()
  }

  const onUp = () => {
    if (!drawing.current) return
    const shape = drawing.current
    drawing.current = null
    // ignore accidental zero-size drags
    const tiny = shape.type !== 'freehand' && Math.abs((shape.x2 ?? 0) - shape.x1) < 0.005 && Math.abs((shape.y2 ?? 0) - shape.y1) < 0.005
    if (tiny) { redraw(); return }
    setAnnotations(prev => [...prev, shape])
  }

  /** Bake original + shapes at natural resolution → annotated dataURL. */
  const bake = (): string => {
    const img = imgRef.current!
    const w = img.naturalWidth, h = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    for (const a of annotations) drawShape(ctx, a, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  return (
    <div style={overlay}>
      <div style={bar}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
              style={toolBtn(tool === t.id)}>{t.icon}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {ANNOTATION_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} title={c}
              style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,.4)', cursor: 'pointer', boxShadow: color === c ? '0 0 0 2px #02457A' : 'none' }} />
          ))}
        </div>
      </div>

      <div style={stage}>
        <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
          <img ref={imgRef} src={src} alt="annotation" onLoad={redraw} style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', userSelect: 'none' }} draggable={false} />
          <canvas ref={canvasRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }} />
        </div>
      </div>

      <div style={bar}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setAnnotations(prev => undoLast(prev))} disabled={annotations.length === 0} style={actionBtn}><Undo2 size={15} /> Annuler</button>
          <button onClick={() => setAnnotations([])} disabled={annotations.length === 0} style={actionBtn}><Trash2 size={15} /> Effacer</button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onClose} style={actionBtn}><X size={15} /> Fermer</button>
          <button onClick={() => onSave(annotations, annotations.length ? bake() : src)} style={{ ...actionBtn, background: 'var(--ok)', color: '#fff', border: 'none' }}><Check size={15} /> Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,10,20,.92)', display: 'flex', flexDirection: 'column' }
const bar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', background: '#0b1a2b', flexWrap: 'wrap' }
const stage: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', overflow: 'hidden' }
const toolBtn = (on: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: on ? '2px solid #018ABE' : '1px solid rgba(255,255,255,.25)', background: on ? '#02457A' : 'transparent', color: '#fff', cursor: 'pointer' })
const actionBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
