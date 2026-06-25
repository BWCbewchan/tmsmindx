'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS: Record<string, string> = {
  sent: '#16a34a',
  failed: '#dc2626',
  skipped: '#d97706',
}

const LABELS: Record<string, string> = {
  sent: 'Thành công',
  failed: 'Thất bại',
  skipped: 'Bỏ qua',
}

export function EmailStatusDonut({
  data,
}: {
  data: Array<{ name: string; count: number }>
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={88}
            paddingAngle={3}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || '#64748b'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              Number(value).toLocaleString('vi-VN'),
              LABELS[String(name)] || name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900">{total.toLocaleString('vi-VN')}</span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">lần gửi</span>
      </div>
    </div>
  )
}