'use client';

import { useState } from 'react';
import { Play, ExternalLink, Maximize2, X, Code2, Sparkles, MonitorPlay, Gamepad2, Eye } from 'lucide-react';
import Link from 'next/link';

interface ProjectItem {
  title: string;
  course?: string;
  imageUrl?: string;
  description?: string;
  link?: string;
  attachmentName?: string;
  featured?: boolean;
}

// Extract YouTube embed URL
function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0` : null;
}

// Extract Scratch ID for TurboWarp embed
function getScratchEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
  return match ? `https://turbowarp.org/${match[1]}/embed` : null;
}

// Detect Web Live Preview link
function isWebLivePreviewable(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('scratch.mit.edu') || lower.includes('youtube.com') || lower.includes('youtu.be')) return false;
  return lower.includes('vercel.app') || lower.includes('github.io') || lower.includes('netlify.app') || lower.includes('replit.com') || lower.includes('codepen.io');
}

export function ProjectCardShowcase({ project, defaultCourse }: { project: ProjectItem; defaultCourse?: string }) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const youtubeUrl = getYouTubeEmbedUrl(project.link);
  const scratchUrl = getScratchEmbedUrl(project.link);
  const canLiveWeb = isWebLivePreviewable(project.link);

  return (
    <>
      <article className="group overflow-hidden rounded-2xl border border-[#e4dcd0] bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        {/* Media Preview Header */}
        <div className="relative h-60 w-full overflow-hidden bg-gradient-to-br from-[#171512] via-[#2d2925] to-[#bd0026]">
          {youtubeUrl ? (
            <iframe
              src={youtubeUrl}
              title={project.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : scratchUrl ? (
            <iframe
              src={scratchUrl}
              title={`TurboWarp Scratch Game - ${project.title}`}
              allowFullScreen
              className="h-full w-full border-0 bg-black"
            />
          ) : showLivePreview && project.link ? (
            <iframe src={project.link} title={project.title} className="h-full w-full border-0 bg-white" />
          ) : project.imageUrl ? (
            <div className="relative h-full w-full cursor-pointer overflow-hidden" onClick={() => setIsLightboxOpen(true)}>
              <img
                src={project.imageUrl}
                alt={project.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-[#171512] shadow-lg backdrop-blur-md">
                  <Maximize2 className="h-3.5 w-3.5 text-[#bd0026]" /> Xem ảnh Phóng to (Lightbox)
                </span>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-white/70">
              <div className="text-center">
                <Code2 className="mx-auto h-12 w-12 stroke-[1.5] text-[#bd0026]" />
                <p className="mt-2 text-xs font-bold text-white/60">Dự án hoàn thiện học tập</p>
              </div>
            </div>
          )}

          {scratchUrl ? (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase text-white shadow-md">
              <Gamepad2 className="h-3 w-3" /> TurboWarp Scratch Live Game
            </span>
          ) : youtubeUrl ? (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase text-white shadow-md">
              <MonitorPlay className="h-3 w-3" /> YouTube Video Player
            </span>
          ) : null}
        </div>

        {/* Content Body */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#bd0026]">
              {project.course || defaultCourse || 'MindX Project'}
            </span>
            {project.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#bd0026]">
                <Sparkles className="h-3 w-3" /> Nổi bật
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 text-2xl font-black leading-snug text-[#171512]">{project.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#55504a]">
            {project.description || 'Sản phẩm hoàn thiện thể hiện đầy đủ các kỹ năng chuyên môn đã tích lũy trong môn học.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#f0eadf] pt-4">
            {canLiveWeb ? (
              <button
                type="button"
                onClick={() => setShowLivePreview(!showLivePreview)}
                className="inline-flex items-center gap-2 rounded-full border border-[#bd0026] bg-rose-50 px-4 py-2 text-xs font-bold text-[#bd0026] hover:bg-[#bd0026] hover:text-white transition-colors duration-200"
              >
                <Eye className="h-3.5 w-3.5" />
                {showLivePreview ? 'Tắt xem Live Web' : 'Xem Live Web trực tiếp'}
              </button>
            ) : null}

            {project.link ? (
              <Link
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#bd0026] hover:underline"
              >
                {project.attachmentName || 'Truy cập Link sản phẩm'} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </article>

      {/* Lightbox Modal */}
      {isLightboxOpen && project.imageUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-5 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-[#171512] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-[#bd0026] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={project.imageUrl} alt={project.title} className="max-h-[78vh] w-full object-contain" />
            <div className="p-4 text-center bg-[#171512] border-t border-white/10 text-white">
              <h4 className="font-black text-lg">{project.title}</h4>
              <p className="text-xs text-white/70 mt-0.5">{project.course || defaultCourse || 'Sản phẩm học viên'}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
