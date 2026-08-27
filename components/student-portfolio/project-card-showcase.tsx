'use client';

import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  Bot,
  Brush,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  Gamepad2,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';

interface ProjectItem {
  title: string;
  course?: string;
  imageUrl?: string | string[];
  imageUrls?: string[];
  videoUrls?: string[];
  attachmentUrls?: string[];
  relatedUrls?: Array<{ name?: string; url: string }>;
  description?: string;
  link?: string;
  attachmentName?: string;
  featured?: boolean;
}

type Track = 'coding' | 'robotics' | 'art';

const TRACKS: Record<Track, {
  label: string;
  icon: ElementType;
  symbol: ElementType;
  shell: string;
  badge: string;
  button: string;
  wash: string;
}> = {
  coding: {
    label: 'Coding',
    icon: Code2,
    symbol: Code2,
    shell: 'from-[#21050a] via-[#7d0019] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#bd0026]',
  },
  robotics: {
    label: 'Robotics',
    icon: Bot,
    symbol: Bot,
    shell: 'from-[#26040a] via-[#830018] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#0ea5e9]',
  },
  art: {
    label: 'Art',
    icon: Brush,
    symbol: Brush,
    shell: 'from-[#2a050b] via-[#8b001b] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#f59e0b]',
  },
};

function normalize(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
}

function detectTrack(value?: string): Track | null {
  const text = normalize(value);
  if (/\b(rob[a-z0-9]*|robot[a-z0-9]*|robotics)\b/.test(text)) return 'robotics';
  if (/\b(c4k[a-z0-9]*|c4t[a-z0-9]*|pt[a-z0-9]*|scratch|coding|code|js[a-z0-9]*|web|cs[a-z0-9]*|computer scientist|app producer|python)\b/.test(text)) return 'coding';
  if (/\b(xart[a-z0-9]*|art|fine art|creative art|my thuat|ve thuat)\b/.test(text)) return 'art';
  return null;
}

function projectTrack(project: ProjectItem, trackHint?: string): Track {
  return detectTrack(trackHint) || detectTrack(`${project.course || ''} ${project.title || ''}`) || 'coding';
}

