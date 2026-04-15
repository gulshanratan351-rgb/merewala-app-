import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bot, Key, Copy, RefreshCw, Webhook, FileUp, Link2, Send, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WORKFLOW_STEPS = [
  { icon: FileUp, title: 'Upload File', desc: 'User uploads a file via Telegram bot' },
  { icon: Send, title: 'Bot Sends to Server', desc: 'Bot forwards file to your server using API key' },
  { icon: Link2, title: 'Generate Link', desc: 'Server creates a monetized short link' },
  { icon: ArrowRight, title: 'Return to User', desc: 'Bot sends earning link back to the user' },
];

export default function BotInfoPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
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

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('API key copied');
  };

  return (
    <Layout>
      <div data-testid="bot-info-page">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Bot & API
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Connect your Telegram bot and manage API access</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Key Section */}
          <div className="space-y-6">
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Your API Key</h2>
                  <p className="text-xs text-zinc-500">Use this key to authenticate bot requests</p>
                </div>
              </div>

              {loading ? (
                <div className="h-11 skeleton-pulse rounded" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={showKey ? apiKey : apiKey.replace(/./g, '*').substring(0, 20) + '...'}
                      data-testid="api-key-display"
                      className="bg-[#08080A] border-white/10 text-zinc-300 font-mono text-sm flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyKey}
                      data-testid="copy-api-key-button"
                      className="border-white/10 text-zinc-400 hover:bg-white/5 hover:text-purple-400 h-10 w-10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowKey(!showKey)}
                      data-testid="toggle-api-key"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 text-sm"
                    >
                      {showKey ? 'Hide Key' : 'Show Key'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      data-testid="regenerate-api-key"
                      className="border-white/10 text-zinc-300 hover:bg-white/5 text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                      {regenerating ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Webhook Instructions */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Webhook className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>Webhook Setup</h2>
                  <p className="text-xs text-zinc-500">Connect your Telegram bot</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-2">Step 1 — Create Bot</p>
                  <p className="text-sm text-zinc-300">
                    Open Telegram, search <span className="text-purple-400 font-mono">@BotFather</span>, and create a new bot using <span className="text-purple-400 font-mono">/newbot</span>.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-2">Step 2 — Set Webhook</p>
                  <p className="text-sm text-zinc-300 mb-2">Set your bot's webhook URL to:</p>
                  <code className="block p-3 rounded bg-black/50 text-xs text-purple-400 font-mono break-all">
                    {process.env.REACT_APP_BACKEND_URL}/api/bot/upload
                  </code>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-2">Step 3 — Upload Endpoint</p>
                  <p className="text-sm text-zinc-300 mb-2">Send a POST request with your file:</p>
                  <pre className="p-3 rounded bg-black/50 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
{`POST /api/bot/upload
Content-Type: application/json

{
  "api_key": "your_api_key",
  "file_url": "https://...",
  "title": "My File"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow & Ad Placeholder */}
          <div className="space-y-6">
            {/* Workflow */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white" style={{ fontFamily: 'Outfit' }}>How It Works</h2>
                  <p className="text-xs text-zinc-500">End-to-end monetization flow</p>
                </div>
              </div>

              <div className="space-y-4">
                {WORKFLOW_STEPS.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="w-8 h-8 rounded-lg gradient-btn flex items-center justify-center flex-shrink-0 mt-0.5">
                      <step.icon className="w-4 h-4 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{step.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{step.desc}</p>
                    </div>
                    <span className="ml-auto text-xs font-semibold text-zinc-600">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ad Placeholder */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
              <h2 className="text-lg font-medium text-white mb-4" style={{ fontFamily: 'Outfit' }}>Ad Integration</h2>
              <div className="border-2 border-dashed border-white/10 rounded-lg p-8 flex flex-col items-center justify-center text-center" data-testid="ad-placeholder">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <BarChart3Icon className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-400 mb-1">Ad Banner Placeholder</p>
                <p className="text-xs text-zinc-600">AdMob / Banner ads will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function BarChart3Icon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
    </svg>
  );
}
