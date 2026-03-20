import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Eye,
  Users,
  MousePointerClick,
  Share2,
  Loader2,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  TrendingUp,
  Image as ImageIcon,
  BarChart3,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface TourAnalyticsPanelProps {
  shootId: string;
  onBack: () => void;
}

type RangeType = 'week' | 'month' | 'year' | 'all';

interface AnalyticsData {
  range: string;
  summary: {
    total_views: number;
    unique_visitors: number;
    total_clicks: number;
    total_shares: number;
    total_downloads: number;
    total_media_views: number;
  };
  views_by_tour_type: Record<string, number>;
  views_over_time: Array<{ date: string; views: number; branded: number; mls: number; generic_mls: number }>;
  top_media: Array<{ media_index: number | null; media_filename: string | null; media_url: string | null; views: number; unique_viewers: number }>;
  referrers: Record<string, number>;
  devices: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, number>;
  clicks_by_tour_type: Record<string, number>;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const TOUR_TYPE_COLORS: Record<string, string> = {
  branded: '#3b82f6',
  mls: '#10b981',
  generic_mls: '#f59e0b',
};
const TOUR_TYPE_LABELS: Record<string, string> = {
  branded: 'Branded',
  mls: 'MLS',
  generic_mls: 'Generic MLS',
};
const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor className="h-3.5 w-3.5" />,
  Mobile: <Smartphone className="h-3.5 w-3.5" />,
  Tablet: <Tablet className="h-3.5 w-3.5" />,
};

export function TourAnalyticsPanel({ shootId, onBack }: TourAnalyticsPanelProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeType>('week');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/tour-analytics?range=${range}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [shootId, range]);

  const rangeOptions: { value: RangeType; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All' },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Pie data for tour type breakdown
  const tourTypePieData = data
    ? Object.entries(data.views_by_tour_type).map(([key, value]) => ({
        name: TOUR_TYPE_LABELS[key] || key,
        value,
        color: TOUR_TYPE_COLORS[key] || '#94a3b8',
      }))
    : [];

  // Pie data for device breakdown
  const devicePieData = data
    ? Object.entries(data.devices).map(([key, value], i) => ({
        name: key,
        value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  // Bar data for referrers
  const referrerBarData = data
    ? Object.entries(data.referrers).map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, count }))
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Media
        </Button>
      </div>
    );
  }

  const s = data?.summary;
  const isEmpty = !s || (s.total_views === 0 && s.total_clicks === 0 && s.total_shares === 0 && s.total_media_views === 0);

  return (
    <div className="space-y-4 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 text-xs gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Media
        </Button>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                range === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Tour Analytics</h2>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium">No analytics data yet</h3>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Analytics will appear here once visitors start viewing your tour pages.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Views</span>
              </div>
              <div className="text-xl font-bold">{s!.total_views.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Unique Visitors</span>
              </div>
              <div className="text-xl font-bold">{s!.unique_visitors.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Clicks</span>
              </div>
              <div className="text-xl font-bold">{s!.total_clicks.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Shares</span>
              </div>
              <div className="text-xl font-bold">{s!.total_shares.toLocaleString()}</div>
            </Card>
          </div>

          {/* Views Over Time */}
          {data!.views_over_time.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Views Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data!.views_over_time}>
                      <defs>
                        <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)' }}
                        labelFormatter={formatDate}
                      />
                      <Area type="monotone" dataKey="branded" stackId="1" stroke={TOUR_TYPE_COLORS.branded} fill={TOUR_TYPE_COLORS.branded} fillOpacity={0.3} name="Branded" />
                      <Area type="monotone" dataKey="mls" stackId="1" stroke={TOUR_TYPE_COLORS.mls} fill={TOUR_TYPE_COLORS.mls} fillOpacity={0.3} name="MLS" />
                      <Area type="monotone" dataKey="generic_mls" stackId="1" stroke={TOUR_TYPE_COLORS.generic_mls} fill={TOUR_TYPE_COLORS.generic_mls} fillOpacity={0.3} name="Generic MLS" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Two-column: Tour Type Breakdown + Device Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tourTypePieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Tour Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tourTypePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                          style={{ fontSize: 10 }}
                        >
                          {tourTypePieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {devicePieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Device Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {devicePieData.map((device, i) => {
                      const total = devicePieData.reduce((sum, d) => sum + d.value, 0);
                      const pct = total ? Math.round((device.value / total) * 100) : 0;
                      return (
                        <div key={device.name} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 w-20 text-xs text-muted-foreground">
                            {DEVICE_ICONS[device.name] || <Monitor className="h-3.5 w-3.5" />}
                            {device.name}
                          </div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: device.color }}
                            />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">{pct}%</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{device.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Referrer Sources */}
          {referrerBarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Referrer Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={referrerBarData} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Viewed Media */}
          {data!.top_media.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Top Viewed Media
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="space-y-2">
                  {data!.top_media.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                      {item.media_url ? (
                        <img
                          src={item.media_url}
                          alt={`Media ${item.media_index ?? i}`}
                          className="h-10 w-14 object-cover rounded border"
                        />
                      ) : (
                        <div className="h-10 w-14 bg-muted rounded border flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {item.media_filename || `Image ${(item.media_index ?? i) + 1}`}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.unique_viewers} unique viewer{item.unique_viewers !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.views} view{item.views !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geographic Breakdown */}
          {(Object.keys(data!.countries).length > 0 || Object.keys(data!.cities).length > 0) && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Geographic Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Object.keys(data!.countries).length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Countries</h4>
                      <div className="space-y-1.5">
                        {Object.entries(data!.countries).map(([country, count]) => (
                          <div key={country} className="flex items-center justify-between text-xs">
                            <span>{country}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.keys(data!.cities).length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Cities</h4>
                      <div className="space-y-1.5">
                        {Object.entries(data!.cities).map(([city, count]) => (
                          <div key={city} className="flex items-center justify-between text-xs">
                            <span>{city}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
