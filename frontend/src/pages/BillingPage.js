import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, CreditCard, ArrowDownToLine, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_ICON = {
  pending: <Clock className="w-4 h-4 text-amber-400" />,
  approved: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  rejected: <XCircle className="w-4 h-4 text-red-400" />,
};

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto', label: 'Crypto (USDT)' },
];

export default function BillingPage() {
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balRes, wdRes] = await Promise.all([
        axios.get(`${API}/billing/balance`, { withCredentials: true }),
        axios.get(`${API}/billing/withdrawals`, { withCredentials: true }),
      ]);
      setBalance(balRes.data.balance);
      setWithdrawals(wdRes.data);
    } catch (err) {
      console.error('Failed to fetch billing', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!method || !amount) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/billing/withdraw`, {
        method,
        amount: parseFloat(amount),
        details,
      }, { withCredentials: true });
      toast.success('Withdrawal request submitted');
      setMethod('');
      setAmount('');
      setDetails({});
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderMethodFields = () => {
    switch (method) {
      case 'upi':
        return (
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">UPI ID</Label>
            <Input
              placeholder="yourname@upi"
              value={details.upi_id || ''}
              onChange={e => setDetails({ ...details, upi_id: e.target.value })}
              data-testid="upi-id-input"
              className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
            />
          </div>
        );
      case 'bank':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Account Holder Name</Label>
              <Input
                placeholder="John Doe"
                value={details.account_name || ''}
                onChange={e => setDetails({ ...details, account_name: e.target.value })}
                data-testid="bank-name-input"
                className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Account Number</Label>
              <Input
                placeholder="1234567890"
                value={details.account_number || ''}
                onChange={e => setDetails({ ...details, account_number: e.target.value })}
                data-testid="bank-account-input"
                className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">IFSC Code</Label>
              <Input
                placeholder="SBIN0001234"
                value={details.ifsc || ''}
                onChange={e => setDetails({ ...details, ifsc: e.target.value })}
                data-testid="bank-ifsc-input"
                className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
          </div>
        );
      case 'paypal':
        return (
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">PayPal Email</Label>
            <Input
              type="email"
              placeholder="you@email.com"
              value={details.paypal_email || ''}
              onChange={e => setDetails({ ...details, paypal_email: e.target.value })}
              data-testid="paypal-email-input"
              className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
            />
          </div>
        );
      case 'crypto':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Network</Label>
              <Select value={details.network || ''} onValueChange={v => setDetails({ ...details, network: v })}>
                <SelectTrigger className="bg-[#08080A] border-white/10 text-white" data-testid="crypto-network-select">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D12] border-white/10 text-white">
                  <SelectItem value="TRC20" className="text-zinc-300 focus:bg-white/5 focus:text-white">USDT TRC20</SelectItem>
                  <SelectItem value="BEP20" className="text-zinc-300 focus:bg-white/5 focus:text-white">USDT BEP20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Wallet Address</Label>
              <Input
                placeholder="T..."
                value={details.wallet_address || ''}
                onChange={e => setDetails({ ...details, wallet_address: e.target.value })}
                data-testid="crypto-wallet-input"
                className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-40 skeleton-pulse rounded-xl" />
          <div className="h-64 skeleton-pulse rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div data-testid="billing-page">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Billing & Withdraw
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your earnings and withdrawals</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Balance + Withdraw */}
          <div className="space-y-6">
            {/* Balance Card */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-500">Current Balance</p>
                  <p className="text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }} data-testid="current-balance">
                    ${balance.toFixed(2)}
                  </p>
                </div>
              </div>
              {balance < 10 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">Minimum withdrawal amount is $10.00</p>
                </div>
              )}
            </div>

            {/* Withdraw Form */}
            <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <h2 className="text-lg font-medium text-white mb-4" style={{ fontFamily: 'Outfit' }}>
                <ArrowDownToLine className="w-5 h-5 inline-block mr-2 text-purple-400" />
                Request Withdrawal
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">Amount ($)</Label>
                  <Input
                    type="number"
                    min="10"
                    step="0.01"
                    placeholder="10.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    data-testid="withdraw-amount-input"
                    className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">Withdrawal Method</Label>
                  <Select value={method} onValueChange={v => { setMethod(v); setDetails({}); }}>
                    <SelectTrigger className="bg-[#08080A] border-white/10 text-white" data-testid="withdraw-method-select">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0D0D12] border-white/10 text-white">
                      {METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value} className="text-zinc-300 focus:bg-white/5 focus:text-white">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {renderMethodFields()}

                <Button
                  onClick={handleWithdraw}
                  disabled={balance < 10 || !method || !amount || submitting}
                  data-testid="withdraw-action-button"
                  className="w-full gradient-btn text-white border-0 h-11 disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {submitting ? 'Processing...' : 'Submit Withdrawal'}
                </Button>
              </div>
            </div>
          </div>

          {/* Withdrawal History */}
          <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            <h2 className="text-lg font-medium text-white mb-4" style={{ fontFamily: 'Outfit' }}>
              <Clock className="w-5 h-5 inline-block mr-2 text-zinc-400" />
              Withdrawal History
            </h2>

            {withdrawals.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-zinc-600 mx-auto mb-4" strokeWidth={1} />
                <p className="text-zinc-400 text-sm">No withdrawals yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((w, idx) => (
                  <div
                    key={w.withdrawal_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5"
                    data-testid={`withdrawal-row-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      {STATUS_ICON[w.status] || STATUS_ICON.pending}
                      <div>
                        <p className="text-sm text-white font-medium capitalize">{w.method}</p>
                        <p className="text-xs text-zinc-500">{new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white font-medium">${w.amount.toFixed(2)}</p>
                      <p className={`text-xs capitalize ${w.status === 'approved' ? 'text-emerald-400' : w.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                        {w.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
