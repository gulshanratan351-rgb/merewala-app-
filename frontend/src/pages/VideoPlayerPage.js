import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Zap, Download, Play, Eye, Smartphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VideoPlayerPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Try to open in Merawala App first
    tryOpenApp();
    fetchVideo();
  }, [videoId]);

  const tryOpenApp = () => {
    // Android deep link - try to open Merawala app
    const appLink = `merewala://watch/${videoId}`;
    const intentLink = `intent://watch/${videoId}#Intent;scheme=merewala;package=com.merewala.app;end`;

    // Try custom scheme first
    window.location.href = appLink;

    // Fallback: after 2 seconds if app didn't open, stay on this page
    setTimeout(() => {
      // Try intent link for Android
      if (/android/i.test(navigator.userAgent)) {
        window.location.href = intentLink;
      }
    }, 1500);
  };

  const fetchVideo = async () => {
    try {
      const res = await axios.get(`${API}/watch/${videoId}`);
      setVideo(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Video not found' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const openInApp = () => {
    const appLink = `merewala://watch/${videoId}`;
    const intentLink = `intent://watch/${videoId}#Intent;scheme=merewala;package=com.merewala.app;end`;

    if (/android/i.test(navigator.userAgent)) {
      window.location.href = intentLink;
    } else {
      window.location.href = appLink;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Opening in Merawala App...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center px-4">
        <div className="text-center">
          <Play className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-white text-lg font-medium" style={{ fontFamily: 'Outfit' }}>{error}</p>
          <p className="text-zinc-500 text-sm mt-2">This video may have been removed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex flex-col">
      {/* Header */}
      <div className="bg-[#0D0D12] border-b border-white/5 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent" style={{ fontFamily: 'Outfit' }}>
            Merawala
          </span>
        </div>
      </div>

      {/* Content - App download/open prompt */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-sm w-full text-center">
          {/* Video thumbnail / icon */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Play className="w-12 h-12 text-purple-400" strokeWidth={1.5} />
          </div>

          <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: 'Outfit' }}>
            {video?.title || video?.file_name || 'Video'}
          </h1>

          <div className="flex items-center justify-center gap-3 text-zinc-500 text-sm mb-8">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{(video?.views || 0).toLocaleString()} views</span>
            </div>
          </div>

          {/* Open in App button */}
          <button
            onClick={openInApp}
            data-testid="open-in-app-button"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl gradient-btn text-white font-medium text-base mb-4 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all"
          >
            <Smartphone className="w-5 h-5" />
            Open in Merawala App
          </button>

          {/* Download App */}
          <a
            href="https://play.google.com/store/apps/details?id=com.merewala.app"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="download-app-link"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-zinc-300 font-medium text-sm hover:bg-white/10 transition-all"
          >
            <Download className="w-5 h-5" />
            Download Merawala App
          </a>

          <p className="text-zinc-600 text-xs mt-6">
            Watch videos in Merawala App to earn money
          </p>
        </div>
      </div>
    </div>
  );
}
