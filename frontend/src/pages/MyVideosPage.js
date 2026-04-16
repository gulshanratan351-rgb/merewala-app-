import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, Copy, Trash2, Play, Eye, DollarSign, Film, ExternalLink, Bot } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MyVideosPage() {
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/videos?search=${search}`, { withCredentials: true });
      setVideos(res.data);
    } catch (err) {
      console.error('Failed to fetch videos', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const copyLink = (v) => {
    const link = v.shareLink || `${window.location.origin}/watch/${v.code || v.video_id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/videos/${id}`, { withCredentials: true });
      toast.success('Video deleted');
      fetchVideos();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalEarnings = videos.reduce((s, v) => s + (v.earnings || 0), 0);

  return (
    <Layout>
      <div data-testid="my-videos-page">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            My Videos
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Videos uploaded via Telegram Bot</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Film className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs tracking-[0.15em] uppercase text-zinc-500 font-semibold">Total Videos</p>
                <p className="text-xl font-semibold text-white" style={{ fontFamily: 'Outfit' }}>{videos.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs tracking-[0.15em] uppercase text-zinc-500 font-semibold">Total Views</p>
                <p className="text-xl font-semibold text-white" style={{ fontFamily: 'Outfit' }}>{totalViews.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs tracking-[0.15em] uppercase text-zinc-500 font-semibold">Total Earnings</p>
                <p className="text-xl font-semibold text-emerald-400" style={{ fontFamily: 'Outfit' }}>${totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input placeholder="Search videos..." value={search} onChange={e => setSearch(e.target.value)}
            data-testid="search-videos-input"
            className="pl-10 bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500 h-11 max-w-md" />
        </div>

        {/* Table */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          {loading ? (
            <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 skeleton-pulse rounded" />)}</div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center">
              <Bot className="w-14 h-14 text-zinc-700 mx-auto mb-4" strokeWidth={1} />
              <p className="text-white text-base font-medium mb-2">No videos yet</p>
              <p className="text-zinc-500 text-sm">Send a video to your Telegram Bot to get started</p>
              <p className="text-zinc-600 text-xs mt-3">Go to <span className="text-purple-400">Bot Integration</span> to see connection instructions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Video</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Views</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Earnings</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Share Link</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v, idx) => {
                    const code = v.code || v.video_id;
                    const link = v.shareLink || `${window.location.origin}/watch/${code}`;
                    return (
                      <TableRow key={code || idx} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`video-row-${idx}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <div>
                              <p className="text-white text-sm font-medium">{v.title || v.file_name || 'Untitled'}</p>
                              <p className="text-zinc-600 text-xs">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            v.status === 'approved' || v.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            v.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>{v.status || 'pending'}</span>
                        </TableCell>
                        <TableCell className="text-right text-zinc-300 text-sm">{(v.views || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-400 text-sm font-medium">${(v.earnings || 0).toFixed(3)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 max-w-[200px]">
                            <span className="text-purple-400 text-xs font-mono truncate">{link.replace('https://', '')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => copyLink(v)} data-testid={`copy-link-${idx}`}
                              className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-purple-400 transition-colors" title="Copy link">
                              <Copy className="w-4 h-4" />
                            </button>
                            <button onClick={() => window.open(link, '_blank')} 
                              className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-blue-400 transition-colors" title="Open">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(code)} data-testid={`delete-video-${idx}`}
                              className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
