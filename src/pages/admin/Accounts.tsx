import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../lib/store';
import { api } from '../../lib/api';
import type { User, Role, Service, ActivityEntry } from '../../lib/db';

type Modal = null | 'create' | 'edit' | 'activity' | 'confirmDelete' | 'confirmSuspend';

interface FormState { name: string; email: string; role: Role; serviceId: string; password: string; }

const generateRandomPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
    + special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 4; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

const initForm = (): FormState => ({ name: '', email: '', role: 'patient', serviceId: '', password: generateRandomPassword() });

export default function Accounts() {
  const { t, lang } = useLang();
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<FormState>(initForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [savedPwd, setSavedPwd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([
        api.users.getAll(),
        api.services.getAll()
      ]);
      setUsers(u);
      setServices(s);
    } catch (err) {
      console.error('Failed to load accounts', err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(initForm()); setEditId(null); setSavedPwd(null); setModal('create'); };
  const openEdit = (u: User) => { setForm({ name: u.name, email: u.email, role: u.role, serviceId: u.serviceId ?? '', password: '' }); setEditId(u.id); setSavedPwd(null); setModal('edit'); };
  const openActivity = async (id: string) => {
    try {
      const act = await api.users.getActivity(id);
      setActivity(act);
      setTargetId(id);
      setModal('activity');
    } catch (err) {
      console.error('Failed to load user activity', err);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    try {
      if (editId) {
        const payload: any = { name: form.name, email: form.email, role: form.role, serviceId: form.serviceId || undefined };
        if (form.password) payload.password = form.password;
        await api.users.update(editId, payload);
      } else {
        const res = await api.users.create({
          name: form.name,
          email: form.email,
          role: form.role,
          serviceId: form.serviceId || undefined,
          password: form.password
        });
        setSavedPwd(res.generatedPassword || form.password);
      }
      await load();
      setModal(null);
    } catch (err) {
      console.error('Failed to save user', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (targetId) {
      try {
        await api.users.delete(targetId);
        await load();
      } catch (err) {
        console.error('Failed to delete user', err);
      }
    }
    setModal(null);
  };

  const handleSuspend = async () => {
    if (!targetId) return;
    const u = users.find(u => u.id === targetId);
    if (u) {
      try {
        await api.users.update(targetId, { suspended: !u.suspended });
        await load();
      } catch (err) {
        console.error('Failed to toggle suspend', err);
      }
    }
    setModal(null);
  };

  const copyPwd = (pwd: string) => {
    navigator.clipboard.writeText(pwd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const roleColors: Record<Role, string> = {
    admin: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    medical: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    patient: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-serif font-bold">{t('accountsTitle')}</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('newAccount')}
        </button>
      </div>

      {savedPwd && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-3">
          <svg className="text-emerald-600 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{t('accountSaved')}</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded">{savedPwd}</code>
              <button onClick={() => copyPwd(savedPwd)} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">{copied ? t('copied') : t('copyPassword')}</button>
            </div>
          </div>
          <button onClick={() => setSavedPwd(null)} className="text-emerald-600 hover:text-emerald-800"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
          <svg className="text-muted-foreground shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground shrink-0">{filtered.length} {t('accounts')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('name')}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('email')}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('role')}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">{t('service')}</th>
                <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('status')}</th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const svc = services.find(s => s.id === u.serviceId);
                return (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{u.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${roleColors[u.role] ?? ''}`}>
                        {t(u.role)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">
                      {svc ? (lang === 'fr' ? svc.nameFr : svc.nameEn) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${u.suspended ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                        {u.suspended ? t('suspended') : t('active')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openActivity(u.id)} title={t('activityLog')} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </button>
                        <button onClick={() => openEdit(u)} title={t('edit')} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => { setTargetId(u.id); setModal('confirmSuspend'); }} title={u.suspended ? t('unsuspend') : t('suspend')} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${u.suspended ? 'text-emerald-600' : 'text-amber-600'}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        </button>
                        <button onClick={() => { setTargetId(u.id); setModal('confirmDelete'); }} title={t('delete')} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-600 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t('noData')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{modal === 'create' ? t('newAccount') : t('editAccount')}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('fullName')}</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('email')}</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('role')}</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="patient">{t('patient')}</option>
                  <option value="medical">{t('medical')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
              {form.role === 'medical' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('service')}</label>
                  <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">{lang === 'fr' ? '— Sélectionner un service —' : '— Select a service —'}</option>
                    {services.map(s => <option key={s.id} value={s.id}>{lang === 'fr' ? s.nameFr : s.nameEn}</option>)}
                  </select>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{modal === 'create' ? t('password') : `${t('password')} (${lang === 'fr' ? 'laisser vide pour ne pas changer' : 'leave empty to keep current'})`}</label>
                  {modal === 'create' && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, password: generateRandomPassword() }))}
                      className="text-xs text-primary hover:underline">{t('regeneratePassword')}</button>
                  )}
                </div>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={modal === 'edit' ? '••••••••' : ''}
                    className="w-full px-3 py-2.5 pr-10 bg-card border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">{t('cancel')}</button>
              <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity log modal */}
      {modal === 'activity' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t('activityLog')}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {activity.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">{t('noData')}</p>
              ) : activity.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl text-xs">
                  <span className="mt-0.5">⏱</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{a.action}</p>
                    <p className="text-muted-foreground font-mono mt-0.5">{new Date(a.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border text-right">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-muted rounded-xl text-sm font-medium hover:bg-muted/80">{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend confirm modal */}
      {modal === 'confirmSuspend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-semibold text-foreground text-lg">{t('confirmSuspendTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('suspendWarning')}</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">{t('no')}</button>
              <button onClick={handleSuspend} className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors">{t('yes')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {modal === 'confirmDelete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-semibold text-foreground text-lg">{t('confirmDeleteTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('deleteWarning')}</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">{t('no')}</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">{t('yes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
