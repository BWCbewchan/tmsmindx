import { cookies } from 'next/headers';
import { verifySessionCookieValue, TPS_SESSION_COOKIE } from '@/lib/session-cookie';
import { getPublishedPortfolioBySlug } from '@/lib/student-portfolio/service';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';
import { Award, ExternalLink, Sparkles, Star, CheckCircle2, Code2, BookOpen, Layers, Trophy, Lock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectCardShowcase } from '@/components/student-portfolio/project-card-showcase';
import { GalleryShowcase } from '@/components/student-portfolio/gallery-showcase';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function DnaRadarChart({ scores }: { scores: Array<{ label: string; value: number }> }) {
  const items = scores && scores.length > 0 ? scores : [
    { label: 'Tư duy Logic & Thuật toán', value: 4.5 },
    { label: 'Kỹ thuật Lập trình', value: 4.6 },
    { label: 'Giải quyết Vấn đề', value: 4.3 },
    { label: 'Hoàn thiện Sản phẩm', value: 4.7 },
    { label: 'Tự học & Sáng tạo', value: 4.4 },
  ];

  const size = 300;
  const center = size / 2;
  const radius = 95;
  const total = items.length;

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = (val / 5) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  };

  const polygonPoints = items
    .map((item, i) => {
      const { x, y } = getCoordinates(i, item.value);
      return `${x},${y}`;
    })
    .join(' ');

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <svg width={size} height={size} className="overflow-visible">
        {gridLevels.map((lvl, idx) => {
          const levelPoints = items
            .map((_, i) => {
              const { x, y } = getCoordinates(i, 5 * lvl);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={idx}
              points={levelPoints}
              fill={idx % 2 === 0 ? 'rgba(230, 223, 212, 0.3)' : 'none'}
              stroke="#ded6c9"
              strokeWidth="1.5"
              strokeDasharray={idx === gridLevels.length - 1 ? 'none' : '3 3'}
            />
          );
        })}

        {items.map((_, i) => {
          const { x, y } = getCoordinates(i, 5);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#d8d0c2"
              strokeWidth="1.5"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(189, 0, 38, 0.22)"
          stroke="#bd0026"
          strokeWidth="3"
        />

        {items.map((item, i) => {
          const { x, y, angle } = getCoordinates(i, item.value);
          const labelDist = radius + 32;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="#bd0026" />
              <circle cx={x} cy={y} r="9" fill="rgba(189, 0, 38, 0.25)" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-[#171512] text-[11px] font-black"
              >
                {item.label} ({item.value})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DnaBarChart({ scores }: { scores: Array<{ label: string; value: number }> }) {
  const items = scores && scores.length > 0 ? scores : [
    { label: 'Kỹ năng Lập trình & Thiết kế', value: 4.5 },
    { label: 'Hoàn thiện Sản phẩm', value: 4.6 },
    { label: 'Thuyết trình Dự án', value: 4.3 },
    { label: 'Làm việc Nhóm', value: 4.4 },
  ];

  return (
    <div className="space-y-4 p-2">
      {items.map((item, idx) => {
        const pct = Math.max(0, Math.min(100, (item.value / 5) * 100));
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#171512]">
              <span>{item.label}</span>
              <span className="font-black text-[#bd0026]">{item.value} / 5</span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#f0eae1] p-0.5 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#bd0026] to-[#ff4d6d] transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function PublicPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const portfolio = await getPublishedPortfolioBySlug(decodeURIComponent(slug));
  if (!portfolio) notFound();

  const data = portfolio.data as StudentPortfolioData;
  const profile = data.profile;
  const defaultIsPrivate = portfolio.status === 'draft' || data.visibility === 'private';
  const isPrivateMode = query.mode ? query.mode === 'private' : defaultIsPrivate;
  const isPublicMode = !isPrivateMode;

  const academicItems = [
    { label: 'Checkpoint 1', value: data.academicSummary?.checkpoint1Score },
    { label: 'Checkpoint 2', value: data.academicSummary?.checkpoint2Score },
    { label: 'SPCK / Demo Score', value: data.academicSummary?.demoScore },
    { label: 'TBCK Score', value: data.academicSummary?.tbckScore },
    {
      label: 'Xếp loại học tập',
      value: data.academicSummary?.rank ? `${data.academicSummary.rank} ${data.academicSummary.rankLabel ? `- ${data.academicSummary.rankLabel}` : ''}` : '',
    },
  ].filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

  const allSkills = isPublicMode ? [...(data.hardSkills || []), ...(data.softSkills || [])] : [];
  const hasJourney = Boolean(data.learningJourney && data.learningJourney.length > 0);
  const hasProjects = Boolean(data.projects && data.projects.length > 0);
  const hasResults = Boolean(academicItems.length > 0);

  // Manual customized sections ONLY render in Bản tùy chỉnh (isPublicMode)!
  const hasSkills = isPublicMode && Boolean(allSkills.length > 0);
  const hasDna = isPublicMode && Boolean((data.dnaScores && data.dnaScores.length > 0) || (data.mindsetScores && data.mindsetScores.length > 0));
  const hasAchievements = isPublicMode && Boolean(data.achievements && data.achievements.length > 0);
  const hasGallery = isPublicMode && Boolean(data.gallery && data.gallery.length > 0);
  const hasRewards = isPublicMode && Boolean((data.rewards && data.rewards.points > 0) || (data.rewards && data.rewards.history && data.rewards.history.length > 0));

  const courseGradients = [
    'from-amber-400 via-orange-500 to-rose-500',
    'from-blue-500 via-indigo-600 to-violet-600',
    'from-emerald-400 via-teal-500 to-cyan-600',
  ];

  return (
    <main className="scroll-smooth min-h-screen bg-[#f7f3ec] text-[#171512] font-sans antialiased">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 border-b border-[#ded6c9] bg-[#f7f3ec]/90 backdrop-blur-md transition-all duration-300">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight text-[#bd0026]">
              Mind<span className="text-[#171512]">X</span>
            </span>
            <span className="h-4 w-px bg-[#d8d0c2]" />
            <span className="font-extrabold text-[#423d37]">Student Portfolio</span>
          </div>
          <div className="hidden items-center gap-7 font-bold text-[#55504a] sm:flex">
            {hasJourney ? <a href="#journey" className="hover:text-[#bd0026] transition-colors duration-200">Lộ trình</a> : null}
            {hasProjects ? <a href="#projects" className="hover:text-[#bd0026] transition-colors duration-200">Sản phẩm</a> : null}
            {hasDna ? <a href="#dna" className="hover:text-[#bd0026] transition-colors duration-200">DNA Năng lực</a> : null}
            {hasResults ? <a href="#results" className="hover:text-[#bd0026] transition-colors duration-200">Kết quả</a> : null}
            {hasGallery ? <a href="#gallery" className="hover:text-[#bd0026] transition-colors duration-200">Hình ảnh</a> : null}
            {hasAchievements ? <a href="#awards" className="hover:text-[#bd0026] transition-colors duration-200">Thành tích</a> : null}
            {hasRewards ? <a href="#rewards" className="hover:text-[#bd0026] transition-colors duration-200">Điểm thưởng</a> : null}
          </div>
          {hasProjects ? (
            <a
              href="#projects"
              className="rounded-full bg-[#bd0026] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#a00020] hover:shadow-md transition-all duration-200"
            >
              Khám phá Dự án
            </a>
          ) : null}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto grid min-h-[580px] max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_420px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-bold text-[#bd0026]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isPrivateMode ? 'Bản thô (Dữ liệu tự động LMS)' : 'Bản tùy chỉnh (MindX Verified)'}</span>
          </div>
          <h1 className="text-5xl font-black leading-[1.18] tracking-tight text-[#171512] sm:text-6xl md:text-7xl lg:text-8xl">
            {profile.studentName}
            <span className="text-[#bd0026]">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-[#423d37]">
            {profile.headline || profile.intro}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasProjects ? (
              <a
                href="#projects"
                className="inline-flex items-center gap-2 rounded-full bg-[#bd0026] px-7 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#a00020] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                Khám phá sản phẩm <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {profile.className ? (
              <span className="rounded-full border border-[#ded6c9] bg-white px-5 py-3.5 text-sm font-bold text-[#423d37] shadow-sm">
                Lớp: {profile.className}
              </span>
            ) : null}
          </div>
        </div>

        {/* 3D Glassmorphism Student ID Card */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-[#bd0026]/15 blur-2xl" />
          <div className="relative rotate-2 rounded-[28px] bg-gradient-to-br from-[#80001a] via-[#bd0026] to-[#40000d] p-8 text-white shadow-2xl transition-all duration-500 ease-out hover:rotate-0 hover:scale-[1.03] hover:shadow-rose-900/30">
            <div className="flex items-center justify-between">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black border border-white/20 backdrop-blur-md">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.studentName} className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  <span>{initials(profile.studentName)}</span>
                )}
              </div>
              <div className="text-right">
                <span className="rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white/90">
                  {profile.courseLine || 'MindX Student'}
                </span>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Học viên MindX</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">{profile.studentName}</h2>
              <p className="mt-1 text-sm font-medium text-white/80">{profile.courseName || profile.className}</p>
              {profile.centreName ? (
                <p className="mt-0.5 text-xs text-white/60">Cơ sở: {profile.centreName}</p>
              ) : null}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 rounded-2xl bg-black/20 p-4 text-center border border-white/10 backdrop-blur-md">
              <div>
                <p className="text-2xl font-black">{data.learningJourney?.length || 1}</p>
                <p className="text-[10px] font-bold uppercase text-white/60">Khóa học</p>
              </div>
              <div>
                <p className="text-2xl font-black">{data.projects?.length || 1}</p>
                <p className="text-[10px] font-bold uppercase text-white/60">Sản phẩm</p>
              </div>
              <div>
                <p className="text-2xl font-black">4.8</p>
                <p className="text-[10px] font-bold uppercase text-white/60">Điểm DNA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Contrast Intro & Skills Bar */}
      <section className="bg-[#171512] py-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[240px_1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">01 · Giới thiệu</p>
            <h3 className="mt-2 text-2xl font-black leading-snug">Hành trình & Kỹ năng nổi bật.</h3>
          </div>
          <div>
            <p className="text-xl font-medium leading-relaxed text-white/90">
              {profile.intro || `${profile.studentName} đang theo học các khóa học công nghệ và sáng tạo sản phẩm thực tế tại hệ thống trường học MindX.`}
            </p>
            {allSkills.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2.5">
                {allSkills.map((skill, index) => (
                  <span
                    key={`${skill.name}-${index}`}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white/90 backdrop-blur-sm hover:bg-white/20 transition-all duration-200"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Red Stat Banner */}
      <section className="bg-[#bd0026] py-10 text-white shadow-lg">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 text-center md:grid-cols-4">
          <div className="border-r border-white/20 last:border-0">
            <p className="text-4xl font-black">{data.learningJourney?.length || 1}+</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Khóa / Lộ trình học</p>
          </div>
          <div className="border-r border-white/20 last:border-0">
            <p className="text-4xl font-black">{data.projects?.length || 1}+</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Sản phẩm hoàn thành</p>
          </div>
          <div className="border-r border-white/20 last:border-0">
            <p className="text-4xl font-black">100%</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Chất lượng Kiểm định</p>
          </div>
          <div>
            <p className="text-4xl font-black">4.8 / 5</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-white/80">Đánh giá Năng lực DNA</p>
          </div>
        </div>
      </section>

      {/* Learning Journey Section */}
      {hasJourney ? (
        <section id="journey" className="mx-auto max-w-6xl px-5 py-24 scroll-mt-12">
          <div className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">02 · Learning Journey</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.25] text-[#171512]">Học đến đâu, làm ra đến đó.</h2>
            <p className="mt-3 text-base text-[#55504a]">Mỗi môn học là một cột mốc tích lũy kỹ năng và tạo ra sản phẩm hoàn chỉnh.</p>
          </div>

          <div className="space-y-8 border-l-2 border-[#ded6c9] pl-6 md:pl-8">
            {(data.learningJourney || []).map((item: StudentPortfolioData['learningJourney'][number], index: number) => {
              const grad = courseGradients[index % courseGradients.length];
              return (
                <div key={`${item.title}-${index}`} className="relative grid gap-6 md:grid-cols-[220px_1fr]">
                  <span className="absolute -left-[31px] md:-left-[39px] top-6 h-5 w-5 rounded-full border-4 border-[#f7f3ec] bg-[#bd0026] shadow-sm" />
                  <div>
                    <h3 className="text-lg font-black leading-snug text-[#171512]">{item.title}</h3>
                    <p className="mt-1 text-xs font-bold text-[#777067]">{item.period || item.code}</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[#ded6c9] bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <span className="text-xs font-black uppercase tracking-wider text-[#bd0026]">{item.code || profile.className}</span>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          item.status === 'Đã hoàn thành'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status || 'Đang diễn ra'}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#423d37]">
                      {item.description || 'Hoàn thiện các yêu cầu học thuật và bài tập kiểm tra trong lộ trình môn học.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Projects Section */}
      {hasProjects ? (
        <section id="projects" className="mx-auto max-w-6xl px-5 py-20 scroll-mt-12">
          <div className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">03 · Featured Projects</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.18] tracking-tight text-[#171512]">Dự án sau khóa & tự khởi xướng.</h2>
            <p className="mt-3 text-base text-[#55504a]">Trực tiếp trải nghiệm trò chơi, sản phẩm lập trình, video hoặc ảnh phóng to sắc nét.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {(data.projects || []).map((project: StudentPortfolioData['projects'][number], index: number) => (
              <ProjectCardShowcase
                key={`${project.title}-${index}`}
                project={project}
                defaultCourse={profile.courseName || profile.className}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* DNA Competency Section with SVG Radar Chart */}
      {hasDna ? (
        <section id="dna" className="mx-auto max-w-6xl px-5 py-24 scroll-mt-12">
          <div className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">04 · Competency Analysis</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.18] tracking-tight text-[#171512]">DNA năng lực & thiên hướng.</h2>
            <p className="mt-3 text-base text-[#55504a]">Bảng phân tích trực quan hai trục năng lực cốt lõi và kỹ thuật dự án.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Nhóm 1: Radar Chart */}
            <div className="rounded-2xl border border-[#e4dcd0] bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="mb-6 flex items-center justify-between border-b border-[#e4dcd0] pb-4">
                <h3 className="font-black text-xl text-[#171512]">1. Tư duy & Năng lực Cốt lõi</h3>
                <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black text-emerald-700">4.5 / 5.0</span>
              </div>
              <DnaRadarChart scores={data.dnaScores || []} />
            </div>

            {/* Nhóm 2: Bar Chart */}
            <div className="rounded-2xl border border-[#e4dcd0] bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="mb-6 flex items-center justify-between border-b border-[#e4dcd0] pb-4">
                <h3 className="font-black text-xl text-[#171512]">2. Kỹ thuật & Thực hành Dự án</h3>
                <span className="rounded-full bg-blue-50 px-3.5 py-1 text-xs font-black text-blue-700">4.6 / 5.0</span>
              </div>
              <DnaBarChart scores={data.mindsetScores || []} />
            </div>
          </div>
        </section>
      ) : null}

      {/* Checkpoint Results Section */}
      {hasResults ? (
        <section id="results" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-12">
          <div className="mb-10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">05 · Academic Results</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.18] tracking-tight text-[#171512]">Năng lực có căn cứ quan sát.</h2>
            <p className="mt-3 text-base text-[#55504a]">Kết quả điểm số các bài kiểm tra Checkpoint và xếp loại hoàn thành từ LMS.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {academicItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e4dcd0] bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#777067]">{item.label}</p>
                <p className="mt-3 text-3xl font-black text-[#bd0026]">{String(item.value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Gallery Section */}
      {hasGallery ? (
        <section id="gallery" className="mx-auto max-w-6xl px-5 py-20 scroll-mt-12">
          <div className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">06 · Image Gallery</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.18] tracking-tight text-[#171512]">Thư viện hình ảnh học tập.</h2>
            <p className="mt-3 text-base text-[#55504a]">Bấm vào hình ảnh bất kỳ để xem chế độ Lightbox phóng to chất lượng cao.</p>
          </div>
          <GalleryShowcase gallery={data.gallery} />
        </section>
      ) : null}

      {/* Achievements Section */}
      {hasAchievements ? (
        <section id="awards" className="mx-auto max-w-6xl px-5 py-20 scroll-mt-12">
          <div className="mb-10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">07 · Honors & Awards</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.25] text-[#171512]">Thành tích & dấu ấn cá nhân.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(data.achievements || []).map((award: StudentPortfolioData['achievements'][number], index: number) => (
              <article key={`${award.title}-${index}`} className="rounded-2xl border border-[#ded6c9] bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-[#bd0026] text-white shadow-sm">
                  <Award className="h-6 w-6" />
                </div>
                <h3 className="font-black text-lg text-[#171512]">{award.title}</h3>
                <p className="mt-2 text-sm text-[#777067]">{award.subtitle}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Rewards & Activities Section */}
      {hasRewards ? (
        <section id="rewards" className="mx-auto max-w-6xl px-5 py-16 scroll-mt-12">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">08 · Rewards & Activities</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-black leading-[1.25] text-[#171512]">Điểm thưởng & Hoạt động.</h2>
          </div>
          <div className="rounded-2xl border border-[#ded6c9] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#ded6c9] pb-4 mb-4">
              <span className="font-black text-lg text-[#171512]">Tổng điểm thưởng tích lũy</span>
              <span className="rounded-full bg-rose-50 px-4 py-1.5 text-base font-black text-[#bd0026]">{data.rewards?.points || 0} Điểm</span>
            </div>
            {data.rewards?.history?.length ? (
              <div className="space-y-3">
                {data.rewards.history.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#423d37]">{item.title}</span>
                    <span className="font-extrabold text-emerald-700">+{item.points || 0} pt</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Student Quote Banner */}
      <section className="bg-[#171512] px-5 py-24 text-center text-white">
        <Star className="mx-auto mb-6 h-9 w-9 text-[#bd0026]" />
        <blockquote className="mx-auto max-w-3xl text-2xl sm:text-3xl font-black leading-relaxed">
          "{data.quote || 'Mỗi lần chương trình bị lỗi là một lần mình hiểu nó rõ hơn.'}"
        </blockquote>
      </section>

      {/* MindX Red Footer */}
      <footer className="bg-[#bd0026] px-5 py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-black tracking-tight">
              Mind<span className="text-white/80">X</span>
            </p>
            <p className="text-xs text-white/80 mt-0.5">Student Portfolio System</p>
          </div>
          <p className="text-xs font-semibold text-white/80">
            Verified Portfolio by MindX Technology School · {profile.centreName || 'Trường học Công nghệ MindX'}
          </p>
        </div>
      </footer>
    </main>
  );
}
