import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Eye, DollarSign, Users, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Area
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function StatCard({ icon: Icon, label, value, prefix = '', trend, color, delay }) {
  return (
    <div
      className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 hover:border-purple-500/30 transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1" style={{ fontFamily: 'Outfit' }}>{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: prefix === '$' ? 2 : 0, maximumFractionDigits: 2 }) : value}
      </p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-white shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.name.includes('Earning') ? '$' : ''}{p.value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchMonthly(parseInt(selectedMonth));
  }, [selectedMonth]);

  const fetchData = async () => {
    try {
      const [statsRes, yearlyRes] = await Promise.all([
        axios.get(`${API}/stats`, { withCredentials: true }),
        axios.get(`${API}/stats/yearly?year=2025`, { withCredentials: true }),
      ]);
      setStats(statsRes.data);
      setYearlyData(yearlyRes.data.map(d => ({
        ...d,
        name: MONTHS[d.month - 1]?.substring(0, 3),
      })));
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthly = async (month) => {
    try {
      const res = await axios.get(`${API}/stats/monthly?month=${month}&year=2025`, { withCredentials: true });
      setMonthlyData(res.data.map(d => ({ ...d, name: `Day ${d.day}` })));
    } catch (err) {
      console.error('Failed to fetch monthly', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 h-32 skeleton-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div data-testid="dashboard-page">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Overview of your monetization performance</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Eye} label="Total Views" value={stats?.total_views || 0} trend={12.5} color="bg-blue-500/20" delay={0} />
          <StatCard icon={DollarSign} label="Total Earnings" value={stats?.total_earnings || 0} prefix="$" trend={8.3} color="bg-purple-500/20" delay={80} />
          <StatCard icon={Users} label="Referral Earnings" value={stats?.referral_earnings || 0} prefix="$" trend={-2.1} color="bg-emerald-500/20" delay={160} />
          <StatCard icon={BarChart3} label="Average CPM" value={stats?.avg_cpm || 0} prefix="$" trend={5.7} color="bg-amber-500/20" delay={240} />
        </div>

        {/* Monthly Analysis */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 mb-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Monthly Analysis</h2>
              <p className="text-sm text-zinc-500">Daily views and earnings breakdown</p>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] bg-[#08080A] border-white/10 text-white" data-testid="month-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D0D12] border-white/10 text-white">
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)} className="text-zinc-300 focus:bg-white/5 focus:text-white">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-[300px] sm:h-[350px]" data-testid="monthly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval="preserveStartEnd" />
                <YAxis yAxisId="views" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <YAxis yAxisId="earnings" orientation="right" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="views" dataKey="views" name="Views" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={12} fillOpacity={0.8} />
                <Line yAxisId="earnings" type="monotone" dataKey="earnings" name="Earnings" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Yearly Overview */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="mb-6">
            <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Yearly Overview — 2025</h2>
            <p className="text-sm text-zinc-500">Monthly comparison of views vs earnings</p>
          </div>

          <div className="h-[300px] sm:h-[350px]" data-testid="yearly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={yearlyData}>
                <defs>
                  <linearGradient id="earningsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <YAxis yAxisId="views" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <YAxis yAxisId="earnings" orientation="right" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="views" dataKey="views" name="Views" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.7} />
                <Area yAxisId="earnings" type="monotone" dataKey="earnings" name="Earnings" fill="url(#earningsArea)" stroke="#8B5CF6" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
