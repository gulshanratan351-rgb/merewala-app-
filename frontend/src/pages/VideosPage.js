import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, Copy, Trash2, Play, Eye, DollarSign, Film } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VideosPage() {
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

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = async (videoId) => {
    try {
      await axios.delete(`${API}/videos/${videoId}`, { withCredentials: true });
      toast.success('Video deleted');
      fetchVideos();
    } catch (err) {
      toast.error('Failed to delete video');
    }
  };

  const copyLink = (videoId) => {
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/v/${videoId}`);
    toast.success('Video link copied');
  };

  return (
    <Layout>
      <div data-testid="videos-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Videos
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Videos uploaded via Telegram Bot</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search videos by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="search-videos-input"
            className="pl-10 bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 h-11 max-w-md"
          />
        </div>

        {/* Table */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 skeleton-pulse rounded" />)}
            </div>
          ) : videos.length === 0 ? (
            <div className="p-12 text-center">
              <Film className="w-12 h-12 text-zinc-600 mx-auto mb-4" strokeWidth={1} />
              <p className="text-zinc-400 text-sm">No videos yet. Upload a video via Telegram Bot to get started.</p>
              <p className="text-zinc-600 text-xs mt-2">Use your API key with the <code className="text-purple-400">/api/generate-link</code> endpoint</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">File Name</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Video ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Views</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Earnings</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video, idx) => (
                    <TableRow key={video.video_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      data-testid={`video-row-${idx}`}
                    >
                      <TableCell className="text-white font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          {video.file_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-purple-400 text-sm font-mono">{video.video_id}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-zinc-300 text-sm">{video.views?.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-sm font-medium">{video.earnings?.toFixed(3)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm">{new Date(video.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => copyLink(video.video_id)}
                            data-testid={`copy-video-link-${idx}`}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-purple-400 transition-colors"
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(video.video_id)}
                            data-testid={`delete-video-${idx}`}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 mt-8 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
          <h3 className="text-base font-medium text-white mb-3" style={{ fontFamily: 'Outfit' }}>How Video Earning Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">Rate</p>
              <p className="text-lg font-semibold text-purple-400" style={{ fontFamily: 'Outfit' }}>$0.007 / view</p>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">Min Watch Time</p>
              <p className="text-lg font-semibold text-blue-400" style={{ fontFamily: 'Outfit' }}>20 seconds</p>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">Per 1000 Views</p>
              <p className="text-lg font-semibold text-emerald-400" style={{ fontFamily: 'Outfit' }}>$7.00</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
