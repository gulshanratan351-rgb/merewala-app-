import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, Film, Users, Settings, CheckCircle2, XCircle, Trash2, DollarSign, Download } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminPage() {
  const [tab, setTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ cpm: 2, allow_download: true });
  const [cpmInput, setCpmInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [tab, filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'videos') {
        const res = await axios.get(`${API}/admin/videos${filterStatus ? `?status=${filterStatus}` : ''}`, { withCredentials: true });
        setVideos(res.data);
      } else if (tab === 'users') {
        const res = await axios.get(`${API}/admin/users`, { withCredentials: true });
        setUsers(res.data);
      } else if (tab === 'settings') {
        const res = await axios.get(`${API}/admin/settings`, { withCredentials: true });
        setSettings(res.data);
        setCpmInput(String(res.data.cpm));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const videoAction = async (videoId, action) => {
    try {
      await axios.post(`${API}/admin/video-action`, { video_id: videoId, action }, { withCredentials: true });
      toast.success(`Video ${action}d`);
      fetchData();
    } catch (err) { toast.error('Action failed'); }
  };

  const updateCPM = async () => {
    try {
      await axios.post(`${API}/admin/set-cpm`, { cpm: parseFloat(cpmInput) }, { withCredentials: true });
      toast.success(`CPM set to $${cpmInput}`);
    } catch (err) { toast.error('Failed'); }
  };

  const toggleDownload = async () => {
    try {
      await axios.post(`${API}/admin/settings`, { allow_download: !settings.allow_download }, { withCredentials: true });
      setSettings({ ...settings, allow_download: !settings.allow_download });
      toast.success('Download toggle updated');
    } catch (err) { toast.error('Failed'); }
  };

  const updateSub = async (userId, sub) => {
    try {
      await axios.post(`${API}/admin/subscription`, { user_id: userId, subscription: sub }, { withCredentials: true });
      toast.success('Subscription updated');
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const tabs = [
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <Layout>
      <div data-testid="admin-page">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            <Shield className="w-7 h-7 inline-block mr-2 text-purple-400" /> Admin Panel
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-purple-600 text-white' : 'bg-[#0D0D12] border border-white/[0.06] text-zinc-400 hover:text-white'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Videos Tab */}
        {tab === 'videos' && (
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] bg-[#08080A] border-white/10 text-white" data-testid="admin-video-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D12] border-white/10 text-white">
                  <SelectItem value="all" className="text-zinc-300 focus:bg-white/5 focus:text-white">All</SelectItem>
                  <SelectItem value="approved" className="text-zinc-300 focus:bg-white/5 focus:text-white">Approved</SelectItem>
                  <SelectItem value="pending" className="text-zinc-300 focus:bg-white/5 focus:text-white">Pending</SelectItem>
                  <SelectItem value="rejected" className="text-zinc-300 focus:bg-white/5 focus:text-white">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5">
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Title</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Status</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40 text-right">Views</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40 text-right">Earnings</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v, i) => (
                    <TableRow key={v.code || v.video_id || i} className="border-b border-white/5">
                      <TableCell className="text-white text-sm">{v.title || v.file_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : v.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {v.status || 'pending'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-zinc-300 text-sm">{v.views || 0}</TableCell>
                      <TableCell className="text-right text-emerald-400 text-sm">${(v.earnings || 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => videoAction(v.code || v.video_id, 'approve')} className="p-1.5 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400" data-testid={`approve-video-${i}`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => videoAction(v.code || v.video_id, 'reject')} className="p-1.5 rounded hover:bg-amber-500/10 text-zinc-500 hover:text-amber-400" data-testid={`reject-video-${i}`}>
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => videoAction(v.code || v.video_id, 'delete')} className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400" data-testid={`delete-video-${i}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {videos.length === 0 && <p className="text-center text-zinc-500 text-sm py-8">No videos found</p>}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5">
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Name</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Email</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Subscription</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40 text-right">Balance</TableHead>
                    <TableHead className="text-xs uppercase text-zinc-500 bg-black/40">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow key={u.user_id || i} className="border-b border-white/5">
                      <TableCell className="text-white text-sm">{u.name || 'N/A'}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{u.email}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.subscription === 'premium' ? 'bg-purple-500/20 text-purple-400' : u.subscription === 'basic' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                          {u.subscription || 'free'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-emerald-400 text-sm">${(u.balance || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Select value={u.subscription || 'free'} onValueChange={(v) => updateSub(u.user_id, v)}>
                          <SelectTrigger className="w-[120px] h-8 bg-[#08080A] border-white/10 text-white text-xs" data-testid={`sub-select-${i}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0D0D12] border-white/10 text-white">
                            <SelectItem value="free" className="text-zinc-300 text-xs">Free</SelectItem>
                            <SelectItem value="basic" className="text-zinc-300 text-xs">Basic</SelectItem>
                            <SelectItem value="premium" className="text-zinc-300 text-xs">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-white font-medium mb-4" style={{ fontFamily: 'Outfit' }}>
                <DollarSign className="w-5 h-5 inline-block mr-2 text-emerald-400" /> Global CPM
              </h3>
              <div className="flex items-center gap-3">
                <Input type="number" step="0.1" value={cpmInput} onChange={e => setCpmInput(e.target.value)}
                  data-testid="cpm-input"
                  className="w-32 bg-[#08080A] border-white/10 text-white" />
                <Button onClick={updateCPM} data-testid="save-cpm-button" className="gradient-btn text-white border-0">Save CPM</Button>
                <span className="text-zinc-500 text-sm">Current: ${settings.cpm}/1000 views</span>
              </div>
            </div>
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-white font-medium mb-4" style={{ fontFamily: 'Outfit' }}>
                <Download className="w-5 h-5 inline-block mr-2 text-blue-400" /> Download Toggle
              </h3>
              <div className="flex items-center gap-3">
                <Button onClick={toggleDownload} data-testid="toggle-download-button"
                  className={`${settings.allow_download ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white border-0`}>
                  {settings.allow_download ? 'Downloads Enabled' : 'Downloads Disabled'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
