'use client'

import type { EmailSeriesPoint } from './types'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatBucket(value: string, mode: 'hour' | 'day') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return mode === 'hour'
    ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export function EmailLoadChart({
  data,
  mode,
}: {
  data: EmailSeriesPoint[]
  mode: 'hour' | 'day'
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: formatBucket(item.bucket, mode),
  }))

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`emailSent-${mode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="count" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis yAxisId="latency" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb', boxShadow: '0 10px 30px rgba(0,0,0,.08)' }}
            formatter={(value, name) => [
              name === 'Độ trễ TB' ? `${Number(value).toLocaleString('vi-VN')} ms` : Number(value).toLocaleString('vi-VN'),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Area yAxisId="count" type="monotone" dataKey="sent" name="Thành công" stroke="#16a34a" strokeWidth={2} fill={`url(#emailSent-${mode})`} />
          <Bar yAxisId="count" dataKey="failed" name="Thất bại" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Line yAxisId="latency" type="monotone" dataKey="avgLatencyMs" name="Độ trễ TB" stroke="#eab308" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}