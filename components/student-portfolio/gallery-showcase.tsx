'use client';

import { useState } from 'react';
import { Maximize2, X } from 'lucide-react';

export function GalleryShowcase({ gallery }: { gallery: any[] }) {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  if (!gallery || gallery.length === 0) return null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((img: any, idx: number) => {
          const src = typeof img === 'string' ? img : img.url;
          const caption = typeof img === 'string' ? '' : img.caption;
          return (
            <div
              key={idx}
              onClick={() => setActiveImageIndex(idx)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#e4dcd0] bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <img
                src={src}
                alt={caption || `Gallery image ${idx + 1}`}
                className="h-56 w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-black text-[#171512] shadow-md backdrop-blur-md">
                  <Maximize2 className="h-3.5 w-3.5 text-[#bd0026]" /> Xem Phóng to
                </span>
              </div>
              {caption ? <p className="p-4 text-xs font-bold text-[#423d37]">{caption}</p> : null}
            </div>
          );
        })}
      </div>

      {/* Fullscreen Gallery Lightbox Modal */}
      {activeImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-5 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveImageIndex(null)}
        >
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-[#171512] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveImageIndex(null)}
              className="absolute top-4 right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-[#bd0026] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {(() => {
              const item = gallery[activeImageIndex];
              const src = typeof item === 'string' ? item : item.url;
              const caption = typeof item === 'string' ? '' : item.caption;
              return (
                <>
                  <img src={src} alt={caption || 'Gallery Image'} className="max-h-[80vh] w-full object-contain" />
                  {caption ? (
                    <div className="p-4 text-center bg-[#171512] border-t border-white/10 text-white font-bold text-sm">
                      {caption}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
