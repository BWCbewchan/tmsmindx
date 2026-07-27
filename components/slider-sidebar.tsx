'use client'

import { Eye, TrendingUp, Trophy, Star, ChevronRight, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { normalizeStorageUrl } from '@/lib/storage-url'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import useSWR from 'swr'

interface Post {
    id: string | number
    slug: string
    title: string
    featured_image?: string
    banner_image?: string
    post_type: string
    view_count: number
    published_at: string
}

interface Teacher {
    teacher_code: string
    full_name: string
    center: string
    total_score: number
    avatar_url: string | null
}

interface TopTeachersResponse {
    success: boolean
    data: Teacher[]
}

const POST_TYPE_LABELS: Record<string, string> = {
    'tin-tức': 'Tin tức',
    'chính-sách': 'Chính sách',
    'sự-kiện': 'Sự kiện',
    'đào-tạo': 'Đào tạo',
    'báo-cáo': 'Báo cáo',
    'thông-báo': 'Thông báo',
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
const HONORS_SCORE_LABEL = 'CR45'

function formatCr45Score(score: number | undefined) {
    return typeof score === 'number' ? `${Number(score).toFixed(1)}%` : '—'
}

function getInitials(name: string) {
    const p = name.trim().split(/\s+/)
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase()
        : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

function TeacherAvatar({
    teacher,
    className,
    fallbackClassName,
}: {
    teacher: Teacher | undefined
    className: string
    fallbackClassName: string
}) {
    const [imageFailed, setImageFailed] = useState(false)
    const avatarUrl = teacher?.avatar_url ? normalizeStorageUrl(teacher.avatar_url) : null

    if (avatarUrl && !imageFailed) {
        return (
            <img
                src={avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                onError={() => setImageFailed(true)}
                className={className}
            />
        )
    }

    return (
        <span className={fallbackClassName}>
            {teacher ? getInitials(teacher.full_name) : '?'}
        </span>
    )
}

function Cr45MetricBadge({
    score,
    variant = 'row',
    className,
}: {
    score: number | undefined
    variant?: 'hero' | 'row'
    className?: string
}) {
    const value = formatCr45Score(score)
    const isHero = variant === 'hero'
    const badgeRef = useRef<HTMLDivElement>(null)
    const frameRef = useRef<number | null>(null)
    const pendulumRef = useRef({
        angle: 0,
        velocity: 0,
        x: 0,
        y: 0,
        pullX: 0,
        pullY: 0,
        lastNx: 0,
    })

    useEffect(() => {
        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        }
    }, [])

    const startPendulum = () => {
        if (!isHero || frameRef.current !== null) return

        let lastTime = performance.now()
        const tick = (now: number) => {
            const dt = Math.min(32, now - lastTime) / 16.67
            lastTime = now

            const p = pendulumRef.current
            const spring = -p.angle * 0.075
            const pull = p.pullX * 0.42
            p.velocity = (p.velocity + (spring + pull) * dt) * Math.pow(0.9, dt)
            p.angle += p.velocity * dt
            p.x += (p.pullX * 3.2 - p.x) * Math.min(1, 0.18 * dt)
            p.y += (p.pullY * 1.6 - p.y) * Math.min(1, 0.2 * dt)
            p.pullX *= Math.pow(0.83, dt)
            p.pullY *= Math.pow(0.86, dt)

            if (badgeRef.current) {
                badgeRef.current.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) rotate(${p.angle.toFixed(2)}deg)`
            }

            const stillMoving = Math.abs(p.angle) > 0.03 || Math.abs(p.velocity) > 0.025 || Math.abs(p.x) > 0.03 || Math.abs(p.y) > 0.03 || Math.abs(p.pullX) > 0.01
            if (stillMoving) {
                frameRef.current = requestAnimationFrame(tick)
            } else {
                p.angle = 0
                p.velocity = 0
                p.x = 0
                p.y = 0
                p.pullX = 0
                p.pullY = 0
                if (badgeRef.current) badgeRef.current.style.transform = 'translate3d(0px, 0px, 0px) rotate(0deg)'
                frameRef.current = null
            }
        }

        frameRef.current = requestAnimationFrame(tick)
    }

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!isHero) return
        const rect = event.currentTarget.getBoundingClientRect()
        const nx = (event.clientX - rect.left) / rect.width - 0.5
        const ny = (event.clientY - rect.top) / rect.height - 0.5
        const p = pendulumRef.current
        p.velocity += Math.max(-1.2, Math.min(1.2, (nx - p.lastNx) * 7.5))
        p.pullX = Math.max(-1, Math.min(1, nx * 2.2))
        p.pullY = Math.max(-0.5, Math.min(0.8, ny * 1.5))
        p.lastNx = nx
        startPendulum()
    }

    const handlePointerDown = () => {
        if (!isHero) return
        const p = pendulumRef.current
        p.velocity += p.angle >= 0 ? 0.58 : -0.58
        startPendulum()
    }

    const handlePointerLeave = () => {
        if (!isHero) return
        const p = pendulumRef.current
        p.pullX = 0
        p.pullY = 0
        p.lastNx = 0
        startPendulum()
    }

    return (
        <div
            className={cn(
                'relative inline-flex shrink-0',
                isHero && 'z-30 pt-3 [perspective:520px] pointer-events-auto cursor-grab touch-none active:cursor-grabbing',
                className,
            )}
            title={`Chỉ số ${HONORS_SCORE_LABEL}: ${value}`}
            aria-label={`Chỉ số ${HONORS_SCORE_LABEL}: ${value}`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
        >
            {isHero && (
                <>
                    <span className="absolute left-1/2 top-0 z-20 h-2 w-2 -translate-x-1/2 rounded-full border border-amber-100/90 bg-gradient-to-b from-white to-amber-300 shadow-[0_2px_8px_rgba(251,191,36,0.55)]" />
                    <svg
                        viewBox="0 0 76 24"
                        className="pointer-events-none absolute left-1/2 top-1 h-4.5 w-16 -translate-x-1/2 overflow-visible"
                        aria-hidden="true"
                    >
                        <path d="M38 1 C31 8 26 12 20 18" stroke="#FFE8A3" strokeWidth="1.35" strokeLinecap="round" fill="none" opacity="0.9" />
                        <path d="M38 1 C45 8 50 12 56 18" stroke="#FFE8A3" strokeWidth="1.35" strokeLinecap="round" fill="none" opacity="0.9" />
                        <path d="M38 1 C31 8 26 12 20 18" stroke="#8A4B0B" strokeWidth="0.55" strokeLinecap="round" fill="none" opacity="0.24" />
                        <path d="M38 1 C45 8 50 12 56 18" stroke="#8A4B0B" strokeWidth="0.55" strokeLinecap="round" fill="none" opacity="0.24" />
                    </svg>
                </>
            )}

            <div
                ref={badgeRef}
                className={cn(
                    'relative isolate flex items-center overflow-hidden rounded-full border border-amber-100/90 whitespace-nowrap will-change-transform',
                    isHero
                        ? 'gap-1 px-1.5 py-0.5 shadow-[0_10px_22px_rgba(69,10,10,0.24),inset_0_1px_0_rgba(255,255,255,0.78)] transition-[box-shadow,filter] duration-200 ease-out hover:shadow-[0_14px_26px_rgba(69,10,10,0.3),inset_0_1px_0_rgba(255,255,255,0.78)] active:brightness-105'
                        : 'gap-0.5 px-1 py-0.5 shadow-[0_5px_14px_rgba(69,10,10,0.12),inset_0_1px_0_rgba(255,255,255,0.72)]',
                )}
                style={{
                    background: 'linear-gradient(135deg, #FFF7CC 0%, #FFD76A 48%, #F59E0B 100%)',
                    transform: isHero ? 'translate3d(0px, 0px, 0px) rotate(0deg)' : undefined,
                    transformOrigin: isHero ? '50% -12px' : undefined,
                }}
            >
                <span className="pointer-events-none absolute inset-x-2 top-0.5 h-[38%] rounded-full bg-white/45 blur-[2px]" />
                {isHero && (
                    <>
                        <span className="absolute left-[26%] top-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-amber-200 bg-[#7f0615] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]" />
                        <span className="absolute right-[26%] top-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-amber-200 bg-[#7f0615] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]" />
                    </>
                )}
                <span
                    className={cn(
                        'relative z-10 inline-flex items-center gap-0.5 rounded-full font-black leading-none text-red-950',
                        isHero ? 'px-1.5 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[8px]',
                    )}
                >
                <Star
                    className={cn(
                        'fill-red-950 text-red-950',
                        isHero ? 'h-2 w-2' : 'h-1.5 w-1.5',
                    )}
                />
                {HONORS_SCORE_LABEL}
                </span>
                <span className={cn('relative z-10 h-3.5 w-px bg-red-950/20', isHero && 'h-4')} />
                <span
                    className={cn(
                        'relative z-10 rounded-full bg-gradient-to-b from-[#7f0615] via-[#5d000b] to-[#3f0006] font-black tabular-nums leading-none text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
                        isHero ? 'px-2 py-0.5 text-[10.5px]' : 'px-1.5 py-0.5 text-[10px]',
                    )}
                >
                    {value}
                </span>
            </div>
        </div>
    )
}

function InteractiveTopRankTag({ className }: { className?: string }) {
    const [motion, setMotion] = useState({ rotate: 0, x: 0, y: 0 })

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const nx = (event.clientX - rect.left) / rect.width - 0.5
        const ny = (event.clientY - rect.top) / rect.height - 0.5

        setMotion({
            rotate: Math.max(-6, Math.min(6, nx * 10)),
            x: nx * 4,
            y: ny * 2.5,
        })
    }

    const handlePointerLeave = () => {
        setMotion({ rotate: 0, x: 0, y: 0 })
    }

    return (
        <div
            className={cn('absolute z-30 -m-2 p-2 [perspective:420px] pointer-events-auto cursor-pointer touch-none', className)}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            aria-label="Top 1"
        >
            <div
                className="group/top-tag relative flex items-center gap-1.5 overflow-hidden rounded-full border border-white/[0.18] bg-white/10 px-2.5 py-1 shadow-[0_8px_18px_rgba(69,10,10,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm transition-transform duration-200 ease-out will-change-transform"
                style={{
                    transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotate}deg)`,
                    transformOrigin: '18% 50%',
                }}
            >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.13] via-white/[0.03] to-transparent opacity-80" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.85)] transition-transform duration-200 group-hover/top-tag:scale-125" />
                <span className="relative text-[9px] font-black text-white/[0.85] tracking-[0.16em] uppercase">
                    Top 1
                </span>
            </div>
        </div>
    )
}

// ─── Vinh Danh Tab ────────────────────────────────────────────────────────────

function HonorsTab({ onOpenPopup }: { onOpenPopup?: () => void }) {
    const { data, isLoading } = useSWR<TopTeachersResponse>(
        '/api/truyenthong/top-teachers',
        fetcher,
        { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 15_000 }
    )

    const teachers = data?.success && Array.isArray(data.data) ? data.data : []
    const top1 = teachers[0]
    const top2 = teachers[1]
    const top3 = teachers[2]

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col gap-3 p-4 animate-pulse">
                <div className="h-36 rounded-2xl bg-amber-100/60" />
                <div className="h-14 rounded-xl bg-gray-100" />
                <div className="h-14 rounded-xl bg-gray-100" />
                <div className="h-10 rounded-xl bg-gray-100 mt-auto" />
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(255,237,213,0.48),transparent_38%),linear-gradient(180deg,#ffffff_0%,#fffafa_100%)]">

            {/* ── TOP 1 HERO CARD ── */}
            <div className="mx-3.5 mt-3.5 mb-0 relative rounded-[1.35rem] overflow-hidden flex-shrink-0 group cursor-default border border-red-100/20"
                style={{
                    background: 'radial-gradient(circle at 74% 18%, rgba(255, 214, 120, 0.2) 0%, transparent 32%), radial-gradient(circle at 22% 12%, rgba(255, 255, 255, 0.12) 0%, transparent 28%), linear-gradient(145deg, #9F171F 0%, #7A0914 46%, #4A0308 100%)',
                    boxShadow: '0 14px 34px -16px rgba(69,10,10,0.7), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -18px 34px rgba(69,10,10,0.22)',
                }}
            >
                {/* Grain texture overlay */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

                <div className="absolute inset-x-6 bottom-9 h-px bg-gradient-to-r from-transparent via-amber-200/[0.18] to-transparent pointer-events-none" />
                <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-amber-300/[0.16] blur-2xl pointer-events-none" />
                <div className="absolute -left-16 bottom-0 h-28 w-44 rounded-full bg-red-300/10 blur-2xl pointer-events-none" />

                <InteractiveTopRankTag className="left-3 top-3" />

                <Cr45MetricBadge score={top1?.total_score} variant="hero" className="absolute right-3 top-0.5" />

                <div className="px-4 pt-9 pb-5 text-center relative z-10">
                    {/* Avatar with ring */}
                    <div className="relative inline-flex items-center justify-center mb-4">
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-full scale-150 opacity-35"
                            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.42) 0%, transparent 70%)' }} />
                        <div className="relative z-10 flex h-[5.35rem] w-[5.35rem] items-center justify-center overflow-hidden rounded-full border-[5px] border-white/[0.26] shadow-2xl ring-4 ring-amber-300/[0.24]"
                            style={{ background: 'linear-gradient(145deg, #B93A32 0%, #7A0914 100%)' }}>
                            <TeacherAvatar
                                teacher={top1}
                                className="w-full h-full object-cover"
                                fallbackClassName="text-white font-black text-2xl tracking-tight"
                            />
                        </div>
                        {/* Crown */}
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                            <Crown className="w-7 h-7 text-amber-300 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.86)]" />
                        </div>
                    </div>

                    <p className="text-[13px] font-black text-white leading-tight line-clamp-1 mb-0.5">
                        {top1?.full_name ?? 'Giáo viên #1'}
                    </p>
                    <p className="text-[11px] text-white/[0.58] font-medium line-clamp-1 mb-3">
                        {top1?.center ?? '—'}
                    </p>

                    {/* Bottom accent bar */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>

                {/* Shimmer animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            </div>

            {/* ── TOP 2 & 3 ── */}
            <div className="mx-3.5 mt-2.5 flex flex-col gap-2 flex-shrink-0">
                {[
                    { teacher: top2, rank: 2, fromColor: '#a83830', toColor: '#882018' },
                    { teacher: top3, rank: 3, fromColor: '#c85040', toColor: '#a83830' },
                ].map(({ teacher, rank, fromColor, toColor }) => (
                    <div key={rank}
                        className="group relative flex items-center gap-2.5 overflow-hidden rounded-[1.1rem] border border-red-100/50 bg-white/95 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50/30 cursor-default"
                        style={{ boxShadow: '0 8px 22px -18px rgba(69,10,10,0.42), inset 0 1px 0 rgba(255,255,255,0.85)' }}
                    >
                        <span
                            className="absolute inset-y-3 left-0 w-1 rounded-r-full opacity-80"
                            style={{ background: `linear-gradient(180deg, ${fromColor}, ${toColor})` }}
                        />
                        {/* Rank pill */}
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-black text-white shrink-0 shadow-[0_6px_12px_rgba(69,10,10,0.16)]"
                            style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}>
                            {rank}
                        </div>

                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 border-2 border-white shadow-sm ring-2 ring-red-100/80"
                            style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}>
                            <TeacherAvatar
                                teacher={teacher}
                                className="w-full h-full object-cover"
                                fallbackClassName="text-white font-black text-[11px]"
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-black text-slate-800 truncate group-hover:text-[#a1001f] transition-colors leading-tight">
                                {teacher?.full_name ?? `Giáo viên #${rank}`}
                            </p>
                            <p className="text-[10.5px] text-slate-400 truncate leading-tight font-medium">
                                {teacher?.center ?? '—'}
                            </p>
                        </div>

                        <Cr45MetricBadge score={teacher?.total_score} className="shrink-0" />
                    </div>
                ))}
            </div>

            {/* ── DIVIDER ── */}
            <div className="mx-3.5 mt-3 mb-0 flex items-center gap-2.5 flex-shrink-0">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(161,0,31,0.15))' }} />
                <Sparkles className="w-3 h-3 text-red-300/60 shrink-0" />
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(161,0,31,0.15))' }} />
            </div>

            {/* ── CTA ── */}
            <button
                onClick={onOpenPopup}
                className="mx-3.5 mt-3 mb-3.5 w-[calc(100%-1.75rem)] group relative flex items-center justify-center gap-2 overflow-hidden rounded-[1.05rem] px-4 py-2.5 text-xs font-black tracking-wide text-white flex-shrink-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-900/30 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #BE0028 0%, #940019 100%)', boxShadow: '0 10px 24px -14px rgba(161,0,31,0.65), inset 0 1px 0 rgba(255,255,255,0.18)' }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Trophy className="w-3.5 h-3.5 text-red-300 relative z-10 shrink-0" />
                <span className="relative z-10">Xem bảng vinh danh đầy đủ</span>
                <ChevronRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SliderSidebar({ posts, onOpenPopup }: { posts: Post[]; onOpenPopup?: () => void }) {
    const [activeTab, setActiveTab] = useState<'hot' | 'honors'>('hot')

    return (
        <div className="h-full max-h-full bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[#a1001f]" />
                    <span>Đang hot</span>
                </h3>

                {/* Tabs */}
                <div className="relative flex gap-1 p-1 bg-gray-100/80 rounded-xl">
                    {/* Sliding pill */}
                    <div
                        className="absolute inset-y-1 rounded-lg transition-all duration-300 ease-out"
                        style={{
                            left: activeTab === 'hot' ? '4px' : 'calc(50% + 2px)',
                            right: activeTab === 'honors' ? '4px' : 'calc(50% + 2px)',
                            background: '#a1001f',
                            boxShadow: '0 2px 6px -1px rgba(161,0,31,0.4)',
                        }}
                    />
                    <button
                        onClick={() => setActiveTab('hot')}
                        className={cn(
                            'relative z-10 flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300',
                            activeTab === 'hot'
                                ? 'text-white'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        Đang hot
                    </button>
                    <button
                        id="tab-vinh-danh"
                        onClick={() => setActiveTab('honors')}
                        className={cn(
                            'relative z-10 flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5',
                            activeTab === 'honors'
                                ? 'text-white'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        {activeTab === 'honors' && (
                            <Star className="w-2.5 h-2.5 fill-red-200 text-red-200 shrink-0" />
                        )}
                        <span>Vinh danh</span>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden relative grid grid-cols-1 grid-rows-1">
                {/* Đang hot — KHÔNG THAY ĐỔI */}
                <div className={cn(
                    "col-start-1 row-start-1 p-4 space-y-2.5 transition-all duration-300 overflow-y-auto",
                    activeTab === 'hot' ? "opacity-100 translate-x-0 z-10" : "opacity-0 -translate-x-full pointer-events-none z-0"
                )}>
                    {posts.map((post, index) => (
                        <Link
                            key={post.id}
                            href={`/user/truyenthong/${post.slug || post.id}`}
                            prefetch={false}
                            className="flex gap-3 group hover:bg-gradient-to-r hover:from-red-50 hover:to-orange-50 -mx-2 px-2 py-2.5 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 hover:shadow-md"
                        >
                            <div className="relative rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-md ring-1 ring-black/5 w-14 h-14">
                                <img
                                    src={normalizeStorageUrl(post.banner_image || post.featured_image) || '/placeholder-banner.jpg'}
                                    alt={post.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute top-1 left-1 w-4.5 h-4.5 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-lg shadow-red-200">
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors leading-snug mb-1">
                                    {post.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500 group-hover:text-red-600 transition-colors">
                                    <span className="font-semibold uppercase tracking-wide text-[10px]">
                                        {POST_TYPE_LABELS[post.post_type] || post.post_type}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="flex items-center gap-1 font-medium">
                                        <Eye className="w-2.5 h-2.5" />
                                        {post.view_count.toLocaleString('vi-VN')}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Vinh danh */}
                <div className={cn(
                    "col-start-1 row-start-1 flex flex-col transition-all duration-300",
                    activeTab === 'honors' ? "opacity-100 translate-x-0 z-10" : "opacity-0 translate-x-full pointer-events-none z-0"
                )}>
                    <HonorsTab onOpenPopup={onOpenPopup} />
                </div>
            </div>
        </div>
    )
}