function uniqueUrls(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function allProjectLinks(project: ProjectItem) {
  return uniqueUrls([
    project.link,
    ...(project.videoUrls || []),
    ...(project.attachmentUrls || []),
    ...(project.relatedUrls || []).map((item) => item.url),
  ]);
}

function isImageFileUrl(url?: string) {
  const text = url || '';
  return /\/uploads\/images\//i.test(text) || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(text);
}

function allProjectImages(project: ProjectItem) {
  const imageUrlImages = Array.isArray(project.imageUrl) ? project.imageUrl.filter(isImageFileUrl) : [];
  const explicitImages = uniqueUrls([
    ...imageUrlImages,
    ...(project.imageUrls || []),
    ...(project.attachmentUrls || []).filter(isImageFileUrl),
    ...(project.relatedUrls || []).map((item) => item.url).filter(isImageFileUrl),
  ]);
  const fallbackImage = typeof project.imageUrl === 'string' && isImageFileUrl(project.imageUrl) ? project.imageUrl : '';
  return uniqueUrls([...explicitImages, fallbackImage]);
}

function youtubeEmbedUrl(url?: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1` : null;
}

function scratchPlayerUrl(url?: string) {
  if (!url) return null;
  const scratchMatch = url.match(/scratch\.mit\.edu\/projects\/(\d+)/i);
  if (scratchMatch) return `https://turbowarp.org/${scratchMatch[1]}/embed?autoplay`;
  if (url.toLowerCase().split('?')[0].endsWith('.sb3')) {
    return `https://turbowarp.org/embed.html?project_url=${encodeURIComponent(url)}&autoplay=true&settings-button=true&fullscreen=true`;
  }
  return null;
}

function fileNameFromUrl(url: string, fallback: string) {
  const clean = url.split('?')[0].split('#')[0];
  return decodeURIComponent(clean.split('/').pop() || fallback);
}

export function ProjectCardShowcase({ project, defaultCourse, trackHint }: { project: ProjectItem; defaultCourse?: string; trackHint?: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [player, setPlayer] = useState<{ url: string; title: string } | null>(null);
  const track = projectTrack(project, trackHint);
  const theme = TRACKS[track];
  const ThemeIcon = theme.icon;
  const SymbolIcon = theme.symbol;

  const images = useMemo(() => allProjectImages(project), [project]);
  const links = useMemo(() => allProjectLinks(project), [project]);
  const youtube = links.map(youtubeEmbedUrl).find(Boolean) || null;
  const scratch = links.map(scratchPlayerUrl).find(Boolean) || null;
  const downloadableAttachments = (project.attachmentUrls || []).filter((url) => !isImageFileUrl(url));

  const nextImage = () => {
    if (lightboxIndex === null || images.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % images.length);
  };

  const prevImage = () => {
    if (lightboxIndex === null || images.length === 0) return;
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  };

  return (
    <>
      <article className="group relative overflow-hidden rounded-[26px] border border-[#ded6c9] bg-[#fffaf2] shadow-[0_18px_55px_rgba(23,21,18,0.10)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(23,21,18,0.14)]">
        <div className={`absolute -right-12 -top-16 h-44 w-44 rounded-full ${theme.wash} opacity-10 blur-2xl`} />
        <div className={`relative overflow-hidden bg-gradient-to-br ${theme.shell} p-4 sm:p-5`}>
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
            <div className="absolute -right-8 top-5 text-white/10">
              <SymbolIcon className="h-48 w-48" strokeWidth={1.25} />
            </div>

            {youtube ? (
              <iframe
                src={youtube}
                title={project.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="relative h-[280px] w-full rounded-[20px] border-0 bg-black shadow-2xl sm:h-[340px]"
              />
            ) : images.length ? (
              <div className={`relative grid min-h-[280px] gap-3 sm:h-[340px] ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {images.slice(0, 3).map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="relative overflow-hidden rounded-[20px] bg-white/10 text-left shadow-2xl ring-1 ring-white/15"
                    aria-label={`Xem ảnh sản phẩm ${index + 1}`}
                  >
                    <img
                      src={image}
                      alt={`${project.title} ${index + 1}`}
                      className="h-full w-full object-cover transition duration-500 group-hover:saturate-110"
                    />
                    <span className="absolute inset-0 bg-black/10 opacity-0 transition group-hover:opacity-100" />
                    {index === Math.min(images.length, 3) - 1 && images.length > 3 ? (
                      <span className="absolute inset-0 grid place-items-center bg-black/45 text-2xl font-black text-white">
                        +{images.length - 3}
                      </span>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/92 px-4 py-2 text-xs font-black text-[#171512] shadow-lg backdrop-blur"
                >
                  <Maximize2 className="h-4 w-4 text-[#bd0026]" />
                  Xem ảnh lớn
                </button>
              </div>
            ) : (
              <div className="relative grid h-[280px] place-items-center rounded-[20px] bg-white/10 p-8 text-white shadow-2xl ring-1 ring-white/15 sm:h-[340px]">
                <div className="text-center">
                  <ThemeIcon className="mx-auto h-16 w-16" />
                  <p className="mt-4 text-sm font-black">Sản phẩm cuối khóa</p>
                </div>
              </div>
            )}

            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${theme.badge}`}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </span>
              {project.featured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1 text-[11px] font-black text-white backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Nổi bật
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative flex flex-col justify-between p-6 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase text-[#bd0026]">{project.course || defaultCourse || 'MindX Project'}</p>
              <h3 className="mt-3 text-2xl font-black leading-tight text-[#171512] sm:text-3xl">
                {project.title || 'Sản phẩm học viên'}
              </h3>
              <p className="mt-4 line-clamp-4 text-sm font-medium leading-7 text-[#55504a]">
                {project.description || 'Sản phẩm thể hiện quá trình học tập, thử nghiệm và hoàn thiện ý tưởng của học viên tại MindX.'}
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <div className="flex flex-wrap gap-2">
                {scratch ? (
                  <button
                    type="button"
                    onClick={() => setPlayer({ url: scratch, title: project.title || 'Scratch project' })}
                    className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-black shadow-sm transition hover:-translate-y-0.5 ${theme.button}`}
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Trải nghiệm
                  </button>
                ) : null}
                {!scratch && !youtube && project.link ? (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ded6c9] bg-white px-4 text-xs font-black text-[#423d37] transition hover:border-[#bd0026] hover:text-[#bd0026]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {project.attachmentName || 'Mở sản phẩm'}
                  </a>
                ) : null}
              </div>

              {!scratch && downloadableAttachments.length ? (
                <div className="flex flex-wrap gap-2 border-t border-[#eee5d8] pt-3">
                  {downloadableAttachments.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eadb] px-3 py-1.5 text-[11px] font-bold text-[#423d37] hover:bg-[#eadcc7]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {fileNameFromUrl(url, `File ${index + 1}`)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
      </article>

      {lightboxIndex !== null && images.length ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[#080605]/90 p-4 backdrop-blur-xl"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#111] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Đóng ảnh"
            >
              <X className="h-5 w-5" />
            </button>
            {images.length > 1 ? (
              <>
                <button type="button" onClick={prevImage} className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Ảnh trước">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" onClick={nextImage} className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Ảnh sau">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            ) : null}
            <div className="grid max-h-[82vh] place-items-center bg-black">
              <img src={images[lightboxIndex]} alt={project.title} className="max-h-[82vh] w-full object-contain" />
            </div>
            <div className="flex items-center justify-between gap-4 bg-[#15110f] px-5 py-4 text-white">
              <div>
                <p className="text-sm font-black">{project.title}</p>
                <p className="text-xs text-white/60">{project.course || defaultCourse || theme.label}</p>
              </div>
              <p className="text-xs font-bold text-white/60">{lightboxIndex + 1} / {images.length}</p>
            </div>
          </div>
        </div>
      ) : null}

      {player ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-[#080605]/88 p-4 backdrop-blur-xl" onClick={() => setPlayer(null)}>
          <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#111] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#16120f] px-5 py-4 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                  <Gamepad2 className="h-5 w-5 text-[#facc15]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{player.title}</p>
                </div>
              </div>
              <button type="button" onClick={() => setPlayer(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Đóng preview">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={player.url}
                title={player.title}
                className="h-full w-full border-0"
                allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
