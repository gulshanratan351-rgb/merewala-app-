import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bot, Key, Copy, RefreshCw, CheckCircle2, Wifi, WifiOff, Code2, ArrowRight, FileUp, Link2, Play } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export default function BotInfoPage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/bot/api-key`, { withCredentials: true });
        setApiKey(res.data.api_key);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await axios.post(`${API}/bot/regenerate-key`, {}, { withCredentials: true });
      setApiKey(res.data.api_key);
      toast.success('API key regenerated');
    } catch (err) { toast.error('Failed'); }
    finally { setRegenerating(false); }
  };

  const copyText = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };

  const STEPS = [
    { icon: Bot, title: 'Open Telegram Bot', desc: 'Search @Gwala_bot on Telegram and start it' },
    { icon: FileUp, title: 'Send any video', desc: 'Upload a video file to the bot' },
    { icon: Link2, title: 'Get earning link', desc: 'Bot generates merawala.xyz/watch/CODE' },
    { icon: Play, title: 'Share & earn', desc: 'People watch → views count → you earn money' },
  ];

  return (
    <Layout>
      <div data-testid="bot-info-page">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Bot Integration
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Connect your Telegram bot to upload videos and earn</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Bot Status */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Bot Status</h2>
                    <p className="text-xs text-zinc-500">Telegram webhook connection</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">Connected</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-xs text-zinc-500 mb-1">Webhook URL</p>
                <code className="text-xs text-purple-400 font-mono break-all">{BASE_URL}/api/telegram/webhook</code>
              </div>
            </div>

            {/* API Key */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>API Key</h2>
                  <p className="text-xs text-zinc-500">For external integrations (optional)</p>
                </div>
              </div>
              {loading ? (
                <div className="h-11 skeleton-pulse rounded" />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={showKey ? apiKey : '••••••••••••••••••••'} data-testid="api-key-display"
                      className="bg-[#08080A] border-white/10 text-zinc-300 font-mono text-sm flex-1" />
                    <Button variant="outline" size="icon" onClick={() => copyText(apiKey, 'API key')} data-testid="copy-api-key-button"
                      className="border-white/10 text-zinc-400 hover:bg-white/5 hover:text-purple-400 h-10 w-10">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowKey(!showKey)} data-testid="toggle-api-key"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 text-xs h-9">
                      {showKey ? 'Hide' : 'Show'}
                    </Button>
                    <Button variant="outline" onClick={handleRegenerate} disabled={regenerating} data-testid="regenerate-api-key"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 text-xs h-9">
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Earning Rates */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <h3 className="text-base font-medium text-white mb-4" style={{ fontFamily: 'Outfit' }}>Earning Rates</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <p className="text-xs text-zinc-500 mb-1">First 1K Views</p>
                  <p className="text-lg font-semibold text-purple-400" style={{ fontFamily: 'Outfit' }}>$1 CPM</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <p className="text-xs text-zinc-500 mb-1">After 1K Views</p>
                  <p className="text-lg font-semibold text-emerald-400" style={{ fontFamily: 'Outfit' }}>$2 CPM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* How It Works */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <h2 className="text-lg font-medium text-white mb-5" style={{ fontFamily: 'Outfit' }}>How It Works</h2>
              <div className="space-y-3">
                {STEPS.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-4 h-4 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{step.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{step.desc}</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-700">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* API Docs for external use */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>API Reference</h2>
                  <p className="text-xs text-zinc-500">For custom bot / app integration</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">POST</span>
                    <code className="text-xs text-purple-400 font-mono">/api/generate-link</code>
                    <button onClick={() => copyText(`${BASE_URL}/api/generate-link`, 'URL')} className="ml-auto p-1 rounded hover:bg-white/5 text-zinc-600 hover:text-purple-400">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500">Create video link (needs api_key, file_id, file_name)</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">GET</span>
                    <code className="text-xs text-purple-400 font-mono">/api/watch/{'{code}'}</code>
                  </div>
                  <p className="text-[11px] text-zinc-500">Public — Player app fetches video data</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">POST</span>
                    <code className="text-xs text-purple-400 font-mono">/api/update-views</code>
                  </div>
                  <p className="text-[11px] text-zinc-500">Public — Player calls at 80% watch</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">GET</span>
                    <code className="text-xs text-purple-400 font-mono">/api/public/related/{'{code}'}</code>
                  </div>
                  <p className="text-[11px] text-zinc-500">Public — Related approved videos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
