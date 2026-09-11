import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { PricePoint } from '../types';

interface PnLChartProps {
  data: PricePoint[];
}

export const PnLChart: React.FC<PnLChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border rounded-xl bg-cyber-bg/40">
        <span>Awaiting active position price ticks...</span>
        <span className="text-[10px] text-slate-600 mt-1">Updates every 200ms once position opens</span>
      </div>
    );
  }

  const latestPnl = data[data.length - 1]?.pnlPercent || 0;
  const isProfit = latestPnl >= 0;
  const strokeColor = isProfit ? '#14F195' : '#ff2a5f';
  const gradientId = isProfit ? 'pnlGreenGradient' : 'pnlRedGradient';

  return (
    <div className="w-full h-56 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="pnlGreenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14F195" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#14F195" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="pnlRedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff2a5f" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ff2a5f" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <XAxis 
            dataKey="time" 
            stroke="#475569" 
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
          />
          <YAxis 
            domain={['auto', 'auto']}
            stroke="#475569" 
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(13, 19, 34, 0.95)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              fontFamily: 'JetBrains Mono',
              fontSize: '11px',
              color: '#fff',
            }}
            formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, 'PnL']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="pnlPercent"
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
