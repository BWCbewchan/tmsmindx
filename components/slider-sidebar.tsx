'use client'

import { Eye, TrendingUp, Trophy, Star, ChevronRight, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { normalizeStorageUrl } from '@/lib/storage-url'
import { useState } from 'react'
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

const fetcher = (url: string) => fetch(url).then(r => r.json())

function getInitials(name: string) {
    const p = name.trim().split(/\s+/)
    return p.length === 1 ? p[0].slice(0, 2).toUpperCase()
        : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

// ─── Vinh Danh Tab ────────────────────────────────────────────────────────────

function HonorsTab({ onOpenPopup }: { onOpenPopup?: () => void }) {
    const { data, isLoading } = useSWR<TopTeachersResponse>(
        '/api/truyenthong/top-teachers',
        fetcher,
        { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 300_000 }
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
        <div className="flex flex-col overflow-y-auto h-full">

            {/* ── TOP 1 HERO CARD ── */}
            <div className="mx-3.5 mt-3.5 mb-0 relative rounded-2xl overflow-hidden flex-shrink-0 group cursor-default"
                style={{
                    background: 'linear-gradient(to right bottom, #882018 0%, #620000 100%)',
                    boxShadow: '0 6px 20px -4px rgba(98,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
                }}
            >
                {/* Grain texture overlay */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />

                {/* Radial glow top-right */}
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)' }} />

                {/* TOP 1 label */}
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[9px] font-black text-white/80 tracking-wider uppercase">Top 1</span>
                </div>

                {/* Score badge top-right */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span className="text-[10px] font-black text-white tabular-nums">
                        {top1 ? Number(top1.total_score).toFixed(1) + '%' : '—'}
                    </span>
                </div>

                <div className="px-4 pt-8 pb-5 text-center relative z-10">
                    {/* Avatar with ring */}
                    <div className="relative inline-flex items-center justify-center mb-4">
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-full scale-150 opacity-40 animate-pulse"
                            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)' }} />
                        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl flex items-center justify-center relative z-10 ring-4 ring-amber-400/20"
                            style={{ background: '#a83830' }}>
                            {top1?.avatar_url
                                ? <img src={top1.avatar_url} alt={top1.full_name} className="w-full h-full object-cover" />
                                : <span className="text-white font-black text-2xl tracking-tight">
                                    {top1 ? getInitials(top1.full_name) : '?'}
                                </span>
                            }
                        </div>
                        {/* Crown */}
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                            <Crown className="w-7 h-7 text-amber-300 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                        </div>
                    </div>

                    <p className="text-[13px] font-black text-white leading-tight line-clamp-1 mb-0.5">
                        {top1?.full_name ?? 'Giáo viên #1'}
                    </p>
                    <p className="text-[11px] text-white/50 font-medium line-clamp-1 mb-3">
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
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-red-100/80 hover:bg-red-50/30 transition-all duration-200 group cursor-default"
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                    >
                        {/* Rank pill */}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}>
                            {rank}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 border-2 border-white shadow-sm ring-1 ring-red-100"
                            style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}>
                            {teacher?.avatar_url
                                ? <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                                : <span className="text-white font-black text-[11px]">
                                    {teacher ? getInitials(teacher.full_name) : '?'}
                                </span>
                            }
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-800 truncate group-hover:text-[#a1001f] transition-colors leading-tight">
                                {teacher?.full_name ?? `Giáo viên #${rank}`}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate leading-tight">
                                {teacher?.center ?? '—'}
                            </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-[11px] font-black text-gray-600 tabular-nums">
                                {teacher ? Number(teacher.total_score).toFixed(1) + '%' : '—'}
                            </span>
                        </div>
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
                className="mx-3.5 mt-3 mb-3.5 w-[calc(100%-1.75rem)] group relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-xs font-bold tracking-wide overflow-hidden flex-shrink-0 transition-all duration-300 hover:shadow-lg hover:shadow-red-900/30 active:scale-[0.98]"
                style={{ background: '#a1001f', boxShadow: '0 3px 10px -2px rgba(161,0,31,0.35)' }}
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
