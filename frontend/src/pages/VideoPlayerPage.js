import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Play, Eye, Clock, Zap, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VideoPlayerPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [watchTime, setWatchTime] = useState(0);
  const [viewCounted, setViewCounted] = useState(false);
  const [counting, setCounting] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchVideo();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      const res = await axios.get(`${API}/video/${videoId}`);
      setVideo(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Video not found' : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setWatchTime(prev => {
        const next = prev + 1;
        if (next >= 20 && !viewCounted) {
          recordView();
        }
        return next;
      });
    }, 1000);
  };

  const handlePause = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const recordView = async () => {
    if (viewCounted || counting) return;
    setCounting(true);
    try {
      const res = await axios.post(`${API}/view`, {
        video_id: videoId,
        watch_duration: 20,
      });
      if (res.data.counted) {
        setViewCounted(true);
      }
    } catch (err) {
      console.error('Failed to record view', err);
    } finally {
      setCounting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-zinc-400 text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="text-center">
          <Play className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-white text-lg font-medium" style={{ fontFamily: 'Outfit' }}>{error}</p>
          <p className="text-zinc-500 text-sm mt-2">This video may have been removed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305]">
      {/* Header */}
      <div className="bg-[#0D0D12] border-b border-white/5 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent" style={{ fontFamily: 'Outfit' }}>
            Merawala
          </span>
        </div>
      </div>

      {/* Video Player */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Video */}
          {video?.file_url ? (
            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                src={video.file_url}
                controls
                autoPlay
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handlePause}
                className="w-full h-full"
                data-testid="video-player"
              />
            </div>
          ) : (
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Video playback available in Merawala App</p>
                <p className="text-zinc-600 text-xs mt-1">Download the app to watch this video</p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 sm:p-6">
            <h1 className="text-lg sm:text-xl font-medium text-white mb-3" style={{ fontFamily: 'Outfit' }}>
              {video?.file_name || 'Video'}
            </h1>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Eye className="w-4 h-4" />
                <span>{video?.views?.toLocaleString() || 0} views</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="w-4 h-4" />
                <span>{watchTime}s watched</span>
              </div>
            </div>

            {/* View Status */}
            <div className="mt-4">
              {viewCounted ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 text-sm font-medium">View counted! Earning added.</span>
                </div>
              ) : watchTime > 0 ? (
                <div className="relative">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-purple-400 text-sm font-medium">
                      {watchTime < 20 ? `Watch ${20 - watchTime}s more to count view...` : 'Recording view...'}
                    </span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (watchTime / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <Play className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-500 text-sm">Play video for 20s to earn</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
