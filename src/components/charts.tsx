
import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

type ChartProps = {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  yAxisWidth?: number;
  stack?: boolean;
  connectNulls?: boolean;
  curveType?: 'natural' | 'monotone' | 'step';
  className?: string;
  themeMode?: 'auto' | 'light' | 'dark';
};

const useGridColors = (themeMode: ChartProps['themeMode']) => {
  const { theme } = useTheme();
  const mode = themeMode === 'auto' ? theme : themeMode || 'light';
  return {
    mode,
    grid: mode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 23, 42, 0.06)',
    axis: mode === 'dark' ? 'rgba(148, 163, 184, 0.7)' : 'rgba(15, 23, 42, 0.65)',
    tooltipBorder: mode === 'dark' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.4)',
    tooltipBg: mode === 'dark' ? '#0f172a' : '#ffffff',
    legendText: mode === 'dark' ? '#cbd5f5' : '#475569',
  };
};

export function LineChart({
  data,
  index,
  categories,
  colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"],
  valueFormatter = (value: number) => `${value}`,
  showLegend = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 56,
  connectNulls = false,
  curveType = "monotone", 
  className = "",
  themeMode = 'auto',
}: ChartProps) {
  const palette = useGridColors(themeMode);
  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="2 6"
              stroke={palette.grid}
              strokeWidth={0.75}
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
            />
          )}
          {showYAxis && (
            <YAxis
              width={yAxisWidth}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
            />
          )}
          <Tooltip
            formatter={(value: number) => [valueFormatter(value)]}
            labelFormatter={(value) => `${value}`}
            contentStyle={{
              border: `1px solid ${palette.tooltipBorder}`,
              backgroundColor: palette.tooltipBg,
              borderRadius: '8px',
              color: palette.axis,
            }}
          />
          {showLegend && <Legend wrapperStyle={{ color: palette.legendText, fontSize: 12 }} />}
          {categories.map((category, index) => (
            <Line
              key={category}
              type={curveType}
              dataKey={category}
              stroke={colors[index % colors.length]}
              strokeWidth={2.4}
              dot={{ r: 0 }}
              activeDot={{ r: 4 }}
              connectNulls={connectNulls}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({
  data,
  index,
  categories,
  colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"],
  valueFormatter = (value: number) => `${value}`,
  showLegend = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 56,
  stack = false,
  className = "",
  themeMode = 'auto',
}: ChartProps) {
  const palette = useGridColors(themeMode);
  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={palette.grid} strokeWidth={0.75} />
          )}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
            />
          )}
          {showYAxis && (
            <YAxis
              width={yAxisWidth}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
            />
          )}
          <Tooltip
            formatter={(value: number) => [valueFormatter(value)]}
            labelFormatter={(value) => `${value}`}
            contentStyle={{
              border: `1px solid ${palette.tooltipBorder}`,
              backgroundColor: palette.tooltipBg,
              borderRadius: '8px',
            }}
          />
          {showLegend && <Legend wrapperStyle={{ color: palette.legendText, fontSize: 12 }} />}
          {categories.map((category, index) => (
            <Bar
              key={category}
              dataKey={category}
              fill={colors[index % colors.length]}
              radius={[4, 4, 0, 0]}
              stackId={stack ? "stack" : undefined}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaChart({
  data,
  index,
  categories,
  colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"],
  valueFormatter = (value: number) => `${value}`,
  showLegend = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 56,
  stack = false,
  connectNulls = false,
  curveType = "monotone",
  className = "",
  themeMode = 'auto',
}: ChartProps) {
  const palette = useGridColors(themeMode);
  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={palette.grid} strokeWidth={0.75} />
          )}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
            />
          )}
          {showYAxis && (
            <YAxis
              width={yAxisWidth}
              tick={{ fontSize: 12, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
            />
          )}
          <Tooltip
            formatter={(value: number) => [valueFormatter(value)]}
            labelFormatter={(value) => `${value}`}
            contentStyle={{
              border: `1px solid ${palette.tooltipBorder}`,
              backgroundColor: palette.tooltipBg,
              borderRadius: '8px',
            }}
          />
          {showLegend && <Legend wrapperStyle={{ color: palette.legendText, fontSize: 12 }} />}
          {categories.map((category, index) => (
            <Area
              key={category}
              type={curveType}
              dataKey={category}
              fill={colors[index % colors.length]}
              stroke={colors[index % colors.length]}
              fillOpacity={modeAwareFillOpacity(palette.mode)}
              stackId={stack ? "stack" : undefined}
              connectNulls={connectNulls}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DonutChartProps = {
  data: any[];
  category: string;
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  className?: string;
  themeMode?: 'auto' | 'light' | 'dark';
};

export function DonutChart({
  data,
  category,
  index,
  colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"],
  valueFormatter = (value: number) => `${value}`,
  showLabel = false,
  className = "",
  themeMode = 'auto',
}: DonutChartProps) {
  const palette = useGridColors(themeMode);
  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey={category}
            nameKey={index}
            label={showLabel ? (entry) => entry[index] : false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [valueFormatter(value)]}
            contentStyle={{
              border: `1px solid ${palette.tooltipBorder}`,
              backgroundColor: palette.tooltipBg,
              borderRadius: '8px',
            }}
          />
          <Legend wrapperStyle={{ color: palette.legendText, fontSize: 12 }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

const modeAwareFillOpacity = (mode: 'dark' | 'light') => (mode === 'dark' ? 0.25 : 0.15);
