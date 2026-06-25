'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Crown, Eye, Save, Shirt, Star, Sparkles, Trophy } from 'lucide-react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Teacher {
  teacher_code: string
  full_name: string
  center: string
  total_score: number
  avatar_url: string | null
}
interface TopTeachersResponse { success: boolean; data: Teacher[] }

interface Rect { x: number; y: number; w: number; h: number }

// ─── Utils ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => r.json())

const MOCK_TOP_TEACHERS: Teacher[] = [
  {
    teacher_code: 'mock-rank-1',
    full_name: 'MindX',
    center: 'MindX Nguyễn Trãi',
    total_score: 9.86,
    avatar_url: null,
  },
  {
    teacher_code: 'mock-rank-2',
    full_name: 'MindX',
    center: 'MindX Online',
    total_score: 9.72,
    avatar_url: null,
  },
  {
    teacher_code: 'mock-rank-3',
    full_name: 'MindX',
    center: 'MindX Phạm Ngũ Lão',
    total_score: 9.58,
    avatar_url: null,
  },
]

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

function fittedFontSize(length: number, minPx: number, maxPx: number, vwFactor: number) {
  const safeLength = Math.max(length, 10)
  const preferredVw = Math.max(minPx / 3.9, vwFactor / safeLength)
  return `clamp(${minPx}px, ${preferredVw.toFixed(3)}vw, ${maxPx}px)`
}

