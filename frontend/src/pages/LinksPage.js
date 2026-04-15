import React, { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Copy, Pencil, Trash2, ExternalLink, Link2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LinksPage() {
  const [links, setLinks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLink, setEditLink] = useState(null);
  const [form, setForm] = useState({ title: '', original_url: '' });

  const fetchLinks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/links?search=${search}`, { withCredentials: true });
      setLinks(res.data);
    } catch (err) {
      console.error('Failed to fetch links', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCreate = async () => {
    if (!form.title || !form.original_url) return;
    try {
      await axios.post(`${API}/links`, form, { withCredentials: true });
      toast.success('Link created successfully');
      setForm({ title: '', original_url: '' });
      setCreateOpen(false);
      fetchLinks();
    } catch (err) {
      toast.error('Failed to create link');
    }
  };

  const handleEdit = async () => {
    if (!editLink) return;
    try {
      await axios.put(`${API}/links/${editLink.link_id}`, form, { withCredentials: true });
      toast.success('Link updated');
      setEditOpen(false);
      setEditLink(null);
      fetchLinks();
    } catch (err) {
      toast.error('Failed to update link');
    }
  };

  const handleDelete = async (linkId) => {
    try {
      await axios.delete(`${API}/links/${linkId}`, { withCredentials: true });
      toast.success('Link deleted');
      fetchLinks();
    } catch (err) {
      toast.error('Failed to delete link');
    }
  };

  const copyLink = (shortCode) => {
    navigator.clipboard.writeText(`https://ms.link/${shortCode}`);
    toast.success('Link copied to clipboard');
  };

  const openEdit = (link) => {
    setEditLink(link);
    setForm({ title: link.title, original_url: link.original_url });
    setEditOpen(true);
  };

  return (
    <Layout>
      <div data-testid="links-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Link Manager
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Create, manage & track your monetized links</p>
          </div>
          <Button
            onClick={() => { setForm({ title: '', original_url: '' }); setCreateOpen(true); }}
            data-testid="create-link-button"
            className="gradient-btn text-white border-0 h-10 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Link
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search links by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="search-links-input"
            className="pl-10 bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 h-11 max-w-md"
          />
        </div>

        {/* Table */}
        <div className="bg-[#0D0D12] border border-white/[0.06] rounded-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 skeleton-pulse rounded" />)}
            </div>
          ) : links.length === 0 ? (
            <div className="p-12 text-center">
              <Link2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" strokeWidth={1} />
              <p className="text-zinc-400 text-sm">No links found. Create your first link to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Title</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Short Link</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Views</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Earnings</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-zinc-500 font-semibold bg-black/40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link, idx) => (
                    <TableRow key={link.link_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      data-testid={`link-row-${idx}`}
                    >
                      <TableCell className="text-white font-medium text-sm">{link.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 text-sm font-mono">ms.link/{link.short_code}</span>
                          <button
                            onClick={() => copyLink(link.short_code)}
                            data-testid={`copy-link-button-${idx}`}
                            className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-purple-400 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-zinc-300 text-sm">{link.views?.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-400 text-sm font-medium">${link.earnings?.toFixed(2)}</TableCell>
                      <TableCell className="text-zinc-500 text-sm">{new Date(link.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => window.open(link.original_url, '_blank')}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-blue-400 transition-colors"
                            title="Open original"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(link)}
                            data-testid={`edit-link-button-${idx}`}
                            className="p-2 rounded hover:bg-white/5 text-zinc-500 hover:text-amber-400 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(link.link_id)}
                            data-testid={`delete-link-button-${idx}`}
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

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-[#0D0D12] border border-white/10 text-white sm:max-w-md" data-testid="create-link-dialog">
            <DialogHeader>
              <DialogTitle className="text-white" style={{ fontFamily: 'Outfit' }}>Create New Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Title</Label>
                <Input
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="My awesome file" data-testid="link-title-input"
                  className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Original URL</Label>
                <Input
                  value={form.original_url} onChange={e => setForm({ ...form, original_url: e.target.value })}
                  placeholder="https://example.com/file.zip" data-testid="link-url-input"
                  className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-white/10 text-zinc-300 hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={handleCreate} data-testid="confirm-create-link" className="gradient-btn text-white border-0">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-[#0D0D12] border border-white/10 text-white sm:max-w-md" data-testid="edit-link-dialog">
            <DialogHeader>
              <DialogTitle className="text-white" style={{ fontFamily: 'Outfit' }}>Edit Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Title</Label>
                <Input
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  data-testid="edit-link-title-input"
                  className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Original URL</Label>
                <Input
                  value={form.original_url} onChange={e => setForm({ ...form, original_url: e.target.value })}
                  data-testid="edit-link-url-input"
                  className="bg-[#08080A] border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} className="border-white/10 text-zinc-300 hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={handleEdit} data-testid="confirm-edit-link" className="gradient-btn text-white border-0">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
