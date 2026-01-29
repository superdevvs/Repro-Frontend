
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

const useBarColors = (themeMode: ChartProps['themeMode']) => {
  const { theme } = useTheme();
  const mode = themeMode === 'auto' ? theme : themeMode || 'light';
  return {
    mode,
    // Vibrant gradient colors for bars
    revenue: mode === 'dark' 
      ? ['#3b82f6', '#60a5fa'] // blue gradient for dark
      : ['#2563eb', '#3b82f6'], // slightly darker blue for light
    expenses: mode === 'dark'
      ? ['#f43f5e', '#fb7185'] // rose gradient for dark
      : ['#e11d48', '#f43f5e'], // darker rose for light
    profit: mode === 'dark'
      ? ['#10b981', '#34d399'] // emerald gradient for dark
      : ['#059669', '#10b981'], // darker emerald for light
  };
};

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
  const barColors = useBarColors(themeMode);
  
  // Enhanced colors based on category names
  const getBarColor = (category: string, idx: number) => {
    const cat = category.toLowerCase();
    if (cat.includes('revenue')) return barColors.revenue[0];
    if (cat.includes('expense')) return barColors.expenses[0];
    if (cat.includes('profit')) return barColors.profit[0];
    return colors[idx % colors.length];
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          barCategoryGap="20%"
        >
          <defs>
            {categories.map((category, idx) => {
              const cat = category.toLowerCase();
              let gradientColors = [colors[idx % colors.length], colors[idx % colors.length]];
              if (cat.includes('revenue')) gradientColors = barColors.revenue;
              else if (cat.includes('expense')) gradientColors = barColors.expenses;
              else if (cat.includes('profit')) gradientColors = barColors.profit;
              
              return (
                <linearGradient key={`gradient-${category}`} id={`gradient-${category}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradientColors[1]} stopOpacity={1} />
                  <stop offset="100%" stopColor={gradientColors[0]} stopOpacity={0.85} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke={palette.grid} 
              strokeWidth={1}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tick={{ fontSize: 11, fill: palette.axis, fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: palette.grid, strokeWidth: 1 }}
              dy={8}
            />
          )}
          {showYAxis && (
            <YAxis
              width={yAxisWidth}
              tick={{ fontSize: 11, fill: palette.axis }}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
            />
          )}
          <Tooltip
            formatter={(value: number, name: string) => [valueFormatter(value), name]}
            labelFormatter={(value) => `${value}`}
            contentStyle={{
              border: 'none',
              backgroundColor: palette.tooltipBg,
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              padding: '12px 16px',
            }}
            itemStyle={{ color: palette.axis, fontWeight: 500 }}
            labelStyle={{ color: palette.axis, fontWeight: 600, marginBottom: 4 }}
            cursor={{ fill: palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
          />
          {showLegend && (
            <Legend 
              wrapperStyle={{ color: palette.legendText, fontSize: 12, paddingTop: 16 }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {categories.map((category, idx) => (
            <Bar
              key={category}
              dataKey={category}
              fill={`url(#gradient-${category})`}
              radius={[6, 6, 0, 0]}
              stackId={stack ? "stack" : undefined}
              maxBarSize={50}
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