function shouldReduceVisualEffects() {
  if (typeof window === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  const cores = navigator.hardwareConcurrency || 8
  return (
    window.matchMedia('(max-width: 767px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches ||
    connection?.saveData === true ||
    cores <= 4
  )
}

// ─── Easing ──────────────────────────────────────────────────────────────────

const E = {
  outExpo: (t: number) => t >= 1 ? 1 : 1 - 2 ** (-10 * t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuart: (t: number) => 1 - (1 - t) ** 4,
  inQuart: (t: number) => t ** 4,
  inOutCubic: (t: number) => t < .5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2,
  outElastic: (t: number) => {
    if (t <= 0) return 0; if (t >= 1) return 1
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  },
}

// ─── Canvas Genie Painter ─────────────────────────────────────────────────────

function paintGenie(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
  topT: number, botT: number,
  alpha: number,
  isClosing = false,
) {
  const lerpX = (a: number, b: number, t: number) => a + (b - a) * t
  const lerpY = (a: number, b: number, t: number) => a + (b - a) * t

  const stl = { x: sx - sw / 2, y: sy - sh / 2 }
  const str = { x: sx + sw / 2, y: sy - sh / 2 }
  const sbl = { x: sx - sw / 2, y: sy + sh / 2 }
  const sbr = { x: sx + sw / 2, y: sy + sh / 2 }

  const ttl = { x: tx, y: ty }
  const ttr = { x: tx + tw, y: ty }
  const tbl = { x: tx, y: ty + th }
  const tbr = { x: tx + tw, y: ty + th }

  const TL = { x: lerpX(stl.x, ttl.x, topT), y: lerpY(stl.y, ttl.y, topT) }
  const TR = { x: lerpX(str.x, ttr.x, topT), y: lerpY(str.y, ttr.y, topT) }
  const BL = { x: lerpX(sbl.x, tbl.x, botT), y: lerpY(sbl.y, tbl.y, botT) }
  const BR = { x: lerpX(sbr.x, tbr.x, botT), y: lerpY(sbr.y, tbr.y, botT) }

  const pinchFactor = Math.abs(topT - botT)
  const pinchPx = pinchFactor * Math.min(tw, th) * 0.55 * Math.sin(Math.PI * Math.min(topT, botT + 0.1))

  const lcpT = { x: TL.x + pinchPx, y: TL.y + (BL.y - TL.y) * 0.35 }
  const lcpB = { x: BL.x + pinchPx, y: TL.y + (BL.y - TL.y) * 0.65 }
  const rcpT = { x: TR.x - pinchPx, y: TR.y + (BR.y - TR.y) * 0.35 }
  const rcpB = { x: BR.x - pinchPx, y: TR.y + (BR.y - TR.y) * 0.65 }

  // Build a vertical gradient matching the champagne/ivory popup background
  const minY = Math.min(TL.y, TR.y)
  const maxY = Math.max(BL.y, BR.y)
  const grad = ctx.createLinearGradient(0, minY, 0, maxY)
  if (isClosing) {
    // Closing: champagne top → warm ivory bottom
    grad.addColorStop(0, `rgba(244, 236, 221, ${alpha * 0.92})`)
    grad.addColorStop(0.4, `rgba(255, 249, 237, ${alpha * 0.82})`)
    grad.addColorStop(1, `rgba(255, 249, 237, ${alpha * 0.55})`)
  } else {
    // Opening: ivory top flowing into popup background
    grad.addColorStop(0, `rgba(255, 249, 237, ${alpha * 0.65})`)
    grad.addColorStop(0.5, `rgba(244, 236, 221, ${alpha * 0.88})`)
    grad.addColorStop(1, `rgba(244, 236, 221, ${alpha * 0.95})`)
  }

  ctx.beginPath()
  ctx.moveTo(TL.x, TL.y)
  ctx.lineTo(TR.x, TR.y)
  ctx.bezierCurveTo(rcpT.x, rcpT.y, rcpB.x, rcpB.y, BR.x, BR.y)
  ctx.lineTo(BL.x, BL.y)
  ctx.bezierCurveTo(lcpB.x, lcpB.y, lcpT.x, lcpT.y, TL.x, TL.y)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Subtle gold shimmer edge
  ctx.strokeStyle = `rgba(212, 180, 106, ${alpha * 0.45})`
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// ─── Particle system ─────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; opacity: number; decay: number; color: string
}

function spawnParticles(cx: number, cy: number, count: number): Particle[] {
  // Champagne & gold particle palette
  const colors = ['#d4b46a', '#e8c97a', '#f4ecd5', '#ffffff', '#c9a84c', '#ffe8a0', '#f5d78e']
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 4
    return {
      x: cx + (Math.random() - .5) * 40,
      y: cy + (Math.random() - .5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 2 + Math.random() * 4,
      opacity: 0.8 + Math.random() * 0.2,
      decay: 0.012 + Math.random() * 0.018,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  })
}

const CONFETTI_COLORS = ['#d4b46a', '#e8c97a', '#c9a84c', '#f5d78e', '#ffe8a0', '#ffffff', '#f4ecd5', '#f0d89a']
const CSS_CONFETTI = Array.from({ length: 50 }, (_, index) => ({
  left: (index * 37 + 11) % 100,
  size: 4 + ((index * 7) % 6),
  duration: 5.8 + ((index * 13) % 28) / 10,
  delay: -((index * 17) % 82) / 10,
  drift: ((index * 29) % 100) - 50,
  rotation: 240 + ((index * 47) % 540),
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  shape: index % 5 === 0 ? 'star' : index % 3 === 0 ? 'diamond' : 'ribbon',
}))

function ConfettiRain({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="honors-confetti absolute inset-0 z-10 overflow-hidden pointer-events-none" aria-hidden>
      {CSS_CONFETTI.map((particle, index) => (
        <i
          key={index}
          className={`honors-confetti-piece is-${particle.shape}`}
          style={{
            '--confetti-left': `${particle.left}%`,
            '--confetti-size': `${particle.size}px`,
            '--confetti-duration': `${particle.duration}s`,
            '--confetti-delay': `${particle.delay}s`,
            '--confetti-drift': `${particle.drift}px`,
            '--confetti-rotation': `${particle.rotation}deg`,
            '--confetti-color': particle.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

// ─── 3D Tilt Card ─────────────────────────────────────────────────────────────

interface PodiumCardProps {
  teacher: { teacher_code: string; full_name: string; center: string; total_score: number; avatar_url: string | null; rank: number }
  idx: number
  animCls: string
  triggerAnimate: boolean
}

const PodiumCard = memo(function PodiumCard({ teacher, idx, animCls, triggerAnimate }: PodiumCardProps) {
  const cardEl = useRef<HTMLDivElement>(null)
  const glowEl = useRef<HTMLDivElement>(null)
  const rafTilt = useRef<number | null>(null)
  const targetTilt = useRef({ x: 0, y: 0 })
  const currentTilt = useRef({ x: 0, y: 0 })
  const scoreEl = useRef<HTMLSpanElement>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const allowInteractiveEffects = useRef(true)

  const isFirst = idx === 1

  useEffect(() => {
    setAvatarFailed(false)
  }, [teacher.avatar_url])

  useEffect(() => {
    allowInteractiveEffects.current = !shouldReduceVisualEffects()
  }, [])

  useEffect(() => {
    if (!triggerAnimate) {
      if (scoreEl.current) scoreEl.current.textContent = '0.00%'
      return
    }
    let startTimestamp: number | null = null
    const duration = 1200
    const target = teacher.total_score
    let rafId: number
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      if (scoreEl.current) scoreEl.current.textContent = `${(easeProgress * target).toFixed(2)}%`
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [triggerAnimate, teacher.total_score])

  const configs = useMemo(() => ([
    { // Hạng II
      bg: 'radial-gradient(circle at 18% 9%, rgba(255,255,255,0.74) 0%, rgba(255,255,255,0.28) 24%, transparent 44%), radial-gradient(circle at 86% 78%, rgba(185,232,244,0.38) 0%, transparent 46%), linear-gradient(145deg, rgba(238,251,255,0.42), rgba(255,255,255,0.16) 42%, rgba(205,236,248,0.28) 100%)',
      border: 'border',
      borderColor: 'rgba(226,250,255,0.9)',
      avatarBorderColor: '#ffffff',
      ringCls: '',
      badgeBg: 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(248,250,252,0.42))',
      badgeBorder: '1px solid rgba(255, 255, 255, 0.62)',
      badgeTextColor: '#b91c1c',
      scoreBg: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.42) 24%, transparent 46%), radial-gradient(circle at 88% 72%, rgba(185,232,244,0.48) 0%, transparent 44%), linear-gradient(135deg, rgba(237,250,255,0.46), rgba(255,255,255,0.22) 48%, rgba(198,234,246,0.36))',
      scoreBorder: '1px solid rgba(221, 247, 255, 0.92)',
      scoreTextColor: '#dc2626',
      textColor: '#dc2626',
      subTextColor: '#4b5563',
      sloganColor: '#ef4444',
      shadow: '0 36px 72px -30px rgba(14, 45, 60, 0.46), 0 18px 34px -24px rgba(69, 10, 10, 0.42), inset 0 1px 0 rgba(255,255,255,0.88), inset 0 -1px 2px rgba(74,144,172,0.22)',
      glow: 'radial-gradient(circle at 12% 8%, rgba(255,255,255,0.34), transparent 20%), radial-gradient(circle at 90% 16%, rgba(185,232,244,0.24), transparent 21%), linear-gradient(140deg, rgba(255,255,255,0.1), transparent 42%, rgba(185,232,244,0.1) 80%, transparent)',
      tiltGlow: 'rgba(226,250,255,0.3)',
      avatarGlow: 'linear-gradient(180deg, transparent 0%, transparent 56%, rgba(15,23,42,0.16) 100%)',
      avatarGlowSoft: 'transparent',
      starColor: '#cbd5e1',
      starFill: '#f8fafc',
      captionBg: 'linear-gradient(180deg, rgba(245,252,255,0.68), rgba(255,255,255,0.42))',
      captionBorder: 'rgba(226,250,255,0.66)',
      accentLine: 'linear-gradient(90deg, transparent, rgba(221,247,255,0.95), transparent)',
      veilBg: 'linear-gradient(180deg, transparent 0%, transparent 62%, rgba(15,23,42,0.18) 100%)',
      sheenBg: 'linear-gradient(115deg, transparent 16%, rgba(255,255,255,0.18) 32%, rgba(255,255,255,0.04) 44%, transparent 58%)',
      shimmerBg: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent)',
      rim: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(226,250,255,0.34) 28%, rgba(115,205,232,0.38) 62%, rgba(255,255,255,0.84))',
      liquidTint: 'rgba(185, 232, 244, 0.24)',
      halo: 'radial-gradient(circle at 50% 25%, rgba(226, 250, 255, 0.34), transparent 58%)',
    },
    { // Hạng I
      bg: 'radial-gradient(circle at 18% 9%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.32) 24%, transparent 44%), radial-gradient(circle at 88% 76%, rgba(255,214,94,0.26) 0%, transparent 42%), radial-gradient(circle at 86% 80%, rgba(185,232,244,0.42) 0%, transparent 48%), linear-gradient(145deg, rgba(238,251,255,0.48), rgba(255,255,255,0.18) 42%, rgba(204,239,249,0.34) 100%)',
      border: 'border',
      borderColor: 'rgba(226,250,255,0.96)',
      avatarBorderColor: '#ffffff',
      ringCls: '',
      badgeBg: 'linear-gradient(135deg, rgba(255,255,255,0.76), rgba(255,247,218,0.5))',
      badgeBorder: '1px solid rgba(255, 247, 208, 0.78)',
      badgeTextColor: '#b91c1c',
      scoreBg: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.46) 24%, transparent 46%), radial-gradient(circle at 88% 72%, rgba(187,235,246,0.52) 0%, transparent 44%), linear-gradient(135deg, rgba(238,251,255,0.5), rgba(255,255,255,0.24) 48%, rgba(204,239,249,0.4))',
      scoreBorder: '1px solid rgba(226, 250, 255, 0.96)',
      scoreTextColor: '#dc2626',
      textColor: '#dc2626',
      subTextColor: '#374151',
      sloganColor: '#ef4444',
      shadow: '0 44px 92px -34px rgba(14, 45, 60, 0.5), 0 24px 50px -30px rgba(245, 158, 11, 0.42), inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -1px 2px rgba(74,144,172,0.24)',
      glow: 'radial-gradient(circle at 14% 8%, rgba(255,255,255,0.36), transparent 21%), radial-gradient(circle at 86% 14%, rgba(255,239,184,0.22), transparent 20%), linear-gradient(140deg, rgba(255,255,255,0.12), transparent 40%, rgba(185,232,244,0.12) 80%, transparent)',
      tiltGlow: 'rgba(226,250,255,0.34)',
      avatarGlow: 'linear-gradient(180deg, transparent 0%, transparent 58%, rgba(69,10,10,0.18) 100%)',
      avatarGlowSoft: 'transparent',
      starColor: '#fbbf24',
      starFill: '#fbbf24',
      captionBg: 'linear-gradient(180deg, rgba(245,252,255,0.72), rgba(255,255,255,0.46))',
      captionBorder: 'rgba(226,250,255,0.72)',
      accentLine: 'linear-gradient(90deg, transparent, rgba(226,250,255,0.98), transparent)',
      veilBg: 'linear-gradient(180deg, transparent 0%, transparent 60%, rgba(69,10,10,0.18) 100%)',
      sheenBg: 'linear-gradient(115deg, transparent 14%, rgba(255,255,255,0.2) 32%, rgba(255,236,170,0.06) 46%, transparent 60%)',
      shimmerBg: 'linear-gradient(90deg, transparent, rgba(255,236,172,0.78), transparent)',
      rim: 'linear-gradient(135deg, rgba(255,255,255,1), rgba(226,250,255,0.38) 28%, rgba(115,205,232,0.42) 58%, rgba(255,244,197,0.42) 76%, rgba(255,255,255,0.88))',
      liquidTint: 'rgba(185, 232, 244, 0.28)',
      halo: 'radial-gradient(circle at 50% 25%, rgba(226, 250, 255, 0.42), transparent 58%)',
    },
    { // Hạng III
      bg: 'radial-gradient(circle at 18% 9%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.28) 24%, transparent 44%), radial-gradient(circle at 86% 78%, rgba(185,232,244,0.34) 0%, transparent 46%), linear-gradient(145deg, rgba(238,251,255,0.4), rgba(255,255,255,0.16) 42%, rgba(205,236,248,0.28) 100%)',
      border: 'border',
      borderColor: 'rgba(226,250,255,0.88)',
      avatarBorderColor: '#ffffff',
      ringCls: '',
      badgeBg: 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,243,232,0.46))',
      badgeBorder: '1px solid rgba(255, 241, 230, 0.68)',
      badgeTextColor: '#b91c1c',
      scoreBg: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.42) 24%, transparent 46%), radial-gradient(circle at 88% 72%, rgba(185,232,244,0.46) 0%, transparent 44%), linear-gradient(135deg, rgba(237,250,255,0.46), rgba(255,255,255,0.22) 48%, rgba(198,234,246,0.36))',
      scoreBorder: '1px solid rgba(221, 247, 255, 0.92)',
      scoreTextColor: '#dc2626',
      textColor: '#dc2626',
      subTextColor: '#4b5563',
      sloganColor: '#ef4444',
      shadow: '0 36px 72px -30px rgba(14, 45, 60, 0.44), 0 18px 34px -24px rgba(124, 45, 18, 0.38), inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -1px 2px rgba(74,144,172,0.2)',
      glow: 'radial-gradient(circle at 14% 8%, rgba(255,255,255,0.3), transparent 20%), radial-gradient(circle at 88% 14%, rgba(185,232,244,0.2), transparent 18%), linear-gradient(140deg, rgba(255,255,255,0.1), transparent 42%, rgba(185,232,244,0.1) 80%, transparent)',
      tiltGlow: 'rgba(226,250,255,0.28)',
      avatarGlow: 'linear-gradient(180deg, transparent 0%, transparent 60%, rgba(69,10,10,0.16) 100%)',
      avatarGlowSoft: 'transparent',
      starColor: '#fb923c',
      starFill: '#fb923c',
      captionBg: 'linear-gradient(180deg, rgba(245,252,255,0.68), rgba(255,255,255,0.42))',
      captionBorder: 'rgba(226,250,255,0.64)',
      accentLine: 'linear-gradient(90deg, transparent, rgba(221,247,255,0.92), transparent)',
      veilBg: 'linear-gradient(180deg, transparent 0%, transparent 62%, rgba(69,10,10,0.16) 100%)',
      sheenBg: 'linear-gradient(115deg, transparent 16%, rgba(255,255,255,0.18) 32%, rgba(255,214,165,0.05) 46%, transparent 60%)',
      shimmerBg: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
      rim: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(226,250,255,0.32) 28%, rgba(115,205,232,0.34) 62%, rgba(255,255,255,0.82))',
      liquidTint: 'rgba(185, 232, 244, 0.22)',
      halo: 'radial-gradient(circle at 50% 25%, rgba(226, 250, 255, 0.3), transparent 58%)',
    },
  ]), [])
  const cfg = configs[idx]
  const nameFontSize = fittedFontSize(teacher.full_name.length, isFirst ? 11 : 9, isFirst ? 16 : 13, isFirst ? 60 : 45)
  const centerFontSize = fittedFontSize(teacher.center.length, isFirst ? 8.5 : 7.5, isFirst ? 12 : 10.5, isFirst ? 55 : 42)

  const animateTilt = useCallback(function animateTiltFrame() {
    currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * 0.12
    currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * 0.12
    const { x, y } = currentTilt.current
    if (cardEl.current) {
      const scale = window.innerWidth < 768 ? 1 : 1.04
      cardEl.current.style.transform = `perspective(900px) rotateX(${x}deg) rotateY(${y}deg) scale3d(${scale},${scale},${scale})`
    }
    if (glowEl.current) {
      const gx = 50 + y * 3; const gy = 50 - x * 3
      glowEl.current.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.6) 0%, ${cfg.tiltGlow} 36%, transparent 70%), ${cfg.glow}`
    }
    if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) rafTilt.current = requestAnimationFrame(animateTiltFrame)
    else rafTilt.current = null
  }, [cfg.glow, cfg.tiltGlow])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!allowInteractiveEffects.current) return
    const el = cardEl.current; if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    targetTilt.current = { x: -ny * 14, y: nx * 14 }
    if (!rafTilt.current) rafTilt.current = requestAnimationFrame(animateTilt)
  }, [animateTilt])

  const onMouseLeave = useCallback(() => {
    targetTilt.current = { x: 0, y: 0 }
    if (!rafTilt.current) rafTilt.current = requestAnimationFrame(animateTilt)
    if (cardEl.current) cardEl.current.style.transition = 'transform 0.6s cubic-bezier(0.34,1.2,0.64,1)'
    setTimeout(() => { if (cardEl.current) cardEl.current.style.transition = '' }, 600)
  }, [animateTilt])

  useEffect(() => () => { if (rafTilt.current) cancelAnimationFrame(rafTilt.current) }, [])

  return (
    <div
      className={cn('podium-card-wrap relative flex-shrink cursor-pointer flex flex-col', `card-podium-${idx === 1 ? 1 : idx === 0 ? 2 : 3}`, animCls, isFirst ? 'z-10' : 'z-0')}
      style={{ perspective: '900px', transform: 'translateZ(0)' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {isFirst && (
        <div className="absolute -inset-x-6 -top-6 bottom-8 -z-10 rounded-full opacity-70 blur-2xl"
          style={{ background: cfg.halo }} />
      )}

      {/* Rank label above card */}
      <div className={cn("podium-rank-label relative flex items-center justify-center gap-1.5 mb-1.5 sm:mb-2", isFirst ? "scale-105" : "")}>
        {idx === 1 && <Trophy className={cn("text-yellow-300 fill-yellow-300 drop-shadow-[0_2px_8px_rgba(250,204,21,0.65)]", isFirst ? "w-4 h-4 sm:w-5 sm:h-5" : "w-3 h-3")} />}
        {idx === 0 && <Crown className={cn("text-slate-100 fill-slate-100 drop-shadow-[0_2px_8px_rgba(226,232,240,0.45)]", "w-3.5 h-3.5 sm:w-4 sm:h-4")} />}
        {idx === 2 && <Star className={cn("text-orange-300 fill-orange-300 drop-shadow-[0_2px_8px_rgba(251,146,60,0.5)]", "w-3.5 h-3.5 sm:w-4 sm:h-4")} />}
        <span className={cn(
          "font-black uppercase",
          isFirst ? "text-[12px] sm:text-[15px] text-yellow-200 tracking-[0.18em]" : "text-[10px] sm:text-[12px] text-white/82 tracking-[0.16em]"
        )} style={{ textShadow: isFirst ? '0 0 14px rgba(251,191,36,0.68), 0 2px 6px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.38)' }}>
          Hạng {teacher.rank === 1 ? 'I' : teacher.rank === 2 ? 'II' : 'III'}
        </span>
      </div>

      <div
        ref={cardEl}
        className={cn('podium-card-shell relative w-full flex flex-col rounded-[24px] sm:rounded-[30px] overflow-hidden flex-1', cfg.border)}
        style={{
          background: cfg.bg,
          boxShadow: cfg.shadow,
          willChange: 'transform',
          borderColor: cfg.borderColor,
          isolation: 'isolate',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          height: '100%',
          backdropFilter: 'blur(30px) saturate(2) contrast(1.06)',
          WebkitBackdropFilter: 'blur(30px) saturate(2) contrast(1.06)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none z-[1] rounded-[inherit] p-px" style={{ background: cfg.rim }}>
          <div className="h-full w-full rounded-[inherit]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.04))' }} />
        </div>
        <div className="absolute left-[8%] right-[8%] top-[-8%] h-[20%] pointer-events-none z-[2] rounded-[50%] blur-[10px] opacity-40"
          style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.34), ${cfg.liquidTint} 42%, transparent 74%)`, animation: 'liquid-breathe 5.8s ease-in-out infinite' }} />
        <div className="absolute left-1/2 top-[38%] h-[52%] w-[92%] -translate-x-1/2 pointer-events-none z-[2] rounded-[50%] blur-[18px] mix-blend-screen"
          style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.22), rgba(251,146,60,0.34), rgba(255,255,255,0.14), rgba(125,211,252,0.18))', animation: 'apple-card-flow 8s ease-in-out infinite' }} />
        <div className="absolute -left-[16%] top-[8%] h-[34%] w-[48%] pointer-events-none z-[2] rounded-[48%] blur-[8px] opacity-32 mix-blend-screen"
          style={{ background: 'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.36) 34%, rgba(185,232,244,0.08) 50%, transparent 70%)', animation: 'liquid-caustic 7.2s ease-in-out infinite' }} />

        {/* Liquid glass overlay layers */}
        <div ref={glowEl} className="absolute inset-0 pointer-events-none transition-none z-10" style={{ background: cfg.glow, borderRadius: 'inherit' }} />
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[inherit]">
          <div className="absolute -inset-full top-0 left-0 w-1/2 h-full skew-x-[-25deg] animate-[shimmer-sweep_6s_infinite_linear]" style={{ backgroundImage: cfg.shimmerBg, opacity: 0.14 }} />
        </div>
        <div className="absolute inset-x-3 top-2 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-x-8 top-4 h-[10%] rounded-full bg-white/30 blur-[10px] z-20 pointer-events-none" />
        <div className="absolute inset-y-4 left-2 w-px bg-gradient-to-b from-transparent via-white/60 to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-y-5 right-2 w-px bg-gradient-to-b from-transparent via-white/36 to-transparent z-20 pointer-events-none" />

        {/* Avatar area — fills top portion */}
        <div className="podium-avatar relative z-30 mx-2 mt-2 mb-0 flex-1 rounded-[20px] sm:rounded-[24px]"
          style={{
            minHeight: 0,
            transform: 'translateZ(46px)',
            animation: 'raised-media-float 5.6s ease-in-out infinite',
          }}>
          <div className="absolute -inset-2 rounded-[24px] sm:rounded-[28px] bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.55),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.36),rgba(226,250,255,0.14))] blur-[6px] opacity-70 pointer-events-none" />
          <div className="absolute -inset-1 rounded-[22px] sm:rounded-[26px] pointer-events-none"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(226,250,255,0.22) 36%, rgba(14,45,60,0.18) 100%)',
              boxShadow: '0 26px 38px -24px rgba(14,45,60,0.62), 0 18px 28px -22px rgba(69,10,10,0.58)',
            }} />
          <div className="absolute -bottom-3 left-[12%] right-[12%] h-7 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(69,10,10,0.42),transparent_70%)] blur-lg pointer-events-none" />
          <div className="relative h-full w-full overflow-hidden rounded-[20px] sm:rounded-[24px]"
            style={{
              boxShadow: '0 18px 30px -20px rgba(14,45,60,0.72), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(14,45,60,0.18)',
              border: '1px solid rgba(255,255,255,0.78)',
            }}>
          {/* Avatar image */}
          <div className="w-full h-full relative">
            {teacher.avatar_url && !avatarFailed
              ? <img src={teacher.avatar_url} alt={teacher.full_name} decoding="async" onError={() => setAvatarFailed(true)} className="block w-full h-full object-cover object-top" style={{ filter: 'contrast(1.06) saturate(1.06)', transform: 'translateZ(0)' }} />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: cfg.badgeBg }}>
                  <span className={cn('font-black text-gray-400', isFirst ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl')}>{initials(teacher.full_name)}</span>
                </div>
            }
          </div>

          {/* Score badge — overlaid bottom-center of image */}
          <div className={cn(
            "podium-score absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full font-black tracking-[0.06em] flex items-center gap-1.5 px-4 py-1.5 backdrop-blur-2xl overflow-hidden",
            isFirst ? "text-[12px] sm:text-[14px]" : "text-[10px] sm:text-[12px]"
          )}
            style={{
              background: cfg.scoreBg,
              color: cfg.scoreTextColor,
              border: cfg.scoreBorder,
              animation: 'glass-score-pop 3.6s ease-in-out infinite',
              backdropFilter: 'blur(28px) saturate(2.05) contrast(1.08)',
              WebkitBackdropFilter: 'blur(28px) saturate(2.05) contrast(1.08)',
            }}>
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-100/34 via-white/18 to-cyan-100/34" />
            <span className="absolute inset-[1px] rounded-full border border-white/68 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(74,144,172,0.22)]" />
            <span className="absolute inset-x-3 top-1 h-[44%] rounded-full bg-white/74 blur-[3px]" />
            <span className="absolute left-1/2 top-1/2 h-[150%] w-[76%] rounded-full bg-[linear-gradient(90deg,rgba(239,68,68,0.42),rgba(251,146,60,0.58),rgba(255,255,255,0.18))]" style={{ animation: 'liquid-hot-flow 4.8s ease-in-out infinite' }} />
            <span className="absolute -left-6 top-1/2 h-[145%] w-[58%] -translate-y-1/2 rounded-full bg-white/42 blur-[7px] mix-blend-screen" style={{ animation: 'liquid-score-flow 4.2s ease-in-out infinite' }} />
            <span className="absolute -right-4 bottom-[-35%] h-[90%] w-[46%] rounded-full bg-cyan-100/36 blur-[8px]" />
            <span className="absolute inset-x-2 bottom-1 h-px bg-gradient-to-r from-transparent via-cyan-50/80 to-transparent" />
            <Trophy className={cn("relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4", "text-yellow-500 fill-yellow-500 drop-shadow-[0_1px_4px_rgba(245,158,11,0.45)]")} />
            <span ref={scoreEl} className="relative z-10 leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">
              0.00%
            </span>
          </div>
          </div>
        </div>

        {/* Caption — white bottom section */}
        <div className="podium-caption relative z-40 mx-3 mb-3 mt-2 rounded-[18px] sm:rounded-[22px] px-2 sm:px-3 py-3 sm:py-4 flex flex-col items-center justify-center gap-1.5 overflow-hidden"
          style={{
            background: cfg.captionBg,
            border: `1px solid ${cfg.captionBorder}`,
            backdropFilter: 'blur(18px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
            boxShadow: '0 22px 34px -24px rgba(14,45,60,0.52), 0 12px 22px -18px rgba(69,10,10,0.34), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(14,45,60,0.12)',
            transform: 'translateZ(58px) translateY(-1px)',
          }}>
          <div className="absolute -bottom-4 left-[10%] right-[10%] h-6 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(69,10,10,0.28),transparent_72%)] blur-md pointer-events-none" style={{ animation: 'raised-info-glow 4.8s ease-in-out infinite' }} />
          <div className="absolute inset-x-4 top-1 h-[32%] rounded-full bg-white/46 blur-[8px]" />
          <div className="absolute top-0 left-8 right-8 h-px" style={{ background: cfg.accentLine }} />
          <h4 className="podium-teacher-name relative w-full font-black leading-tight tracking-tight text-center"
            style={{
              color: cfg.textColor,
              fontSize: nameFontSize,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
            {teacher.full_name}
          </h4>
          <div className="podium-center-badge relative inline-flex max-w-full items-center justify-center px-3 py-1 rounded-full border border-gray-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl overflow-hidden"
            style={{
              border: cfg.badgeBorder,
              background: cfg.badgeBg,
            }}>
            <span className="absolute inset-x-2 top-0 h-1/2 rounded-full bg-white/42 blur-[3px]" />
            <p className="podium-center-name font-bold text-center leading-snug"
              style={{
                color: cfg.subTextColor,
                fontSize: centerFontSize,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
              title={teacher.center}>
              {teacher.center}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

// ─── Popup UI Shell ──────────────────────────────────────────────────────────

interface PopupUIProps {
  cardRef: React.RefObject<HTMLDivElement | null>
  showCard: boolean
  contentPhase: number
  podium: { teacher_code: string; full_name: string; center: string; total_score: number; avatar_url: string | null; rank: number }[]
  onClose: () => void
  activeConfetti: boolean
  performanceMode: boolean
}

type PopupPanel = 'honors' | 'feature'
const POPUP_PANELS: PopupPanel[] = ['honors', 'feature']

function MascotFeaturePanel({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="mascot-feature-panel mx-auto flex max-w-[720px] flex-col justify-center py-2">
      <div
        className="relative overflow-hidden rounded-[1.5rem] border border-red-100 bg-white/95 p-4 text-slate-900 shadow-[0_24px_70px_rgba(127,29,29,0.24)] sm:p-6"
        style={{
          background: 'radial-gradient(circle at 12% 10%, rgba(254,226,226,0.98), transparent 34%), radial-gradient(circle at 88% 12%, rgba(220,252,231,0.92), transparent 30%), linear-gradient(135deg, #fffaf7 0%, #ffffff 46%, #fff1f2 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-8 -top-8 text-[7rem] font-black leading-none text-red-900/[0.04] sm:text-[9rem]">2026</div>
          <div className="absolute bottom-3 left-4 text-[4rem] leading-none text-yellow-500/10 sm:text-[5rem]">🏆</div>
          <div className="absolute inset-x-0 top-0 flex h-1.5">
            <span className="flex-1 bg-[#006847]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#ce1126]" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
            <Sparkles className="h-4 w-4" />
            Tính năng mới
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_210px] md:items-center">
            <div>
              <h2 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">Thay đổi trang phục cho mascot bé Mai</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                Bé Mai đã có tủ đồ World Cup: chọn outfit theo đội tuyển yêu thích, xem animation ngay trong modal và lưu để mascot ngoài màn hình dùng bộ trang phục mới.
              </p>
            </div>

            <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-yellow-300/30 blur-2xl" />
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-yellow-200 bg-white shadow-[0_18px_45px_rgba(251,191,36,0.22)]">
                <Trophy className="h-16 w-16 text-yellow-300 drop-shadow-[0_8px_22px_rgba(250,204,21,0.45)]" strokeWidth={2.2} />
                <span className="absolute -bottom-2 rounded-full bg-red-600 px-3 py-1 text-[11px] font-black text-white shadow">WC 2026</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1.5 sm:hidden">
            {[
              { icon: Shirt, shortTitle: 'Chọn áo', title: 'Chọn áo đội tuyển', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, shortTitle: 'Preview', title: 'Xem preview trước', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, shortTitle: 'Lưu ngay', title: 'Lưu và dùng ngay', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, shortTitle, title, color, bg, border }) => (
              <div
                key={title}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full border ${border} ${bg} px-2 py-2 shadow-sm`}
                aria-label={title}
                title={title}
              >
                <Icon className={`h-4 w-4 shrink-0 ${color}`} strokeWidth={2.5} />
                <span className="min-w-0 truncate text-[11px] font-black leading-none text-slate-900">{shortTitle}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 hidden gap-3 sm:grid sm:grid-cols-3">
            {[
              { icon: Shirt, title: 'Chọn áo đội tuyển', body: 'Bấm vào bé Mai ở góc phải để mở tủ đồ và chọn bộ theo quốc gia bạn thích.', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, title: 'Xem preview trước', body: 'Animation chạy ngay trong modal để bạn biết bộ nào hợp nhất trước khi lưu.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, title: 'Lưu và dùng ngay', body: 'Sau khi lưu, mascot ngoài màn hình tự đổi sang outfit mới.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, title, body, color, bg, border }) => (
              <div key={title} className={`rounded-2xl border ${border} ${bg} p-3 shadow-sm`}>
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white ${color} shadow-sm`}>
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <p className="text-sm font-black text-slate-900">{title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_34px_rgba(220,38,38,0.28)] transition hover:-translate-y-0.5 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <Sparkles className="h-4 w-4" />
              Khám phá
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PopupUI({ cardRef, showCard, contentPhase, podium, onClose, activeConfetti, performanceMode }: PopupUIProps) {
  const [activePanel, setActivePanel] = useState<PopupPanel>('honors')
  const [panelDirection, setPanelDirection] = useState<'next' | 'prev'>('next')

  useEffect(() => {
    if (!showCard || contentPhase < 3) {
      setPanelDirection('prev')
      setActivePanel('honors')
      return
    }
    let timer: number | undefined
    const scheduleNextPanel = () => {
      if (timer) window.clearTimeout(timer)
      if (document.hidden) return
      timer = window.setTimeout(() => {
        const nextPanel = activePanel === 'honors' ? 'feature' : 'honors'
        setPanelDirection(nextPanel === 'feature' ? 'next' : 'prev')
        setActivePanel(nextPanel)
      }, 5000)
    }
    scheduleNextPanel()
    document.addEventListener('visibilitychange', scheduleNextPanel)
    return () => {
      if (timer) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', scheduleNextPanel)
    }
  }, [showCard, contentPhase, activePanel])

  const handleExploreMascotOutfits = useCallback(() => {
    onClose()
    window.setTimeout(() => {
      window.dispatchEvent(new Event('start-mascot-outfit-tour'))
    }, 260)
  }, [onClose])

  const switchPanel = useCallback((panel: PopupPanel) => {
    if (activePanel === panel) return
    setPanelDirection(POPUP_PANELS.indexOf(panel) > POPUP_PANELS.indexOf(activePanel) ? 'next' : 'prev')
    setActivePanel(panel)
  }, [activePanel])

  const togglePanel = useCallback(() => {
    switchPanel(activePanel === 'honors' ? 'feature' : 'honors')
  }, [activePanel, switchPanel])

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center p-2 sm:p-4 pointer-events-none select-none">
      <style>{`
        @keyframes honors-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -12dvh, 0) rotate(0deg);
          }
          8% { opacity: 0.95; }
          82% { opacity: 0.9; }
          100% {
            opacity: 0;
            transform: translate3d(var(--confetti-drift), 112dvh, 0) rotate(var(--confetti-rotation));
          }
        }
        @keyframes shimmer-sweep { 0% { transform:translateX(-120%) skewX(-18deg); } 100% { transform:translateX(320%) skewX(-18deg); } }
        @keyframes ring-expand { 0% { transform:scale(0.2); opacity:1; } 100% { transform:scale(3.2); opacity:0; } }
        @keyframes crown-bob { 0%,100% { transform:translateY(0) rotate(-4deg) scale(1); } 50% { transform:translateY(-6px) rotate(4deg) scale(1.05); } }
        @keyframes card-slide-left { from { opacity:0; transform:translateX(-20px) rotate(-4deg) scale(0.95); } to { opacity:1; transform:translateX(0) rotate(-2.5deg) scale(1); } }
        @keyframes card-slide-center { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes card-slide-right { from { opacity:0; transform:translateX(20px) rotate(4deg) scale(0.95); } to { opacity:1; transform:translateX(0) rotate(2.5deg) scale(1); } }
        @keyframes title-reveal { from { opacity:0; transform:translateY(16px); filter:blur(4px); } to { opacity:1; transform:translateY(0); filter:blur(0); } }
        @keyframes sparkle-pop { 0% { transform:translate(-50%,-50%) scale(0) rotate(0deg); opacity:1; } 50% { transform:translate(-50%,-80%) scale(1.4) rotate(180deg); opacity:0.9; } 100% { transform:translate(-50%,-120%) scale(0) rotate(360deg); opacity:0; } }
        @keyframes light-sweep { 0% { transform: translateX(-26%) rotate(-16deg); opacity: 0.05; } 45% { opacity: 0.18; } 100% { transform: translateX(26%) rotate(-16deg); opacity: 0.05; } }
        @keyframes ribbon-flow { 0%,100% { transform: translate3d(-2%,0,0) rotate(-5deg); } 50% { transform: translate3d(2%,-3%,0) rotate(-3deg); } }
        @keyframes velvet-wave-drift { 0%,100% { transform: translate3d(-3%,0,0) rotate(-5deg) scale(1.02); } 50% { transform: translate3d(3%,-3%,0) rotate(-3deg) scale(1.08); } }
        @keyframes velvet-wave-drift-reverse { 0%,100% { transform: translate3d(3%,0,0) rotate(5deg) scale(1.04); } 50% { transform: translate3d(-3%,3%,0) rotate(2deg) scale(1.1); } }
        @keyframes wine-wave-pulse { 0%,100% { opacity: 0.42; filter: blur(0px); } 50% { opacity: 0.68; filter: blur(0.4px); } }
        @keyframes fabric-light-sweep { 0%,100% { transform: translate3d(-7%, -2%, 0) rotate(-6deg) scaleX(1); opacity: 0.28; } 50% { transform: translate3d(7%, 2%, 0) rotate(-3deg) scaleX(1.08); opacity: 0.52; } }
        @keyframes fabric-shadow-breathe { 0%,100% { opacity: 0.48; transform: scale(1) rotate(-4deg); } 50% { opacity: 0.72; transform: scale(1.04) rotate(-2deg); } }
        @keyframes stage-wave-cross-a { 0%,100% { transform: translate3d(-1%,0,0) rotate(-8deg) scale(1.02); } 50% { transform: translate3d(1.5%,-1%,0) rotate(-5deg) scale(1.04); } }
        @keyframes stage-wave-cross-b { 0%,100% { transform: translate3d(1%,0,0) rotate(7deg) scale(1.03); } 50% { transform: translate3d(-1.5%,1%,0) rotate(4deg) scale(1.05); } }
        @keyframes stage-wave-cross-c { 0%,100% { transform: translate3d(-1%,0.5%,0) rotate(-4deg) scale(1.02); } 50% { transform: translate3d(1%,-0.5%,0) rotate(-2deg) scale(1.035); } }
        @keyframes stage-wave-glow { 0%,100% { opacity: 0.24; transform: translate3d(-2%,0,0) rotate(5deg); } 50% { opacity: 0.42; transform: translate3d(2%,-1%,0) rotate(2deg); } }
        @keyframes raised-media-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.006); } }
        @keyframes raised-info-glow { 0%,100% { opacity: 0.45; transform: scaleX(0.96); } 50% { opacity: 0.7; transform: scaleX(1.04); } }
        @keyframes foil-shine { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes title-glow { 0%,100% { text-shadow: 0 2px 10px rgba(69,10,10,0.36), 0 0 18px rgba(255,214,120,0.16); } 50% { text-shadow: 0 2px 12px rgba(69,10,10,0.44), 0 0 28px rgba(255,214,120,0.32); } }
        @keyframes liquid-caustic { 0%,100% { transform: translate3d(-4%, -2%, 0) rotate(-8deg) scale(1); opacity: 0.42; } 50% { transform: translate3d(5%, 3%, 0) rotate(-4deg) scale(1.08); opacity: 0.68; } }
        @keyframes liquid-breathe { 0%,100% { transform: scale(1); opacity: 0.58; } 50% { transform: scale(1.035); opacity: 0.82; } }
        @keyframes glass-score-pop { 0%,100% { box-shadow: 0 14px 28px rgba(69,10,10,0.22), 0 0 0 1px rgba(255,255,255,0.42) inset, inset 0 1px 0 rgba(255,255,255,0.98), inset 0 -12px 22px rgba(255,255,255,0.2); } 50% { box-shadow: 0 18px 38px rgba(69,10,10,0.3), 0 0 0 1px rgba(255,255,255,0.58) inset, inset 0 1px 0 rgba(255,255,255,1), inset 0 -14px 26px rgba(255,244,200,0.34); } }
        @keyframes liquid-score-flow { 0%,100% { transform: translateX(-18%) rotate(-8deg) scaleX(0.92); opacity: 0.35; } 45% { opacity: 0.78; } 50% { transform: translateX(18%) rotate(-5deg) scaleX(1.08); } }
        @keyframes liquid-hot-flow { 0%,100% { transform: translateX(-22%) translateY(-50%) rotate(-12deg) scaleX(0.9); filter: blur(7px); } 50% { transform: translateX(18%) translateY(-50%) rotate(-7deg) scaleX(1.16); filter: blur(9px); } }
        @keyframes apple-card-flow { 0%,100% { transform: translate3d(-18%,-6%,0) rotate(-12deg) scaleX(0.92); opacity: 0.28; } 45% { opacity: 0.52; } 50% { transform: translate3d(18%,4%,0) rotate(-7deg) scaleX(1.12); } }
        @keyframes ripple-out { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.7; } 100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; } }
        @keyframes ripple-out-2 { 0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0.5; } 100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; } }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.12); } }
        @keyframes honors-panel-fade-in {
          0% {
            opacity: 0;
            transform: translate3d(var(--panel-enter-x, 0.7rem), 0.5rem, 0) scale(0.992);
            filter: blur(10px) saturate(0.92);
          }
          48% {
            opacity: 0.88;
            filter: blur(2.4px) saturate(1.02);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0) saturate(1);
          }
        }
        @keyframes honors-panel-fade-out {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0) saturate(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--panel-exit-x, -0.65rem), -0.25rem, 0) scale(0.992);
            filter: blur(8px) saturate(0.9);
          }
        }
        .anim-slide-left { animation: card-slide-left 0.6s cubic-bezier(0.34,1.25,0.64,1) 0.4s both; }
        .anim-slide-center { animation: card-slide-center 0.7s cubic-bezier(0.34,1.35,0.64,1) 0.3s both; }
        .anim-slide-right { animation: card-slide-right 0.6s cubic-bezier(0.34,1.25,0.64,1) 0.4s both; }
        .anim-title-reveal { animation: title-reveal 0.55s cubic-bezier(0.34,1.2,0.64,1) 0.1s both; }

        .honors-confetti {
          contain: strict;
          transform: translateZ(0);
        }
        .honors-confetti-piece {
          position: absolute;
          top: 0;
          left: var(--confetti-left);
          width: var(--confetti-size);
          height: calc(var(--confetti-size) * 1.55);
          border-radius: 1px;
          background: var(--confetti-color);
          box-shadow: 0 0 5px color-mix(in srgb, var(--confetti-color) 65%, transparent);
          opacity: 0;
          animation: honors-confetti-fall var(--confetti-duration) linear var(--confetti-delay) infinite;
        }
        .honors-confetti-piece.is-diamond {
          height: var(--confetti-size);
          border-radius: 2px;
          clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        }
        .honors-confetti-piece.is-star {
          width: calc(var(--confetti-size) * 1.35);
          height: calc(var(--confetti-size) * 1.35);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%);
        }
        .honors-popup-card {
          width: min(980px, calc(100vw - 1rem));
          height: min(720px, calc(100dvh - 1rem));
          max-height: calc(100dvh - 1rem);
          scrollbar-gutter: stable both-edges;
          container-type: size;
        }
        .honors-stage {
          --panel-enter-x: 0.7rem;
          --panel-exit-x: -0.65rem;
          height: 100%;
          min-height: 0;
          padding-bottom: clamp(3.75rem, 7dvh, 5rem);
        }
        .honors-stage.is-moving-next {
          --panel-enter-x: 0.72rem;
          --panel-exit-x: -0.62rem;
        }
        .honors-stage.is-moving-prev {
          --panel-enter-x: -0.72rem;
          --panel-exit-x: 0.62rem;
        }
        .honors-panel {
          display: flex;
          min-height: calc(100% - 1.25rem);
          flex-direction: column;
        }
        .honors-swap-panel {
          opacity: 0;
          pointer-events: none;
          transform: translate3d(var(--panel-exit-x), -0.25rem, 0) scale(0.992);
          transform-origin: 50% 52%;
          transition:
            opacity 900ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 980ms cubic-bezier(0.16, 1, 0.3, 1),
            visibility 0s linear 980ms;
          will-change: opacity, transform;
          backface-visibility: hidden;
        }
        .honors-swap-panel.is-active {
          z-index: 2;
          opacity: 1;
          pointer-events: auto;
          transform: translate3d(0, 0, 0) scale(1);
          visibility: visible;
          transition:
            opacity 900ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 980ms cubic-bezier(0.16, 1, 0.3, 1),
            visibility 0s linear 0s;
        }
        .honors-swap-panel.is-inactive {
          z-index: 1;
          visibility: hidden;
        }
        .honors-swap-panel.is-inactive *,
        .honors-swap-panel.is-inactive *::before,
        .honors-swap-panel.is-inactive *::after {
          animation-play-state: paused !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .honors-confetti {
            display: none;
          }
          .honors-swap-panel {
            animation: none !important;
            transition: opacity 180ms ease;
            transform: none !important;
            filter: none !important;
          }
        }
        @media (max-width: 767px), (pointer: coarse) {
          .honors-confetti-piece:nth-child(n + 27) {
            display: none;
          }
          .honors-confetti-piece {
            box-shadow: none;
          }
          .honors-popup-overlay {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }
          .honors-popup-card,
          .honors-popup-card * {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }
          .honors-popup-card [style*="infinite"] {
            animation: none !important;
          }
          .honors-swap-panel {
            transition-duration: 240ms;
          }
          .honors-swap-panel.is-active {
            animation: none;
          }
          .honors-mobile-heavy-effect {
            display: none;
          }
        }
        .honors-popup-card.is-performance-mode [style*="infinite"] {
          animation: none !important;
        }
        .honors-popup-card.is-performance-mode .honors-mobile-heavy-effect {
          display: none;
        }
        .honors-popup-card.is-performance-mode .honors-confetti-piece:nth-child(n + 19) {
          display: none;
        }
        .honors-popup-card.is-performance-mode .podium-card-shell,
        .honors-popup-card.is-performance-mode .podium-score,
        .honors-popup-card.is-performance-mode .podium-caption,
        .honors-popup-card.is-performance-mode .podium-center-badge,
        .honors-popup-card.is-performance-mode .honors-eyebrow,
        .honors-popup-card.is-performance-mode .honors-footer-ribbon-inner,
        .honors-popup-card.is-performance-mode .honors-pagination-shell {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
        .honors-popup-card.is-performance-mode .podium-card-shell {
          will-change: auto !important;
        }
        .honors-popup-card.is-performance-mode .podium-avatar,
        .honors-popup-card.is-performance-mode .podium-caption {
          transform: none !important;
        }
        .honors-content-panel {
          bottom: clamp(4.25rem, 8dvh, 5rem);
        }
        .honors-pagination {
          right: clamp(0.75rem, 2.4dvw, 1.35rem);
          bottom: clamp(0.65rem, 1.9dvh, 1rem);
        }
        .honors-pagination-shell {
          min-height: 1.38rem;
          padding: 0.18rem;
          border-radius: 999px;
          background:
            radial-gradient(circle at 28% 18%, rgba(255,255,255,0.42), transparent 34%),
            linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,220,150,0.08) 46%, rgba(69,10,10,0.26)),
            rgba(38,6,8,0.28);
          border: 1px solid rgba(255,255,255,0.34);
          box-shadow:
            0 8px 18px rgba(69,10,10,0.22),
            0 0 0 1px rgba(255,230,170,0.08),
            inset 0 1px 0 rgba(255,255,255,0.54),
            inset 0 -6px 10px rgba(69,10,10,0.18);
          backdrop-filter: blur(14px) saturate(1.4);
          -webkit-backdrop-filter: blur(14px) saturate(1.4);
        }
        .honors-pagination-dot {
          position: relative;
          height: 0.68rem;
          width: 0.68rem;
          flex: 0 0 auto;
          border-radius: 999px;
          overflow: hidden;
          background:
            radial-gradient(circle at 38% 30%, rgba(255,255,255,0.82), rgba(255,255,255,0.28) 42%, rgba(255,255,255,0.14) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.54),
            inset 0 -2px 5px rgba(69,10,10,0.16),
            0 3px 7px rgba(69,10,10,0.12);
          opacity: 0.76;
          transform: translateZ(0);
          transition: width 240ms cubic-bezier(0.34,1.2,0.64,1), opacity 180ms ease, transform 180ms ease, background 220ms ease, box-shadow 220ms ease;
        }
        .honors-pagination-dot::before {
          content: "";
          position: absolute;
          inset: 0.23rem;
          border-radius: inherit;
          background: rgba(255,255,255,0.86);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 2px 5px rgba(69,10,10,0.14);
          transition: inset 220ms ease, background 220ms ease, box-shadow 220ms ease, transform 220ms ease;
        }
        .honors-pagination-dot::after {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.58) 42%, transparent 68%);
          opacity: 0;
          transform: translateX(-80%);
          transition: opacity 220ms ease, transform 520ms ease;
        }
        .honors-pagination-dot:hover {
          opacity: 1;
          transform: translateY(-1px);
        }
        .honors-pagination-dot.is-active {
          width: 1.35rem;
          opacity: 1;
          background:
            radial-gradient(circle at 22% 30%, rgba(255,255,255,1), rgba(255,244,210,0.92) 34%, transparent 48%),
            linear-gradient(100deg, #fffdf5 0%, #ffe7a9 52%, #f4c45f 100%);
          box-shadow:
            0 5px 11px rgba(255,213,104,0.23),
            0 0 0 1px rgba(255,255,255,0.32),
            inset 0 1px 0 rgba(255,255,255,0.98),
            inset 0 -3px 7px rgba(162,91,18,0.14);
        }
        .honors-pagination-dot.is-active::before {
          inset: 0.17rem 0.28rem;
          background: linear-gradient(90deg, #ffffff, #ffe8aa);
          box-shadow: 0 3px 8px rgba(255,223,137,0.22);
          transform: scaleX(1.02);
        }
        .honors-pagination-dot.is-active::after {
          opacity: 0.72;
          transform: translateX(90%);
        }
        .honors-title {
          margin-bottom: clamp(0.75rem, 2.1dvh, 1.75rem);
        }
        .honors-title h1 {
          font-size: clamp(1.35rem, 4.8dvw, 3.15rem);
        }
        .honors-title .honors-subtitle {
          font-size: clamp(0.62rem, 1.45dvw, 0.94rem);
        }
        .honors-podium {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          margin-top: clamp(0.7rem, 2.2dvh, 1.45rem);
          margin-bottom: clamp(0.7rem, 2.2dvh, 1.45rem);
        }
        .honors-podium-track {
          width: 100%;
          max-height: 100%;
        }
        .podium-card-wrap {
          container-type: inline-size;
          min-width: 0;
        }
        .honors-footer-ribbon {
          padding-bottom: clamp(1.15rem, 2.8dvh, 1.9rem);
        }
        .honors-footer-ribbon-inner {
          width: min(100%, 620px);
        }
        .card-podium-1 {
          width: 36%;
          height: clamp(228px, 50dvh, 304px);
        }
        .card-podium-2 {
          width: 31%;
          height: clamp(208px, 45dvh, 274px);
        }
        .card-podium-3 {
          width: 28%;
          height: clamp(190px, 41dvh, 250px);
        }
        .mascot-feature-panel {
          height: 100%;
          min-height: 0;
        }
        @media (min-width: 640px) {
          .honors-popup-card {
            width: min(980px, calc(100vw - 2rem));
            height: min(760px, calc(100dvh - 2rem));
            max-height: calc(100dvh - 2rem);
          }
          .card-podium-1 {
            width: 34%;
            height: clamp(280px, 52dvh, 370px);
          }
          .card-podium-2 {
            width: 30%;
            height: clamp(252px, 47dvh, 332px);
          }
          .card-podium-3 {
            width: 26%;
            height: clamp(226px, 42dvh, 296px);
          }
        }
        @media (min-width: 768px) {
          .card-podium-1 {
            width: clamp(218px, 29dvw, 286px);
            height: clamp(318px, 54dvh, 446px);
          }
          .card-podium-2 {
            width: clamp(188px, 25dvw, 246px);
            height: clamp(286px, 49dvh, 402px);
          }
          .card-podium-3 {
            width: clamp(168px, 22dvw, 218px);
            height: clamp(258px, 44dvh, 360px);
          }
        }
        @media (max-width: 639px) {
          .honors-popup-card {
            width: calc(100vw - 0.5rem);
            height: min(82dvh, 680px);
            max-height: calc(100dvh - 0.75rem);
            border-radius: 1.25rem;
          }
          .honors-stage {
            padding-bottom: 3rem;
          }
          .honors-content-panel {
            inset-inline: 0.6rem !important;
            top: 0.8rem !important;
            bottom: 3.25rem;
          }
          .honors-title {
            margin-bottom: clamp(0.35rem, 1.2dvh, 0.7rem);
            padding-inline: 2.4rem;
          }
          .honors-title > div:first-child {
            max-width: 100%;
            margin-bottom: clamp(0.45rem, 1.1dvh, 0.7rem) !important;
            padding: 0.42rem 0.75rem !important;
          }
          .honors-title > div:first-child span {
            font-size: clamp(0.44rem, 2.2vw, 0.62rem) !important;
            letter-spacing: 0.12em !important;
          }
          .honors-title > div:first-child svg {
            width: 0.7rem;
            height: 0.7rem;
            flex: 0 0 auto;
          }
          .honors-title h1 {
            max-width: 30rem;
            margin-bottom: 0.45rem;
            font-size: clamp(1.22rem, 6.3vw, 2rem);
            line-height: 1;
          }
          .honors-title .honors-subtitle {
            max-width: 31rem;
            font-size: clamp(0.52rem, 2.55vw, 0.72rem);
            line-height: 1.35;
            letter-spacing: 0.08em;
            text-wrap: balance;
          }
          .honors-podium {
            flex: 0 0 auto;
            align-items: flex-start;
            margin-top: 0.2rem;
            margin-bottom: 0.3rem;
          }
          .honors-podium-track {
            gap: clamp(0.25rem, 1.4vw, 0.55rem) !important;
            padding-inline: 0.2rem !important;
          }
          .card-podium-1 {
            width: 36%;
            height: clamp(205px, 35dvh, 300px);
          }
          .card-podium-2 {
            width: 31.5%;
            height: clamp(184px, 31dvh, 268px);
          }
          .card-podium-3 {
            width: 29%;
            height: clamp(174px, 29dvh, 250px);
          }
          .podium-rank-label {
            min-height: 1.15rem;
            margin-bottom: 0.3rem !important;
            gap: 0.25rem;
          }
          .podium-rank-label span {
            font-size: clamp(0.52rem, 5.6cqw, 0.78rem) !important;
            letter-spacing: 0.1em !important;
            white-space: nowrap;
          }
          .podium-rank-label svg {
            width: clamp(0.7rem, 8cqw, 1rem) !important;
            height: clamp(0.7rem, 8cqw, 1rem) !important;
          }
          .podium-card-shell {
            border-radius: clamp(1rem, 10cqw, 1.45rem) !important;
          }
          .podium-avatar {
            flex: 0 1 auto !important;
            height: calc(100% - clamp(3.8rem, 9.5dvh, 5.4rem) - 1.15rem);
            min-height: 0;
            margin: 0.35rem 0.35rem 0 !important;
            border-radius: clamp(0.85rem, 9cqw, 1.2rem) !important;
          }
          .podium-avatar > div:last-child {
            border-radius: inherit !important;
          }
          .podium-score {
            bottom: 0.45rem !important;
            max-width: calc(100% - 0.7rem);
            gap: 0.22rem !important;
            padding: 0.32rem clamp(0.45rem, 6cqw, 0.75rem) !important;
            font-size: clamp(0.58rem, 7cqw, 0.82rem) !important;
            white-space: nowrap;
          }
          .podium-score svg {
            width: clamp(0.7rem, 8cqw, 0.95rem) !important;
            height: clamp(0.7rem, 8cqw, 0.95rem) !important;
          }
          .podium-caption {
            min-height: 0;
            height: clamp(3.5rem, 8dvh, 4.6rem);
            flex: 0 0 auto;
            margin: 0.4rem 0.4rem 0.4rem !important;
            padding: 0.38rem 0.35rem !important;
            gap: 0.32rem !important;
            border-radius: clamp(0.8rem, 9cqw, 1.1rem) !important;
          }
          .podium-teacher-name {
            font-size: clamp(0.66rem, 8.5cqw, 1rem) !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }
          .podium-center-badge {
            max-width: calc(100% - 0.2rem);
            padding: 0.28rem clamp(0.35rem, 5cqw, 0.65rem) !important;
          }
          .podium-center-name {
            max-width: 100%;
            font-size: clamp(0.5rem, 6.3cqw, 0.72rem) !important;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .honors-footer-ribbon {
            margin-top: auto;
            padding-bottom: 0.15rem;
          }
          .honors-footer-ribbon-inner {
            max-width: calc(100% - 4.5rem) !important;
            padding: 0.4rem 0.75rem !important;
          }
          .honors-footer-ribbon-inner span {
            flex: 1 1 auto;
            text-align: center;
            font-size: clamp(0.44rem, 2.25vw, 0.62rem) !important;
            line-height: 1.2;
            text-wrap: balance;
          }
          .honors-pagination {
            right: 0.7rem;
            bottom: 0.55rem;
          }
          .honors-close-button {
            top: 0.55rem !important;
            right: 0.55rem !important;
            width: 2rem !important;
            height: 2rem !important;
          }
          .honors-panel-navigation {
            align-items: flex-end !important;
            padding: 0 0.45rem 2.7rem !important;
          }
          .honors-panel-arrow {
            width: 2rem !important;
            height: 2rem !important;
            background: rgba(38, 6, 8, 0.52) !important;
          }
          .honors-panel-arrow svg {
            width: 1rem;
            height: 1rem;
          }
        }
        @media (max-width: 390px) {
          .honors-popup-card {
            height: min(80dvh, 630px);
          }
          .honors-title {
            padding-inline: 1.9rem;
          }
          .honors-title > div:first-child svg:last-child {
            display: none;
          }
          .honors-title h1 {
            font-size: clamp(1.08rem, 6vw, 1.45rem);
          }
          .honors-title .honors-subtitle {
            font-size: clamp(0.48rem, 2.45vw, 0.61rem);
          }
          .honors-podium-track {
            gap: 0.2rem !important;
          }
          .card-podium-1 {
            width: 37%;
          }
          .card-podium-2 {
            width: 31%;
          }
          .card-podium-3 {
            width: 29%;
          }
          .podium-caption {
            margin-inline: 0.3rem !important;
            height: 3.45rem;
          }
        }
        @media (max-height: 760px) and (max-width: 767px) {
          .honors-popup-card {
            height: min(86dvh, 610px);
          }
          .honors-content-panel {
            top: 0.55rem !important;
          }
          .honors-title > div:first-child {
            margin-bottom: 0.35rem !important;
            padding-block: 0.3rem !important;
          }
          .honors-title h1 {
            margin-bottom: 0.25rem;
            font-size: clamp(1.05rem, 5.4vw, 1.55rem);
          }
          .honors-title .honors-subtitle {
            font-size: clamp(0.46rem, 2.25vw, 0.6rem);
          }
          .honors-podium {
            margin-block: 0.15rem 0.25rem;
          }
          .card-podium-1 {
            height: clamp(195px, 36dvh, 270px);
          }
          .card-podium-2 {
            height: clamp(176px, 32dvh, 242px);
          }
          .card-podium-3 {
            height: clamp(166px, 30dvh, 226px);
          }
          .podium-caption {
            height: 3.45rem;
            padding-block: 0.38rem !important;
          }
          .honors-footer-ribbon {
            padding-bottom: 0.25rem;
          }
        }
        @media (max-height: 680px) {
          .honors-title {
            margin-bottom: 0.65rem;
          }
          .honors-title h1 {
            font-size: clamp(1.22rem, 4.2dvw, 2.35rem);
            line-height: 0.98;
          }
          .honors-title .honors-subtitle {
            font-size: clamp(0.58rem, 1.2dvw, 0.78rem);
          }
          .honors-podium {
            margin-top: 0.55rem;
            margin-bottom: 0.6rem;
          }
          .honors-footer-ribbon {
            padding-bottom: 0.95rem;
          }
          .card-podium-1 {
            height: clamp(224px, 49dvh, 360px);
          }
          .card-podium-2 {
            height: clamp(202px, 44dvh, 322px);
          }
          .card-podium-3 {
            height: clamp(184px, 39dvh, 286px);
          }
        }
        @media (max-height: 560px) {
          .honors-popup-card {
            height: calc(100dvh - 0.5rem);
            max-height: calc(100dvh - 0.5rem);
          }
          .honors-stage {
            padding-bottom: 3.25rem;
          }
          .honors-content-panel {
            bottom: 3.65rem;
          }
          .honors-pagination-shell {
            min-height: 1.22rem;
            padding: 0.16rem;
          }
          .honors-pagination-dot {
            height: 0.58rem;
            width: 0.58rem;
          }
          .honors-pagination-dot.is-active {
            width: 1.14rem;
          }
          .honors-title h1 {
            font-size: clamp(1.08rem, 3.8dvw, 1.85rem);
          }
          .honors-podium {
            margin-top: 0.35rem;
            margin-bottom: 0.35rem;
          }
          .honors-podium-track {
            gap: 0.35rem;
          }
          .honors-footer-ribbon {
            padding-bottom: 0.55rem;
          }
          .card-podium-1 {
            height: clamp(198px, 47dvh, 284px);
          }
          .card-podium-2 {
            height: clamp(180px, 42dvh, 254px);
          }
          .card-podium-3 {
            height: clamp(166px, 37dvh, 226px);
          }
        }
        @media (max-height: 520px) and (orientation: landscape) {
          .honors-content-panel {
            top: 0.35rem !important;
            bottom: 2.9rem;
          }
          .honors-stage {
            padding-bottom: 2.7rem;
          }
          .honors-eyebrow,
          .honors-title .honors-subtitle,
          .honors-footer-ribbon {
            display: none;
          }
          .honors-title {
            margin-bottom: 0.1rem;
          }
          .honors-title h1 {
            margin-bottom: 0;
            font-size: clamp(1rem, 3.2vw, 1.65rem);
          }
          .honors-podium {
            margin-block: 0.1rem;
          }
          .card-podium-1 {
            height: min(72dvh, 330px);
          }
          .card-podium-2 {
            height: min(65dvh, 295px);
          }
          .card-podium-3 {
            height: min(60dvh, 270px);
          }
          .podium-caption {
            min-height: 3.25rem;
            margin-block: 0.25rem !important;
            padding-block: 0.25rem !important;
          }
          .honors-panel-navigation {
            align-items: center !important;
            padding: 0 0.35rem !important;
          }
        }
        /*
         * Final portrait-mobile contract.
         * Keep this block after height-based queries so short screens cannot
         * accidentally restore the old portrait card heights.
         */
        @media (max-width: 639px) and (orientation: portrait) {
          .honors-popup-card {
            height: min(84dvh, 680px);
          }
          .honors-content-panel {
            top: 0.65rem !important;
            bottom: 3.2rem;
          }
          .honors-title {
            margin-bottom: 0.3rem;
          }
          .honors-podium {
            flex: 1 1 auto;
            min-height: 0;
            align-items: center;
            justify-content: center;
            margin-block: 0.2rem;
          }
          .honors-podium-track {
            align-items: flex-end;
            margin-block: auto;
            gap: clamp(0.18rem, 1.1vw, 0.42rem) !important;
            padding-inline: 0.1rem !important;
          }
          .card-podium-1,
          .card-podium-2,
          .card-podium-3 {
            height: auto !important;
            align-self: flex-end;
          }
          .card-podium-1 {
            width: 36%;
          }
          .card-podium-2 {
            width: 31.5%;
          }
          .card-podium-3 {
            width: 29%;
          }
          .podium-rank-label {
            min-height: 1rem;
            margin-bottom: 0.2rem !important;
          }
          .podium-card-shell {
            display: grid !important;
            grid-template-rows: auto auto;
            height: auto !important;
            flex: 0 0 auto !important;
          }
          .podium-avatar {
            width: calc(100% - 0.6rem);
            height: auto !important;
            min-height: 0 !important;
            /* 3× the previous 16:9 height: width × 27/16 */
            aspect-ratio: 16 / 27 !important;
            flex: 0 0 auto !important;
            margin: 0.3rem 0.3rem 0 !important;
          }
          .podium-score {
            bottom: 0.28rem !important;
            padding-block: 0.24rem !important;
          }
          .podium-caption {
            display: grid !important;
            grid-template-rows: minmax(2.2em, auto) auto;
            align-content: center;
            justify-items: center;
            width: calc(100% - 0.6rem);
            height: auto !important;
            min-height: 4.35rem !important;
            margin: 0.32rem 0.3rem 0.3rem !important;
            padding: 0.42rem 0.32rem !important;
            gap: 0.28rem !important;
            overflow: hidden;
          }
          .podium-teacher-name {
            min-height: 2.2em;
            max-height: 2.2em;
            font-size: clamp(0.64rem, 8.2cqw, 0.92rem) !important;
            line-height: 1.1 !important;
            text-wrap: balance;
          }
          .podium-center-badge {
            width: min(100%, 9.5rem);
            min-width: 0;
            padding: 0.24rem clamp(0.3rem, 4.5cqw, 0.58rem) !important;
          }
          .podium-center-name {
            width: 100%;
            min-width: 0;
            font-size: clamp(0.48rem, 6cqw, 0.68rem) !important;
            line-height: 1.15 !important;
          }
          .honors-footer-ribbon {
            margin-top: 0;
            flex: 0 0 auto;
          }
        }
      `}</style>

       <div
         ref={cardRef}
         className={cn(
           'honors-popup-card relative pointer-events-auto overflow-hidden rounded-[1.35rem] sm:rounded-[2rem] transition-opacity duration-300',
           showCard ? 'opacity-100' : 'opacity-0 pointer-events-none',
           performanceMode && 'is-performance-mode',
         )}
         style={{
           background: 'linear-gradient(135deg, #8f101f 0%, #c21c27 34%, #e43728 58%, #9b1219 100%)',
           boxShadow: '0 38px 96px -22px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.28)',
           transform: 'translateZ(0)',
         }}
       >
        <ConfettiRain active={activeConfetti && activePanel === 'honors'} />
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.35rem] sm:rounded-[2rem]">

          {/* ── Velvet stage depth ── */}
          <div className="absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse at 50% 40%, rgba(255,214,120,0.18) 0%, rgba(255,214,120,0.06) 25%, transparent 54%)',
                'radial-gradient(ellipse at 50% 115%, rgba(69,10,10,0.58) 0%, transparent 48%)',
                'linear-gradient(90deg, rgba(69,10,10,0.36), transparent 22%, transparent 78%, rgba(69,10,10,0.44))',
                'linear-gradient(135deg, rgba(77,8,14,0.82) 0%, rgba(159,18,32,0.38) 42%, rgba(84,9,16,0.72) 100%)',
              ].join(', '),
            }} />

          {/* ── Smooth red stage waves ── */}
          <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px), linear-gradient(0deg, rgba(69,10,10,0.2) 0 1px, transparent 1px)',
              backgroundSize: '240px 240px, 240px 240px',
            }} />
          <div className="absolute -left-[16%] top-[6%] h-[34%] w-[118%] opacity-42 mix-blend-multiply"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'1200\' height=\'320\' viewBox=\'0 0 1200 320\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M-90 58 C 150 10 310 122 522 108 C 720 96 882 42 1290 20 L1290 166 C 1016 248 786 228 548 168 C 334 114 132 134 -90 214 Z\' fill=\'%23550710\' opacity=\'.62\'/%3E%3Cpath d=\'M-90 188 C 152 104 340 170 558 202 C 780 236 1008 194 1290 120 L1290 320 L-90 320 Z\' fill=\'%23880f1b\' opacity=\'.42\'/%3E%3C/svg%3E")',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'stage-wave-cross-a 20s ease-in-out infinite',
            }} />
          <div className="absolute -right-[18%] top-[15%] h-[36%] w-[116%] opacity-36 mix-blend-multiply"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'1200\' height=\'360\' viewBox=\'0 0 1200 360\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M-80 64 C 180 182 372 196 602 150 C 788 112 978 70 1280 132 L1280 360 L-80 360 Z\' fill=\'%237a0c17\' opacity=\'.56\'/%3E%3Cpath d=\'M-80 150 C 190 228 402 264 626 206 C 836 152 1014 138 1280 202 L1280 360 L-80 360 Z\' fill=\'%23b91c1c\' opacity=\'.28\'/%3E%3C/svg%3E")',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'stage-wave-cross-b 24s ease-in-out infinite',
            }} />
          <div className="absolute -left-[12%] bottom-[4%] h-[32%] w-[114%] opacity-32 mix-blend-multiply"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'1200\' height=\'320\' viewBox=\'0 0 1200 320\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M-90 96 C 130 26 310 70 504 142 C 732 226 936 198 1290 84 L1290 320 L-90 320 Z\' fill=\'%235b0810\' opacity=\'.6\'/%3E%3Cpath d=\'M-90 176 C 154 88 354 134 570 214 C 790 296 1012 250 1290 164 L1290 320 L-90 320 Z\' fill=\'%239b1219\' opacity=\'.46\'/%3E%3C/svg%3E")',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'stage-wave-cross-c 26s ease-in-out infinite reverse',
            }} />
          <div className="honors-mobile-heavy-effect absolute -left-[22%] top-[25%] h-[28%] w-[126%] opacity-34 mix-blend-screen blur-[12px]"
            style={{
              background: 'linear-gradient(96deg, transparent 0%, rgba(255,124,90,0.12) 24%, rgba(255,255,255,0.16) 45%, rgba(255,190,120,0.14) 62%, transparent 100%)',
              animation: 'stage-wave-glow 16s ease-in-out infinite',
            }} />

          {/* ── Award ribbons and stage lights ── */}
          <div className="honors-mobile-heavy-effect absolute -left-[18%] top-[12%] h-[26%] w-[136%] opacity-45 blur-[18px]"
            style={{ background: 'linear-gradient(96deg, transparent 0%, rgba(255,236,170,0.18) 26%, rgba(255,255,255,0.18) 50%, rgba(255,185,80,0.16) 74%, transparent 100%)', animation: 'ribbon-flow 14s ease-in-out infinite' }} />
          <div className="honors-mobile-heavy-effect absolute -left-[24%] bottom-[9%] h-[22%] w-[150%] opacity-36 blur-[22px]"
            style={{ background: 'linear-gradient(84deg, transparent 0%, rgba(255,255,255,0.14) 30%, rgba(255,213,104,0.18) 50%, rgba(255,255,255,0.11) 68%, transparent 100%)', animation: 'ribbon-flow 18s ease-in-out infinite reverse' }} />
          <div className="honors-mobile-heavy-effect absolute top-[-25%] left-[12%] h-[145%] w-[18%] origin-top blur-[24px]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,221,120,0.13) 44%, transparent 82%)', animation: 'light-sweep 11s ease-in-out infinite' }} />
          <div className="honors-mobile-heavy-effect absolute top-[-25%] right-[14%] h-[145%] w-[20%] origin-top blur-[28px]"
            style={{ background: 'linear-gradient(180deg, rgba(255,239,192,0.24), rgba(255,255,255,0.1) 46%, transparent 84%)', animation: 'light-sweep 13s ease-in-out infinite reverse' }} />

          {/* ── Ripple rings emanating from center ── */}
          <div className="absolute pointer-events-none" style={{ top: '45%', left: '50%', width: '320px', height: '320px', border: '1.5px solid rgba(251,191,36,0.22)', borderRadius: '50%', animation: 'ripple-out 5.6s ease-out infinite' }} />
          <div className="absolute pointer-events-none" style={{ top: '45%', left: '50%', width: '320px', height: '320px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '50%', animation: 'ripple-out 5.6s ease-out infinite 2.8s' }} />

          {/* ── Fine gold foil field ── */}
          <div className="absolute inset-0 opacity-[0.22] mix-blend-screen"
            style={{
              backgroundImage: 'radial-gradient(circle at 12% 18%, rgba(255,236,170,0.9) 0 1px, transparent 2px), radial-gradient(circle at 78% 26%, rgba(255,255,255,0.72) 0 1px, transparent 2px), radial-gradient(circle at 30% 72%, rgba(255,210,90,0.7) 0 1px, transparent 2px), radial-gradient(circle at 92% 68%, rgba(255,255,255,0.62) 0 1px, transparent 2px)',
              backgroundSize: '96px 96px, 118px 118px, 132px 132px, 84px 84px',
            }} />

          {/* ── Fine grain texture overlay ── */}
          <div className="absolute inset-0 opacity-[0.025] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '180px 180px' }} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="absolute inset-0 pointer-events-none rounded-[1.35rem] sm:rounded-[2rem]" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 -80px 120px rgba(69,10,10,0.28)' }} />
        {showCard && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.35rem] sm:rounded-[2rem]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/30" style={{ animation: 'ring-expand 1.3s ease-out 0.05s both' }} />
          </div>
        )}
         <button onClick={onClose} className="honors-close-button absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-40 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center group transition-all duration-200 hover:scale-110" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(69,10,10,0.32))', border: '1px solid rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(12px) saturate(1.4)', boxShadow: '0 10px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.34)' }} aria-label="Đóng">
           <X className="w-4 h-4 text-white/80 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
         </button>
         <div className="honors-panel-navigation absolute inset-y-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-between px-2 sm:px-4">
           <button
             type="button"
             onClick={togglePanel}
             className="honors-panel-arrow pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-black/25 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:w-10"
             aria-label="Quay lại popup trước"
           >
             <ChevronLeft className="h-5 w-5" strokeWidth={2.6} />
           </button>
           <button
             type="button"
             onClick={togglePanel}
             className="honors-panel-arrow pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-black/25 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:w-10"
             aria-label="Đi tới popup tiếp theo"
           >
             <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
           </button>
         </div>
         <div className="honors-pagination pointer-events-none absolute z-40">
           <div className="honors-pagination-shell pointer-events-auto flex items-center gap-0.5">
             {(['honors', 'feature'] as const).map(panel => (
               <button
                 key={panel}
                 type="button"
                 onClick={() => switchPanel(panel)}
                 className={cn('honors-pagination-dot transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950/40 hover:bg-white/55', activePanel === panel && 'is-active')}
                 aria-label={panel === 'honors' ? 'Mở popup vinh danh' : 'Mở popup tính năng mới'}
                 aria-current={activePanel === panel ? 'true' : undefined}
               />
             ))}
           </div>
         </div>
         <div className={cn('honors-stage relative z-10 px-3 pt-5 sm:px-5 sm:pt-7 md:px-10', panelDirection === 'next' ? 'is-moving-next' : 'is-moving-prev')}>
           <div className={cn('honors-panel honors-content-panel honors-swap-panel absolute inset-x-3 top-5 sm:inset-x-5 sm:top-7 md:inset-x-10', activePanel === 'honors' ? 'is-active' : 'is-inactive')}>
           <div className={cn('honors-title text-center', contentPhase >= 1 ? 'anim-title-reveal' : 'opacity-0')}>
             <div className="honors-eyebrow inline-flex max-w-[calc(100%-3rem)] items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 rounded-full mb-3 sm:mb-4 relative overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,236,170,0.15) 44%, rgba(255,255,255,0.19) 100%)',
                 backdropFilter: 'blur(24px) saturate(1.6)',
                 WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                 border: '1px solid rgba(255,255,255,0.56)',
                 boxShadow: '0 12px 30px rgba(69,10,10,0.22), 0 1px 0 rgba(255,255,255,0.75) inset, 0 -1px 0 rgba(0,0,0,0.1) inset',
                 borderRadius: '999px',
               }}>
               {/* top gloss strip */}
               <div className="absolute left-[8%] right-[8%] top-[3px] h-[38%] rounded-full pointer-events-none"
                 style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.08))', filter: 'blur(1px)' }} />
               <Star className="relative z-[1] h-3.5 w-3.5 fill-white text-white drop-shadow-[0_2px_7px_rgba(0,0,0,0.32)]" />
               <span className="text-[8px] sm:text-[10px] md:text-[12px] font-black tracking-[0.12em] sm:tracking-[0.24em] uppercase leading-tight"
                 style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 1px 6px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
                 Bảng Vinh Danh Giảng Viên Xuất Sắc
               </span>
               <Star className="relative z-[1] h-3.5 w-3.5 fill-white text-white drop-shadow-[0_2px_7px_rgba(0,0,0,0.32)]" />
             </div>
             <h1 className="mx-auto max-w-[900px] font-black tracking-tight leading-[0.95] mb-2.5 text-white"
               style={{ animation: 'title-glow 3.8s ease-in-out infinite' }}>
               VINH DANH NGÔI SAO ĐÀO TẠO
             </h1>
             <div className="mx-auto flex max-w-[760px] items-center justify-center gap-2 sm:gap-3">
               <span className="hidden sm:block h-px flex-1 bg-gradient-to-r from-transparent via-yellow-200/58 to-transparent" />
               <p className="honors-subtitle text-white/92 font-extrabold tracking-[0.08em] sm:tracking-[0.18em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">TẬN TÂM TRÊN TỪNG BÀI GIẢNG · TRUYỀN CẢM HỨNG MỖI NGÀY</p>
               <span className="hidden sm:block h-px flex-1 bg-gradient-to-r from-transparent via-yellow-200/58 to-transparent" />
             </div>
           </div>
          <div className={cn('honors-podium relative w-full', contentPhase >= 2 ? '' : 'opacity-0')}>
            <div className="honors-podium-track relative flex items-end justify-center gap-1.5 px-0 sm:gap-4 sm:px-2 md:gap-8">
              <div className="absolute left-[5%] right-[5%] bottom-[-18px] h-[42px] rounded-[999px] opacity-65 blur-xl"
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(69,10,10,0.42), transparent 68%)' }} />
              {podium.map((teacher, idx) => {
                const isFirst = idx === 1
                const animCls = contentPhase >= 2 ? (isFirst ? 'anim-slide-center' : idx === 0 ? 'anim-slide-left' : 'anim-slide-right') : 'opacity-0'
                return <PodiumCard key={teacher.teacher_code} teacher={teacher} idx={idx} animCls={animCls} triggerAnimate={contentPhase >= 2} />
              })}
            </div>
          </div>
           <div className={cn('honors-footer-ribbon transition-all duration-700', contentPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')} style={{ transitionDelay: contentPhase >= 3 ? '0.6s' : '0s' }}>
             <div className="flex items-center justify-center">
               <div className="honors-footer-ribbon-inner inline-flex max-w-[calc(100%-3rem)] items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 rounded-full relative overflow-hidden"
                   style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,236,170,0.15) 44%, rgba(255,255,255,0.19) 100%)',
                            backdropFilter: 'blur(24px) saturate(1.6)',
                            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                            border: '1px solid rgba(255,255,255,0.56)',
                            boxShadow: '0 12px 30px rgba(69,10,10,0.22), 0 1px 0 rgba(255,255,255,0.75) inset, 0 -1px 0 rgba(0,0,0,0.1) inset',
                            borderRadius: '999px',
                          }}>
                 {/* top gloss strip */}
                 <div className="absolute left-[8%] right-[8%] top-[3px] h-[38%] rounded-full pointer-events-none"
                   style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.08))', filter: 'blur(1px)' }} />
                 <Star className="relative z-[1] h-3.5 w-3.5 fill-white text-white drop-shadow-[0_2px_7px_rgba(0,0,0,0.32)]" />
                 <span className="text-[8px] sm:text-[10px] md:text-[11px] font-black tracking-[0.12em] sm:tracking-[0.2em] uppercase leading-tight"
                   style={{ color: 'rgba(255,255,255,0.97)', textShadow: '0 1px 6px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
                   Tôn vinh những người đưa đò thầm lặng
                 </span>
                 <Star className="relative z-[1] h-3.5 w-3.5 fill-white text-white drop-shadow-[0_2px_7px_rgba(0,0,0,0.32)]" />
               </div>
             </div>
           </div>
           </div>
           <div className={cn('honors-content-panel honors-swap-panel absolute inset-x-3 top-5 sm:inset-x-5 sm:top-7 md:inset-x-8', activePanel === 'feature' ? 'is-active' : 'is-inactive')}>
             <MascotFeaturePanel onExplore={handleExploreMascotOutfits} />
           </div>
        </div>
      </div>
    </div>
  )
}

function MascotOutfitFeatureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-md"
        aria-label="Đóng giới thiệu tính năng thay đổi trang phục"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Giới thiệu tính năng thay đổi trang phục mascot"
        className="relative w-full max-w-[640px] overflow-hidden rounded-[1.25rem] border border-red-100 text-slate-900 shadow-[0_32px_90px_rgba(15,23,42,0.28)] sm:rounded-[1.6rem]"
        style={{
          background: 'radial-gradient(circle at 15% 10%, rgba(254,226,226,0.95), transparent 32%), radial-gradient(circle at 86% 14%, rgba(220,252,231,0.9), transparent 28%), linear-gradient(135deg, #fffaf7 0%, #ffffff 46%, #fff1f2 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 -top-10 text-[9rem] font-black leading-none text-red-900/[0.04]">2026</div>
          <div className="absolute bottom-4 left-5 text-[5rem] leading-none text-yellow-500/10">🏆</div>
          <div className="absolute inset-x-0 top-0 flex h-1.5">
            <span className="flex-1 bg-[#006847]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#ce1126]" />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10 p-4 sm:p-7">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
            <Sparkles className="h-4 w-4" />
            Tính năng mới
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_190px] sm:items-center sm:gap-5">
            <div>
              <h2 className="pr-9 text-[1.35rem] font-black leading-tight text-slate-950 sm:pr-0 sm:text-3xl">Thay đổi trang phục cho mascot bé Mai</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 sm:mt-3">
                Bé Mai đã có tủ đồ World Cup: chọn outfit theo đội tuyển yêu thích, xem animation trong modal và lưu để mascot ngoài màn hình dùng ngay bộ trang phục mới.
              </p>
            </div>

            <div className="relative mx-auto flex h-32 w-32 items-center justify-center sm:h-44 sm:w-44">
              <div className="absolute inset-0 rounded-full bg-yellow-300/30 blur-2xl" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-yellow-200 bg-white shadow-[0_18px_45px_rgba(251,191,36,0.22)] sm:h-36 sm:w-36">
                <Trophy className="h-12 w-12 text-yellow-300 drop-shadow-[0_8px_22px_rgba(250,204,21,0.45)] sm:h-16 sm:w-16" strokeWidth={2.2} />
                <span className="absolute -bottom-2 rounded-full bg-red-600 px-3 py-1 text-[11px] font-black text-white shadow">WC 2026</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1.5 sm:hidden">
            {[
              { icon: Shirt, shortTitle: 'Chọn áo', title: 'Chọn áo đội tuyển', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, shortTitle: 'Preview', title: 'Xem preview trước', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, shortTitle: 'Lưu ngay', title: 'Lưu và dùng ngay', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, shortTitle, title, color, bg, border }) => (
              <div
                key={title}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full border ${border} ${bg} px-2 py-2 shadow-sm`}
                aria-label={title}
                title={title}
              >
                <Icon className={`h-4 w-4 shrink-0 ${color}`} strokeWidth={2.5} />
                <span className="min-w-0 truncate text-[11px] font-black leading-none text-slate-900">{shortTitle}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 hidden gap-3 sm:grid sm:grid-cols-3">
            {[
              { icon: Shirt, title: 'Chọn áo đội tuyển', body: 'Mở tủ đồ bằng cách bấm vào bé Mai ở góc phải và chọn bộ theo quốc gia bạn thích.', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, title: 'Xem preview trước', body: 'Animation chạy ngay trong modal để bạn biết bộ nào hợp nhất.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, title: 'Lưu và dùng ngay', body: 'Sau khi lưu, mascot ngoài màn hình tự đổi sang outfit mới.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, title, body, color, bg, border }) => (
              <div key={title} className={`rounded-2xl border ${border} ${bg} p-3 shadow-sm`}>
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white ${color} shadow-sm`}>
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <p className="text-sm font-black text-slate-900">{title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              Để tôi khám phá sau
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TeacherHonorsPopupProps { isOpen: boolean; onOpen?: () => void; onClose: () => void }

export function TeacherHonorsPopup({ isOpen, onOpen, onClose }: TeacherHonorsPopupProps) {
  const [mounted, setMounted] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)
  const [renderCard, setRenderCard] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [contentPhase, setContentPhase] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const animStateRef = useRef<'idle' | 'in' | 'out'>('idle')
  const onCloseRef = useRef(onClose)
  const triggerOpenRef = useRef<(() => void) | null>(null)
  const triggerCloseRef = useRef<(() => void) | null>(null)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    setMounted(true)
    setPerformanceMode(shouldReduceVisualEffects())
  }, [])

  const shouldUseLightweightMotion = useCallback(() => shouldReduceVisualEffects(), [])

  const getTabRect = useCallback((): Rect | null => {
    const el = document.getElementById('tab-vinh-danh'); if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
  }, [])

  const getCardRect = useCallback((): Rect | null => {
    const el = cardRef.current; if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }, [])

  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    c.width = window.innerWidth; c.height = window.innerHeight
  }, [])

  const runOpen = useCallback((src: Rect, dst: Rect) => {
    const canvas = canvasRef.current; const overlay = overlayRef.current; if (!canvas) return
    resizeCanvas(); const ctx = canvas.getContext('2d')!
    const TOTAL = 820; const PHASE1_END = 0.48; let start = -1; let hasRevealedCard = false; particlesRef.current = []
    const tick = (now: number) => {
      if (start < 0) start = now; const raw = Math.min((now - start) / TOTAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (overlay) overlay.style.opacity = String(E.outCubic(Math.min(raw * 2, 1)) * 0.72)
      if (raw <= PHASE1_END) {
        const p = raw / PHASE1_END; const topT = E.outExpo(Math.min(p * 1.55, 1)); const botT = E.outCubic(Math.min(p * 0.7, 1)); const shapeAlpha = Math.min(p * 3, 1)
        paintGenie(ctx, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h, topT, botT, shapeAlpha, false)
        if (p > 0.3 && p < 0.85 && Math.random() > 0.55) particlesRef.current.push(...spawnParticles(dst.x + dst.w / 2, src.y + (dst.y - src.y) * topT * 0.5, 3))
      }
      if (raw > PHASE1_END * 0.9 && !hasRevealedCard) {
        hasRevealedCard = true
        setShowCard(true)
        setContentPhase(3)
      }
      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.02)
      for (const pt of particlesRef.current) {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.opacity -= pt.decay
        ctx.globalAlpha = pt.opacity; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
      }
      if (raw < 1 || particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(tick)
      else { canvas.style.opacity = '0'; animStateRef.current = 'idle' }
    }
    canvas.style.opacity = '1'; canvas.style.pointerEvents = 'none'; rafRef.current = requestAnimationFrame(tick)
  }, [resizeCanvas])

  const runClose = useCallback((src: Rect, dst: Rect) => {
    const canvas = canvasRef.current; const overlay = overlayRef.current; if (!canvas) return
    resizeCanvas(); const ctx = canvas.getContext('2d')!
    const TOTAL = 580; let start = -1; setShowCard(false); setContentPhase(0); canvas.style.opacity = '1'
    const tick = (now: number) => {
      if (start < 0) start = now; const raw = Math.min((now - start) / TOTAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (overlay) overlay.style.opacity = String(Math.max(0, 0.72 * (1 - E.outCubic(raw))))
      const botT = 1 - E.outExpo(1 - raw); const topT = E.inOutCubic(raw * 0.82); const shapeAlpha = Math.max(0, 1 - raw * 1.3)
      paintGenie(ctx, src.x + src.w / 2, src.y + src.h / 2, src.w, src.h, dst.x, dst.y, dst.w, dst.h, topT, botT, shapeAlpha, true)
      if (raw < 1) rafRef.current = requestAnimationFrame(tick)
      else { canvas.style.opacity = '0'; animStateRef.current = 'idle'; setRenderCard(false); onCloseRef.current() }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [resizeCanvas])

  const triggerOpen = useCallback(() => {
    if (renderCard || animStateRef.current === 'in') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (shouldUseLightweightMotion()) {
      animStateRef.current = 'idle'
      setRenderCard(true)
      requestAnimationFrame(() => {
        setShowCard(true)
        setContentPhase(3)
      })
      return
    }
    const tabRect = getTabRect()
    if (tabRect) {
      animStateRef.current = 'in'; setShowCard(false); setContentPhase(0); setRenderCard(true)
      requestAnimationFrame(() => { requestAnimationFrame(() => { const cardRect = getCardRect(); if (cardRect) runOpen(tabRect, cardRect) }) })
    } else {
      animStateRef.current = 'in'; setRenderCard(true); setTimeout(() => setShowCard(true), 10); setTimeout(() => setContentPhase(3), 440)
    }
  }, [getTabRect, getCardRect, renderCard, runOpen, shouldUseLightweightMotion])

  const triggerClose = useCallback(() => {
    if (animStateRef.current === 'out') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (shouldUseLightweightMotion()) {
      animStateRef.current = 'idle'
      setShowCard(false)
      setContentPhase(0)
      window.setTimeout(() => {
        setRenderCard(false)
        onCloseRef.current()
      }, 180)
      return
    }
    const tabRect = getTabRect(); const cardRect = getCardRect()
    if (tabRect && cardRect) { animStateRef.current = 'out'; runClose({ x: cardRect.x, y: cardRect.y, w: cardRect.w, h: cardRect.h }, tabRect) }
    else { animStateRef.current = 'out'; setShowCard(false); setContentPhase(0); setTimeout(() => { setRenderCard(false); onCloseRef.current() }, 200) }
  }, [getTabRect, getCardRect, runClose, shouldUseLightweightMotion])

  useEffect(() => { triggerOpenRef.current = triggerOpen; triggerCloseRef.current = triggerClose }, [triggerOpen, triggerClose])
  useEffect(() => { if (isOpen) triggerOpenRef.current?.(); else if (renderCard) triggerCloseRef.current?.() }, [isOpen, renderCard])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])
  useEffect(() => {
    if (!renderCard) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [renderCard])

  const { data } = useSWR<TopTeachersResponse>('/api/truyenthong/top-teachers', fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 300_000 })
  const databaseTeachers = useMemo(
    () => data?.success && Array.isArray(data.data) ? data.data : [],
    [data],
  )
  const teachers = useMemo(
    () => databaseTeachers.length > 0
      ? Array.from({ length: 3 }, (_, index) => databaseTeachers[index] ?? MOCK_TOP_TEACHERS[index])
      : MOCK_TOP_TEACHERS,
    [databaseTeachers],
  )
  useEffect(() => {
    teachers.slice(0, 3).forEach(teacher => {
      if (!teacher.avatar_url) return
      const image = new Image()
      image.decoding = 'async'
      image.src = teacher.avatar_url
    })
  }, [teachers])
  const podium = useMemo(() => [
    { ...teachers[1], rank: 2 },
    { ...teachers[0], rank: 1 },
    { ...teachers[2], rank: 3 },
  ], [teachers])

  if (!mounted) return null

  return createPortal(
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-[60] pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.15s' }} aria-hidden />
      {renderCard && <div ref={overlayRef} className="honors-popup-overlay fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm" style={{ opacity: 0 }} onClick={triggerClose} />}
      {renderCard && (
        <PopupUI
          cardRef={cardRef}
          showCard={showCard}
          contentPhase={contentPhase}
          podium={podium}
          onClose={triggerClose}
          activeConfetti={showCard && contentPhase >= 3}
          performanceMode={performanceMode}
        />
      )}
    </>,
    document.body
  )
}

export default TeacherHonorsPopup
