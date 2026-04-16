import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Bot, Key, Copy, RefreshCw, Search, Trash2, Play, Eye, DollarSign, Film, Code2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export default function BotInfoPage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/videos?search=${search}`, { withCredentials: true });
      setVideos(res.data);
    } catch (err) {
      console.error('Failed to fetch videos', err);
    }
  }, [search]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/bot/api-key`, { withCredentials: true });
      setApiKey(res.data.api_key);
    } catch (err) {
      console.error('Failed to fetch API key', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await axios.post(`${API}/bot/regenerate-key`, {}, { withCredentials: true });
      setApiKey(res.data.api_key);
      toast.success('API key regenerated');
    } catch (err) {
      toast.error('Failed to regenerate key');
    } finally {
      setRegenerating(false);
    }
  };

  const copyKey = () => { navigator.clipboard.writeText(apiKey); toast.success('API key copied'); };
  const copyLink = (videoId) => { navigator.clipboard.writeText(`${window.location.origin}/v/${videoId}`); toast.success('Link copied'); };
  const handleDelete = async (videoId) => {
    try {
      await axios.delete(`${API}/videos/${videoId}`, { withCredentials: true });
      toast.success('Video deleted');
      fetchVideos();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <Layout>
      <div data-testid="bot-info-page">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Bot & API
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Telegram bot connection, API docs & uploaded videos</p>
        </div>

        {/* API Key */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Your API Key</h2>
              <p className="text-xs text-zinc-500">Use this key in your Telegram bot to authenticate</p>
            </div>
          </div>
          {loading ? (
            <div className="h-11 skeleton-pulse rounded" />
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 w-full">
                <Input
                  readOnly
                  value={showKey ? apiKey : apiKey.replace(/./g, '*').substring(0, 20) + '...'}
                  data-testid="api-key-display"
                  className="bg-[#08080A] border-white/10 text-zinc-300 font-mono text-sm flex-1"
                />
                <Button variant="outline" size="icon" onClick={copyKey} data-testid="copy-api-key-button"
                  className="border-white/10 text-zinc-400 hover:bg-white/5 hover:text-purple-400 h-10 w-10">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowKey(!showKey)} data-testid="toggle-api-key"
                  className="border-white/10 text-zinc-300 hover:bg-white/5 text-sm h-10">
                  {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button variant="outline" onClick={handleRegenerate} disabled={regenerating} data-testid="regenerate-api-key"
                  className="border-white/10 text-zinc-300 hover:bg-white/5 text-sm h-10">
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* CPM Rates */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <h3 className="text-base font-medium text-white mb-3" style={{ fontFamily: 'Outfit' }}>Earning Rates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">First 1000 Views</p>
              <p className="text-lg font-semibold text-purple-400" style={{ fontFamily: 'Outfit' }}>$1 CPM</p>
              <p className="text-xs text-zinc-500 mt-1">$0.001 per view</p>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">After 1000 Views</p>
              <p className="text-lg font-semibold text-emerald-400" style={{ fontFamily: 'Outfit' }}>$2 CPM</p>
              <p className="text-xs text-zinc-500 mt-1">$0.002 per view</p>
            </div>
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-1">Min Watch Time</p>
              <p className="text-lg font-semibold text-blue-400" style={{ fontFamily: 'Outfit' }}>20 seconds</p>
              <p className="text-xs text-zinc-500 mt-1">View counts after 20s play</p>
            </div>
          </div>
        </div>

        {/* Uploaded Videos */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Uploaded Videos</h2>
                <p className="text-xs text-zinc-500">Videos uploaded via Telegram Bot</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input placeholder="Search videos..." value={search} onChange={e => setSearch(e.target.value)}
              data-testid="search-videos-input"
              className="pl-10 bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500 h-10 max-w-sm" />
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-8">
              <Film className="w-10 h-10 text-zinc-600 mx-auto mb-3" strokeWidth={1} />
              <p className="text-zinc-400 text-sm">No videos yet</p>
              <p className="text-zinc-600 text-xs mt-1">Connect your Telegram bot and upload files</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">File</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Views</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Earnings</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v, idx) => (
                    <TableRow key={v.video_id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`video-row-${idx}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="text-white text-sm font-medium">{v.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-zinc-300 text-sm">{v.views?.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-400 text-sm font-medium">${v.earnings?.toFixed(3)}</TableCell>
                      <TableCell className="text-zinc-500 text-sm">{new Date(v.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyLink(v.video_id)} data-testid={`copy-video-${idx}`}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-purple-400 transition-colors">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(v.video_id)} data-testid={`delete-video-${idx}`}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-red-400 transition-colors">
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

        {/* API Documentation */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>API Documentation</h2>
              <p className="text-xs text-zinc-500">Connect your Telegram bot and Android app</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Generate Link API */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">POST</span>
                <code className="text-sm text-purple-400 font-mono">/api/generate-link</code>
              </div>
              <p className="text-xs text-zinc-400 mb-3">Telegram bot calls this when user uploads a file. Returns a Merawala player link.</p>
              <pre className="p-3 rounded bg-black/50 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
{`// Request
{
  "api_key": "your_api_key",
  "file_id": "telegram_file_id",
  "file_name": "video.mp4"
}

// Response
{
  "link": "${BASE_URL}/v/abc123",
  "video_id": "abc123"
}`}
              </pre>
            </div>

            {/* Get Video API */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400">GET</span>
                <code className="text-sm text-purple-400 font-mono">{'/api/video/{video_id}'}</code>
              </div>
              <p className="text-xs text-zinc-400 mb-3">Android app calls this to get video details (file_id for playback).</p>
              <pre className="p-3 rounded bg-black/50 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
{`// Response
{
  "video_id": "abc123",
  "file_id": "telegram_file_id",
  "file_name": "video.mp4",
  "views": 150
}`}
              </pre>
            </div>

            {/* Record View API */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">POST</span>
                <code className="text-sm text-purple-400 font-mono">/api/view</code>
              </div>
              <p className="text-xs text-zinc-400 mb-3">App calls after 20+ seconds watch. Counts view & adds earnings.</p>
              <pre className="p-3 rounded bg-black/50 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
{`// Request
{
  "video_id": "abc123",
  "watch_duration": 25  // seconds
}

// Response (counted)
{
  "counted": true,
  "views": 151,
  "earnings": 0.153,
  "earned_this_view": 0.002
}

// Response (not counted - < 20s)
{
  "counted": false,
  "message": "Minimum 20 seconds watch required"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
