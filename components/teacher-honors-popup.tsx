'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
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

interface Confetti {
  x: number; y: number; vy: number; vx: number
  size: number; rotation: number; vRot: number; color: string; opacity: number; points: number
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

function spawnConfetti(width: number, count: number): Confetti[] {
  // Champagne gold confetti palette
  const colors = ['#d4b46a', '#e8c97a', '#c9a84c', '#f5d78e', '#ffe8a0', '#ffffff', '#f4ecd5', '#f0d89a']
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: -Math.random() * 300,
    vy: 1.5 + Math.random() * 2.5,
    vx: (Math.random() - 0.5) * 1.2,
    size: 3 + Math.random() * 5,
    rotation: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.1,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 1,
    points: Math.random() > 0.7 ? 5 : 4,
  }))
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: number, color: string, opacity: number) {
  ctx.save()
  ctx.translate(x, y)
  const twinkle = 0.7 + Math.sin(Date.now() * 0.01 + x) * 0.3
  const currentOpacity = opacity * twinkle
  ctx.beginPath()
  ctx.globalAlpha = currentOpacity
  ctx.fillStyle = color
  const innerRadius = p === 4 ? r * 0.25 : r * 0.4
  for (let i = 0; i < p * 2; i++) {
    const radius = i % 2 === 0 ? r : innerRadius
    const angle = (i * Math.PI) / p
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = currentOpacity * 0.4
  ctx.beginPath()
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function ConfettiRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }
    resize()
    window.addEventListener('resize', resize)
    const particles = spawnConfetti(canvas.width, 80)
    let animationFrame: number
    const render = () => {
      const ctx = canvas.getContext('2d', { alpha: true })
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rotation += p.vRot
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        drawStar(ctx, 0, 0, p.size, p.points, p.color, p.opacity)
        ctx.restore()
      })
      animationFrame = requestAnimationFrame(render)
    }
    render()
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
    }
  }, [active])
  if (!active) return null
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />
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
  const sparkleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([])
  const sparkleId = useRef(0)
  const [displayScore, setDisplayScore] = useState(0)

  const isFirst = idx === 1

  useEffect(() => {
    if (!triggerAnimate) {
      setDisplayScore(0)
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
      setDisplayScore(easeProgress * target)
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [triggerAnimate, teacher.total_score])

  const configs = [
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
  ]
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
    const el = cardEl.current; if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    targetTilt.current = { x: -ny * 14, y: nx * 14 }
    if (!rafTilt.current) rafTilt.current = requestAnimationFrame(animateTilt)
    if (sparkleTimeout.current) return
    sparkleTimeout.current = setTimeout(() => { sparkleTimeout.current = null }, 120)
    const id = ++sparkleId.current; const sx = e.clientX - r.left; const sy = e.clientY - r.top
    setSparkles(prev => [...prev.slice(-6), { id, x: sx, y: sy }])
    setTimeout(() => setSparkles(prev => prev.filter(s => s.id !== id)), 700)
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
      className={cn('relative flex-shrink cursor-pointer flex flex-col', `card-podium-${idx === 1 ? 1 : idx === 0 ? 2 : 3}`, animCls, isFirst ? 'z-10' : 'z-0')}
      style={{ perspective: '900px', transform: 'translateZ(0)' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {isFirst && (
        <div className="absolute -inset-x-6 -top-6 bottom-8 -z-10 rounded-full opacity-70 blur-2xl"
          style={{ background: cfg.halo }} />
      )}

      {/* Rank label above card */}
      <div className={cn("relative flex items-center justify-center gap-1.5 mb-1.5 sm:mb-2", isFirst ? "scale-105" : "")}>
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
        className={cn('relative w-full flex flex-col rounded-[24px] sm:rounded-[30px] overflow-hidden flex-1', cfg.border)}
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
        <div className="relative z-30 mx-2 mt-2 mb-0 flex-1 rounded-[20px] sm:rounded-[24px]"
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
            {teacher.avatar_url
              ? <img src={teacher.avatar_url} alt={teacher.full_name} className="block w-full h-full object-cover object-top" style={{ filter: 'contrast(1.06) saturate(1.06)', transform: 'translateZ(0)' }} />
              : <div className="w-full h-full flex items-center justify-center" style={{ background: cfg.badgeBg }}>
                  <span className={cn('font-black text-gray-400', isFirst ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl')}>{initials(teacher.full_name)}</span>
                </div>
            }
          </div>

          {/* Score badge — overlaid bottom-center of image */}
          <div className={cn(
            "absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full font-black tracking-[0.06em] flex items-center gap-1.5 px-4 py-1.5 backdrop-blur-2xl overflow-hidden",
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
            <span className="relative z-10 leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">
              {displayScore.toFixed(2)}%
            </span>
          </div>
          </div>
        </div>

        {/* Caption — white bottom section */}
        <div className="relative z-40 mx-3 mb-3 mt-2 rounded-[18px] sm:rounded-[22px] px-2 sm:px-3 py-3 sm:py-4 flex flex-col items-center justify-center gap-1.5 overflow-hidden"
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
          <h4 className="relative w-full font-black leading-tight tracking-tight text-center"
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
          <div className="relative inline-flex max-w-full items-center justify-center px-3 py-1 rounded-full border border-gray-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl overflow-hidden"
            style={{
              border: cfg.badgeBorder,
              background: cfg.badgeBg,
            }}>
            <span className="absolute inset-x-2 top-0 h-1/2 rounded-full bg-white/42 blur-[3px]" />
            <p className="font-bold text-center leading-snug"
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

        {sparkles.map(s => (
          <div key={s.id} className="absolute pointer-events-none z-30" style={{ left: s.x, top: s.y, animation: 'sparkle-pop 0.7s ease-out forwards' }}>
            <Star className="w-3 h-3 text-white fill-white/80 -translate-x-1/2 -translate-y-1/2" />
          </div>
        ))}
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
}

function MascotFeaturePanel({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="mx-auto flex min-h-[680px] max-w-[720px] flex-col justify-center py-2 sm:min-h-[700px] md:min-h-[690px]">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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

function PopupUI({ cardRef, showCard, contentPhase, podium, onClose, activeConfetti }: PopupUIProps) {
  const [activePanel, setActivePanel] = useState<'honors' | 'feature'>('honors')

  useEffect(() => {
    if (!showCard || contentPhase < 3) {
      setActivePanel('honors')
      return
    }
    const timer = window.setInterval(() => {
      setActivePanel(panel => panel === 'honors' ? 'feature' : 'honors')
    }, 5000)
    return () => window.clearInterval(timer)
  }, [showCard, contentPhase])

  const handleExploreMascotOutfits = useCallback(() => {
    onClose()
    window.setTimeout(() => {
      window.dispatchEvent(new Event('start-mascot-outfit-tour'))
    }, 260)
  }, [onClose])

  const togglePanel = useCallback(() => {
    setActivePanel(panel => panel === 'honors' ? 'feature' : 'honors')
  }, [])

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center p-2 sm:p-4 pointer-events-none select-none">
      <style>{`
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
        .anim-slide-left { animation: card-slide-left 0.6s cubic-bezier(0.34,1.25,0.64,1) 0.4s both; }
        .anim-slide-center { animation: card-slide-center 0.7s cubic-bezier(0.34,1.35,0.64,1) 0.3s both; }
        .anim-slide-right { animation: card-slide-right 0.6s cubic-bezier(0.34,1.25,0.64,1) 0.4s both; }
        .anim-title-reveal { animation: title-reveal 0.55s cubic-bezier(0.34,1.2,0.64,1) 0.1s both; }

        .card-podium-1 {
          width: 36%;
          height: 304px;
        }
        .card-podium-2 {
          width: 31%;
          height: 274px;
        }
        .card-podium-3 {
          width: 28%;
          height: 250px;
        }
        @media (min-width: 640px) {
          .card-podium-1 {
            width: 34%;
            height: 370px;
          }
          .card-podium-2 {
            width: 30%;
            height: 332px;
          }
          .card-podium-3 {
            width: 26%;
            height: 296px;
          }
        }
        @media (min-width: 768px) {
          .card-podium-1 {
            width: 286px;
            height: 446px;
          }
          .card-podium-2 {
            width: 246px;
            height: 402px;
          }
          .card-podium-3 {
            width: 218px;
            height: 360px;
          }
        }
      `}</style>

       <div
         ref={cardRef}
         className={cn('relative w-full max-w-[980px] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] pointer-events-auto overflow-y-auto overflow-x-hidden rounded-[1.35rem] sm:rounded-[2rem] transition-opacity duration-300', showCard ? 'opacity-100' : 'opacity-0 pointer-events-none')}
         style={{
           background: 'linear-gradient(135deg, #8f101f 0%, #c21c27 34%, #e43728 58%, #9b1219 100%)',
           boxShadow: '0 38px 96px -22px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.28)',
           transform: 'translateZ(0)',
         }}
       >
        <ConfettiRain active={activeConfetti} />
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
          <div className="absolute -left-[22%] top-[25%] h-[28%] w-[126%] opacity-34 mix-blend-screen blur-[12px]"
            style={{
              background: 'linear-gradient(96deg, transparent 0%, rgba(255,124,90,0.12) 24%, rgba(255,255,255,0.16) 45%, rgba(255,190,120,0.14) 62%, transparent 100%)',
              animation: 'stage-wave-glow 16s ease-in-out infinite',
            }} />

          {/* ── Award ribbons and stage lights ── */}
          <div className="absolute -left-[18%] top-[12%] h-[26%] w-[136%] opacity-45 blur-[18px]"
            style={{ background: 'linear-gradient(96deg, transparent 0%, rgba(255,236,170,0.18) 26%, rgba(255,255,255,0.18) 50%, rgba(255,185,80,0.16) 74%, transparent 100%)', animation: 'ribbon-flow 14s ease-in-out infinite' }} />
          <div className="absolute -left-[24%] bottom-[9%] h-[22%] w-[150%] opacity-36 blur-[22px]"
            style={{ background: 'linear-gradient(84deg, transparent 0%, rgba(255,255,255,0.14) 30%, rgba(255,213,104,0.18) 50%, rgba(255,255,255,0.11) 68%, transparent 100%)', animation: 'ribbon-flow 18s ease-in-out infinite reverse' }} />
          <div className="absolute top-[-25%] left-[12%] h-[145%] w-[18%] origin-top blur-[24px]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,221,120,0.13) 44%, transparent 82%)', animation: 'light-sweep 11s ease-in-out infinite' }} />
          <div className="absolute top-[-25%] right-[14%] h-[145%] w-[20%] origin-top blur-[28px]"
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
         <button onClick={onClose} className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center group transition-all duration-200 hover:scale-110" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(69,10,10,0.32))', border: '1px solid rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(12px) saturate(1.4)', boxShadow: '0 10px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.34)' }} aria-label="Đóng">
           <X className="w-4 h-4 text-white/80 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
         </button>
         <div className="absolute inset-y-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-between px-2 sm:px-4">
           <button
             type="button"
             onClick={togglePanel}
             className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-black/25 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:w-10"
             aria-label="Quay lại popup trước"
           >
             <ChevronLeft className="h-5 w-5" strokeWidth={2.6} />
           </button>
           <button
             type="button"
             onClick={togglePanel}
             className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-black/25 text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:w-10"
             aria-label="Đi tới popup tiếp theo"
           >
             <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
           </button>
         </div>
         <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3 py-1.5 backdrop-blur-md">
           {(['honors', 'feature'] as const).map(panel => (
             <button
               key={panel}
               type="button"
               onClick={() => setActivePanel(panel)}
               className={cn('h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70', activePanel === panel ? 'w-6 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/70')}
               aria-label={panel === 'honors' ? 'Mở popup vinh danh' : 'Mở popup tính năng mới'}
             />
           ))}
         </div>
         <div className="relative z-10 min-h-[720px] px-3 pb-5 pt-5 sm:min-h-[760px] sm:px-5 sm:pb-7 sm:pt-7 md:min-h-[740px] md:px-10">
           <div className={cn('absolute inset-x-3 top-5 transition-all duration-700 sm:inset-x-5 sm:top-7 md:inset-x-10', activePanel === 'honors' ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-3')}>
           <div className={cn('text-center mb-4 sm:mb-7', contentPhase >= 1 ? 'anim-title-reveal' : 'opacity-0')}>
             <div className="inline-flex max-w-[calc(100%-3rem)] items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 rounded-full mb-3 sm:mb-4 relative overflow-hidden"
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
             <h1 className="mx-auto max-w-[900px] text-[1.7rem] sm:text-[2.45rem] md:text-[3.15rem] font-black tracking-tight leading-[0.95] mb-2.5 text-white"
               style={{ animation: 'title-glow 3.8s ease-in-out infinite' }}>
               VINH DANH NGÔI SAO ĐÀO TẠO
             </h1>
             <div className="mx-auto flex max-w-[760px] items-center justify-center gap-2 sm:gap-3">
               <span className="hidden sm:block h-px flex-1 bg-gradient-to-r from-transparent via-yellow-200/58 to-transparent" />
               <p className="text-[11px] sm:text-[14px] md:text-[15px] text-white/92 font-extrabold tracking-[0.08em] sm:tracking-[0.18em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">TẬN TÂM TRÊN TỪNG BÀI GIẢNG · TRUYỀN CẢM HỨNG MỖI NGÀY</p>
               <span className="hidden sm:block h-px flex-1 bg-gradient-to-r from-transparent via-yellow-200/58 to-transparent" />
             </div>
           </div>
          <div className={cn('relative flex items-end justify-center gap-1.5 sm:gap-4 md:gap-8 mt-6 sm:mt-8 md:mt-[42px] mb-6 sm:mb-7 md:mb-[32px] w-full px-0 sm:px-2', contentPhase >= 2 ? '' : 'opacity-0')}>
            <div className="absolute left-[5%] right-[5%] bottom-[-18px] h-[42px] rounded-[999px] opacity-65 blur-xl"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(69,10,10,0.42), transparent 68%)' }} />
            {podium.map((teacher, idx) => {
              const isFirst = idx === 1
              const animCls = contentPhase >= 2 ? (isFirst ? 'anim-slide-center' : idx === 0 ? 'anim-slide-left' : 'anim-slide-right') : 'opacity-0'
              return <PodiumCard key={teacher.teacher_code} teacher={teacher} idx={idx} animCls={animCls} triggerAnimate={contentPhase >= 2} />
            })}
          </div>
           <div className={cn('transition-all duration-700', contentPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')} style={{ transitionDelay: contentPhase >= 3 ? '0.6s' : '0s' }}>
             <div className="flex items-center justify-center mb-3 sm:mb-4">
               <div className="inline-flex max-w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-7 py-2 rounded-full relative overflow-hidden"
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
           <div className={cn('absolute inset-x-3 top-5 transition-all duration-700 sm:inset-x-5 sm:top-7 md:inset-x-8', activePanel === 'feature' ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3')}>
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
        className="relative w-full max-w-[640px] overflow-hidden rounded-[1.6rem] border border-red-100 text-slate-900 shadow-[0_32px_90px_rgba(15,23,42,0.28)]"
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

        <div className="relative z-10 p-5 sm:p-7">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
            <Sparkles className="h-4 w-4" />
            Tính năng mới
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_190px] sm:items-center">
            <div>
              <h2 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">Thay đổi trang phục cho mascot bé Mai</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                Bé Mai đã có tủ đồ World Cup: chọn outfit theo đội tuyển yêu thích, xem animation trong modal và lưu để mascot ngoài màn hình dùng ngay bộ trang phục mới.
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

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
  useEffect(() => { setMounted(true) }, [])

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
    const TOTAL = 820; const PHASE1_END = 0.48; let start = -1; particlesRef.current = []
    const tick = (now: number) => {
      if (start < 0) start = now; const raw = Math.min((now - start) / TOTAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (overlay) overlay.style.opacity = String(E.outCubic(Math.min(raw * 2, 1)) * 0.72)
      if (raw <= PHASE1_END) {
        const p = raw / PHASE1_END; const topT = E.outExpo(Math.min(p * 1.55, 1)); const botT = E.outCubic(Math.min(p * 0.7, 1)); const shapeAlpha = Math.min(p * 3, 1)
        paintGenie(ctx, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h, topT, botT, shapeAlpha, false)
        if (p > 0.3 && p < 0.85 && Math.random() > 0.55) particlesRef.current.push(...spawnParticles(dst.x + dst.w / 2, src.y + (dst.y - src.y) * topT * 0.5, 3))
      }
      if (raw > PHASE1_END * 0.9 && !showCard) { setShowCard(true); setContentPhase(3) }
      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.02)
      for (const pt of particlesRef.current) {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.opacity -= pt.decay
        ctx.globalAlpha = pt.opacity; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
      }
      if (raw < 1 || particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(tick)
      else { canvas.style.opacity = '0'; animStateRef.current = 'idle' }
    }
    canvas.style.opacity = '1'; canvas.style.pointerEvents = 'none'; rafRef.current = requestAnimationFrame(tick)
  }, [resizeCanvas, showCard])

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
    if (animStateRef.current === 'in') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tabRect = getTabRect()
    if (tabRect) {
      animStateRef.current = 'in'; setShowCard(false); setContentPhase(0); setRenderCard(true)
      requestAnimationFrame(() => { requestAnimationFrame(() => { const cardRect = getCardRect(); if (cardRect) runOpen(tabRect, cardRect) }) })
    } else {
      animStateRef.current = 'in'; setRenderCard(true); setTimeout(() => setShowCard(true), 10); setTimeout(() => setContentPhase(3), 440)
    }
  }, [getTabRect, getCardRect, runOpen])

  const triggerClose = useCallback(() => {
    if (animStateRef.current === 'out') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tabRect = getTabRect(); const cardRect = getCardRect()
    if (tabRect && cardRect) { animStateRef.current = 'out'; runClose({ x: cardRect.x, y: cardRect.y, w: cardRect.w, h: cardRect.h }, tabRect) }
    else { animStateRef.current = 'out'; setShowCard(false); setContentPhase(0); setTimeout(() => { setRenderCard(false); onCloseRef.current() }, 200) }
  }, [getTabRect, getCardRect, runClose])

  useEffect(() => { triggerOpenRef.current = triggerOpen; triggerCloseRef.current = triggerClose }, [triggerOpen, triggerClose])
  useEffect(() => { if (isOpen) triggerOpenRef.current?.(); else if (renderCard) triggerCloseRef.current?.() }, [isOpen, renderCard])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const { data } = useSWR<TopTeachersResponse>('/api/truyenthong/top-teachers', fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 300_000 })
  const teachers = data?.success && Array.isArray(data.data) ? data.data : []
  const podium = [{ ...teachers[1], rank: 2 }, { ...teachers[0], rank: 1 }, { ...teachers[2], rank: 3 }].map((t, i) => ({
    ...t, teacher_code: t?.teacher_code || `t${i}`, full_name: t?.full_name || ['Giáo viên Xuất Sắc', 'Ngôi Sao Đào Tạo', 'Nhà Giáo Tận Tâm'][i], center: t?.center || ['MindX HCM', 'MindX HN', 'MindX ĐN'][i], total_score: t?.total_score || [9.8, 9.5, 9.2][i], avatar_url: t?.avatar_url || null,
  }))

  if (!mounted) return null

  return createPortal(
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-[60] pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.15s' }} aria-hidden />
      {renderCard && <div ref={overlayRef} className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm" style={{ opacity: 0 }} onClick={triggerClose} />}
      {renderCard && (
        <PopupUI
          cardRef={cardRef}
          showCard={showCard}
          contentPhase={contentPhase}
          podium={podium}
          onClose={triggerClose}
          activeConfetti={showCard && contentPhase >= 3}
        />
      )}
    </>,
    document.body
  )
}

export default TeacherHonorsPopup
