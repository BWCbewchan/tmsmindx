'use client';

import { useMemo, useState } from 'react';
import { Award, Calendar, Image as ImageIcon, Maximize2, Sparkles, X } from 'lucide-react';

interface GalleryItem {
  url?: string;
  src?: string;
  caption?: string;
  title?: string;
  type?: string;
  category?: string;
}

type TabType = 'certificates' | 'activities' | 'events';

function categorizeItem(item: any): TabType {
  const src = typeof item === 'string' ? item : item.url || item.src || '';
  const text = (
    typeof item === 'string'
      ? item
      : `${item.type || ''} ${item.category || ''} ${item.caption || ''} ${item.title || ''} ${src}`
  ).toLowerCase();

  if (/certificate|chung_chi|chứng chỉ|chứng nhận|bằng|diploma|giấy khen|giải thưởng|bang cap/i.test(text)) {
    return 'certificates';
  }

  if (/sự kiện|su_kien|event|workshop|hackathon|cuộc thi|lễ trao giải|demo day|hội thảo|exhibition/i.test(text)) {
    return 'events';
  }

  return 'activities';
}

export function GalleryShowcase({
  gallery,
  achievements = [],
}: {
  gallery: any[];
  achievements?: any[];
}) {
  const { certificates, activities, events } = useMemo(() => {
    const certs: any[] = [];
    const acts: any[] = [];
    const evts: any[] = [];

    (gallery || []).forEach((item) => {
      const cat = categorizeItem(item);
      if (cat === 'certificates') certs.push(item);
      else if (cat === 'events') evts.push(item);
      else acts.push(item);
    });

    return { certificates: certs, activities: acts, events: evts };
  }, [gallery]);

  // Determine initial active tab (defaulting to the first category with items, or 'certificates')
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (certificates.length > 0) return 'certificates';
    if (activities.length > 0) return 'activities';
    if (events.length > 0) return 'events';
    return 'certificates';
  });

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  if (!gallery || gallery.length === 0) return null;

  const currentItems =
    activeTab === 'certificates'
      ? certificates
      : activeTab === 'events'
      ? events
      : activities;

  return (
    <div className="space-y-6">
      {/* 3 Menu Tabs: Chứng chỉ | Hoạt động | Sự kiện */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e5ded5] pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'certificates'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Chứng chỉ ({certificates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'activities'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          <span>Hoạt động ({activities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'events'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Sự kiện ({events.length})</span>
        </button>
      </div>

      {/* Image Grid for Active Tab */}
      {currentItems.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {currentItems.map((img: any, idx: number) => {
            const src = typeof img === 'string' ? img : img.url || img.src || '';
            const caption = typeof img === 'string' ? '' : img.caption || img.title || '';
            return (
              <div
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#e4dcd0] bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <img
                  src={src}
                  alt={caption || `Hình ảnh ${idx + 1}`}
                  className="h-56 w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-[#171512] shadow-md backdrop-blur-md">
                    <Maximize2 className="h-3.5 w-3.5 text-[#bd0026]" /> Xem Phóng to
                  </span>
                </div>
                {caption ? <p className="p-4 text-xs font-extrabold text-[#3b352f]">{caption}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State for Selected Category */
        <div className="rounded-2xl border border-dashed border-[#ded6c9] bg-white p-12 text-center text-[#777067]">
          <Sparkles className="mx-auto h-8 w-8 text-[#bd0026]/40 mb-3" />
          <p className="font-extrabold text-base text-[#171512]">Chưa có hình ảnh ở mục này</p>
          <p className="mt-1 text-xs text-[#8c8275]">
            Hình ảnh thuộc danh mục này sẽ được cập nhật trong quá trình học tập.
          </p>
        </div>
      )}

      {/* Fullscreen Gallery Lightbox Modal */}
      {activeImageIndex !== null && currentItems[activeImageIndex] && (
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
              const item = currentItems[activeImageIndex];
              const src = typeof item === 'string' ? item : item.url || item.src || '';
              const caption = typeof item === 'string' ? '' : item.caption || item.title || '';
              return (
                <>
                  <img src={src} alt={caption || 'Hình ảnh'} className="max-h-[80vh] w-full object-contain" />
                  {caption ? (
                    <div className="p-4 text-center bg-[#171512] border-t border-white/10 text-white font-extrabold text-sm">
                      {caption}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
