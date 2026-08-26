import { getPublishedPortfolioBySlug } from '@/lib/student-portfolio/service';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';
import { Award, ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-[#25221f]">
        <span>{label}</span>
        <span className="text-[#bd0026]">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-[#e6dfd4]">
        <div className="h-full rounded-full bg-[#bd0026]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portfolio = await getPublishedPortfolioBySlug(decodeURIComponent(slug));
  if (!portfolio) notFound();

  const data = portfolio.data as StudentPortfolioData;
  const profile = data.profile;
  const customContent = (title: string) =>
    data.customSections.find((section) => section.title === title)?.content || '';
  const academicItems = [
    { label: 'Checkpoint 1', value: customContent('Checkpoint 1') || data.academicSummary?.checkpoint1Score },
    { label: 'Checkpoint 2', value: customContent('Checkpoint 2') || data.academicSummary?.checkpoint2Score },
    { label: 'SPCK / Demo', value: customContent('Demo Score') || data.academicSummary?.demoScore },
    { label: 'TBCK', value: customContent('TBCK') || data.academicSummary?.tbckScore },
    {
      label: 'Xếp loại',
      value: customContent('Xếp loại') ||
        (data.academicSummary?.rank ? `${data.academicSummary.rank} - ${data.academicSummary.rankLabel || ''}` : ''),
    },
  ].filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');
  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#171512]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 text-xs font-bold uppercase tracking-wide">
        <div className="flex items-center gap-3">
          <div className="text-[#bd0026]">
            <span className="text-lg font-black lowercase">mindX</span>
          </div>
          <span className="h-4 w-px bg-[#d8d0c2]" />
          <span>Student Portfolio</span>
        </div>
        <div className="hidden items-center gap-6 text-[#777067] sm:flex">
          <a href="#journey">Hành trình</a>
          <a href="#projects">Sản phẩm</a>
          <a href="#dna">Dấu ấn</a>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[560px] max-w-6xl items-center gap-10 px-5 pb-14 pt-8 md:grid-cols-[1fr_420px]">
        <div>
          <p className="mb-5 text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">
            Build · Test · Ship · 2026
          </p>
          <h1 className="max-w-xl text-6xl font-black leading-[0.88] tracking-normal text-[#171512] md:text-8xl">
            {profile.studentName}
            <span className="text-[#bd0026]">.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-semibold leading-8 text-[#423d37]">
            {profile.headline || profile.intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {(data.technologies.length ? data.technologies : [profile.courseLine || 'MindX']).map((tech) => (
              <span key={tech} className="rounded-full border border-[#d7ccbc] bg-white/70 px-3 py-1 text-xs font-bold text-[#423d37]">
                {tech}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#projects" className="rounded-full bg-[#bd0026] px-5 py-3 text-sm font-bold text-white shadow-sm">
              Khám phá hành trình
            </a>
            <span className="rounded-full border border-[#d7ccbc] bg-white/70 px-5 py-3 text-sm font-bold text-[#423d37]">
              {profile.className || profile.courseName || 'MindX'}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-[#bd0026]/10 blur-3xl" />
          <div className="relative rotate-3 rounded-[28px] bg-[#7d0019] p-7 text-white shadow-2xl">
            <div className="grid h-24 w-24 place-items-center rounded-2xl bg-white/10 text-3xl font-black">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.studentName} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                initials(profile.studentName)
              )}
            </div>
            <p className="mt-10 text-xs font-bold uppercase tracking-wider text-white/60">
              Portfolio owner
            </p>
            <h2 className="mt-2 text-2xl font-black">{profile.studentName}</h2>
            <p className="mt-1 text-sm text-white/70">{profile.courseName || profile.courseLine}</p>
            <div className="mt-10 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-2xl font-black">{data.projects.length}</p>
                <p className="text-[10px] uppercase text-white/60">Projects</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-2xl font-black">{data.achievements.length}</p>
                <p className="text-[10px] uppercase text-white/60">Awards</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-2xl font-black">{data.rewards.points}</p>
                <p className="text-[10px] uppercase text-white/60">Points</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#171512] py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[220px_1fr]">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/50">01 · About</p>
          <p className="max-w-3xl text-2xl font-bold leading-10">{profile.intro}</p>
        </div>
      </section>

      <section id="journey" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">02 · Learning Journey</p>
        <h2 className="mt-3 max-w-md text-5xl font-black leading-[0.95]">Học đến đâu, làm ra đến đó.</h2>
        <div className="mt-10 space-y-6 border-l border-[#d8d0c2] pl-6">
          {data.learningJourney.map((item, index) => (
            <div key={`${item.title}-${index}`} className="relative grid gap-4 md:grid-cols-[220px_1fr]">
              <span className="absolute -left-[31px] top-2 h-3 w-3 rounded-full bg-[#bd0026]" />
              <div>
                <p className="font-black">{item.title}</p>
                <p className="text-sm text-[#777067]">{item.period || item.code}</p>
              </div>
              <div className="rounded-xl border border-[#ded6c9] bg-white p-5 shadow-sm">
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                  {item.status || 'Đang học'}
                </span>
                <p className="mt-3 text-sm leading-6 text-[#423d37]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {academicItems.length ? (
        <section className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">03 · Course Results</p>
          <h2 className="mt-3 max-w-lg text-5xl font-black leading-[0.95]">Checkpoint, SPCK và kết quả cuối khóa.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {academicItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#ded6c9] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#777067]">{item.label}</p>
                <p className="mt-3 text-3xl font-black text-[#bd0026]">{String(item.value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="projects" className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">03 · Important Work</p>
        <h2 className="mt-3 max-w-md text-5xl font-black leading-[0.95]">Dự án sau khóa & tự khởi xướng.</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {data.projects.map((project, index) => (
            <article key={`${project.title}-${index}`} className="overflow-hidden rounded-xl border border-[#ded6c9] bg-white shadow-sm">
              <div className="h-48 bg-gradient-to-br from-[#bd0026] via-[#ef476f] to-[#ffd166]">
                {project.imageUrl ? (
                  <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-5">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#bd0026]">{project.course || profile.courseName}</p>
                <h3 className="mt-2 text-2xl font-black">{project.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#55504a]">{project.description}</p>
                {project.link ? (
                  <Link href={project.link} target="_blank" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#bd0026]">
                    {project.attachmentName || 'Xem sản phẩm'} <ExternalLink className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="dna" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">04 · Advanced Intelligence</p>
        <h2 className="mt-3 max-w-md text-5xl font-black leading-[0.95]">DNA năng lực & thiên hướng.</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-[#ded6c9] bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-black">DNA năng lực</h3>
            <div className="space-y-5">
              {data.dnaScores.map((score) => <ScoreBar key={score.label} label={score.label} value={score.value} max={5} />)}
            </div>
          </div>
          <div className="rounded-xl border border-[#ded6c9] bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-black">Năng lực học tập</h3>
            <div className="space-y-5">
              {data.mindsetScores.map((score) => <ScoreBar key={score.label} label={score.label} value={score.value} max={5} />)}
            </div>
          </div>
          {data.orientationScores?.length ? (
            <div className="rounded-xl border border-[#ded6c9] bg-white p-6 shadow-sm md:col-span-2">
              <h3 className="mb-5 font-black">Định hướng DN</h3>
              <div className="grid gap-5 md:grid-cols-3">
                {data.orientationScores.map((score) => (
                  <ScoreBar key={score.label} label={score.label} value={score.value} max={5} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[360px_1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">05 · Capability</p>
          <h2 className="mt-3 text-5xl font-black leading-[0.95]">Năng lực có cần quan sát.</h2>
        </div>
        <div className="grid gap-4">
          {[...data.hardSkills, ...data.softSkills].map((skill, index) => (
            <div key={`${skill.name}-${index}`} className="rounded-xl border border-[#ded6c9] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black">{skill.name}</h3>
                {skill.level ? <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-[#bd0026]">{skill.level}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#bd0026]">06 · Capability</p>
        <h2 className="mt-3 text-5xl font-black leading-[0.95]">Thành tích & dấu ấn cá nhân.</h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.achievements.map((award, index) => (
            <article key={`${award.title}-${index}`} className="rounded-xl border border-[#ded6c9] bg-white p-5 shadow-sm">
              <div className="mb-8 grid h-12 w-12 place-items-center rounded-xl bg-[#171512] text-[#ffd166]">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-black">{award.title}</h3>
              <p className="mt-2 text-sm text-[#777067]">{award.subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#171512] px-5 py-20 text-center text-white">
        <Star className="mx-auto mb-5 h-7 w-7 text-[#bd0026]" />
        <blockquote className="mx-auto max-w-3xl text-3xl font-black leading-tight">
          "{data.quote}"
        </blockquote>
      </section>

      <footer className="bg-[#bd0026] px-5 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-black lowercase">mindX</p>
            <p className="text-xs text-white/70">Student Portfolio</p>
          </div>
          <p className="text-xs text-white/70">Portfolio verified by MindX · {profile.centreName}</p>
        </div>
      </footer>
    </main>
  );
}
