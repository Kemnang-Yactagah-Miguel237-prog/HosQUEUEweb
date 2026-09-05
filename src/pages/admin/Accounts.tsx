import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../lib/store';
import { getUsers, getServices, createUser, updateUser, deleteUser, generatePassword, getUserActivity, type User, type Role, type ActivityEntry } from '../../lib/db';
import { createNotification } from '../../lib/db';

type Modal = null | 'create' | 'edit' | 'activity' | 'confirmDelete' | 'confirmSuspend';

interface FormState { name: string; email: string; role: Role; serviceId: string; password: string; }

const initForm = (): FormState => ({ name: '', email: '', role: 'patient', serviceId: '', password: generatePassword() });

export default function Accounts() {
  const { t, lang } = useLang();
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState(getServices());
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<FormState>(initForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [savedPwd, setSavedPwd] = useState<string | null>(null);

  const load = useCallback(() => { setUsers(getUsers()); setServices(getServices()); }, []);
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm(initForm()); setEditId(null); setSavedPwd(null); setModal('create'); };
  const openEdit = (u: User) => { setForm({ name: u.name, email: u.email, role: u.role, serviceId: u.serviceId ?? '', password: u.password }); setEditId(u.id); setSavedPwd(null); setModal('edit'); };
  const openActivity = (id: string) => { setActivity(getUserActivity(id)); setTargetId(id); setModal('activity'); };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (editId) {
      updateUser(editId, { name: form.name, email: form.email, role: form.role, serviceId: form.serviceId || undefined, password: form.password });
      createNotification(editId, 'Votre compte a été mis à jour.', 'Your account has been updated.', 'general');
    } else {
      const { user } = createUser({ name: form.name, email: form.email, role: form.role, serviceId: form.serviceId || undefined, password: form.password, createdBy: 'u-admin' });
      createNotification(user.id, `Bienvenue sur HosQUEUE ! Votre compte a été créé.`, `Welcome to HosQUEUE! Your account has been created.`, 'account_created');
      setSavedPwd(form.password);
    }
    load();
    setModal(null);
  };

  const handleDelete = () => {
    if (targetId) { deleteUser(targetId); load(); }
    setModal(null);
  };

  const handleSuspend = () => {
    if (!targetId) return;
    const u = users.find(u => u.id === targetId);
    if (u) updateUser(targetId, { suspended: !u.suspended });
    load();
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
        <h1 className="text-2xl font-serif">{t('accountsTitle')}</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('newAccount')}
        </button>
      </div>

      {savedPwd && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded p-4 flex items-start gap-3">
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

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <svg className="text-muted-foreground shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')}
            className="flex-1 text-sm bg-transparent focus:outline-none" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('name')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">{t('email')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('role')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">{t('status')}</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${u.suspended ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[u.role]}`}>{t(u.role)}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.suspended ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                      {u.suspended ? t('suspended') : t('active')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} title={t('edit')} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => { setTargetId(u.id); setModal('confirmSuspend'); }} title={u.suspended ? t('reactivateAccount') : t('suspendAccount')}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-amber-600">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/>{u.suspended ? <polyline points="10 8 16 12 10 16 10 8"/> : <line x1="10" y1="15" x2="10" y2="9"/>}</svg>
                      </button>
                      <button onClick={() => openActivity(u.id)} title={t('viewActivity')} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      </button>
                      {u.id !== 'u-admin' && (
                        <button onClick={() => { setTargetId(u.id); setModal('confirmDelete'); }} title={t('delete')} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</p>}
        </div>
      </div>

      {/* Create/Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-lg">{modal === 'create' ? t('createAccount') : t('editAccount')}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('accountName')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('accountEmail')}</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('accountRole')}</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role, serviceId: '' }))} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="patient">{t('patient')}</option>
                  <option value="medical">{t('medical')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
              {form.role === 'medical' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('accountService')}</label>
                  <select value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">—</option>
                    {services.map(s => <option key={s.id} value={s.id}>{lang === 'fr' ? s.nameFr : s.nameEn}</option>)}
                  </select>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('accountPassword')}</label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))} className="text-xs text-primary hover:underline">{t('regeneratePassword')}</button>
                </div>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-20 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="text-xs text-muted-foreground hover:text-foreground px-1">{showPwd ? t('hidePassword') : t('showPassword')}</button>
                  </div>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{t('reviewPassword')}</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted transition-colors">{t('cancel')}</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90 transition-opacity">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity modal */}
      {modal === 'activity' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-lg">{t('activityLog')} — {users.find(u => u.id === targetId)?.name}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('noActivity')}</p>
              ) : activity.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3 border-b border-border/50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm">{a.action}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <button onClick={() => setModal(null)} className="w-full py-2 border border-border rounded text-sm hover:bg-muted transition-colors">{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {modal === 'confirmDelete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-semibold">{t('confirmDelete')}</h3>
            <p className="text-sm text-muted-foreground">{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted">{t('cancel')}</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm suspend */}
      {modal === 'confirmSuspend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-semibold">{users.find(u => u.id === targetId)?.suspended ? t('reactivateAccount') : t('suspendAccount')}</h3>
            <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Confirmer cette action ?' : 'Confirm this action?'}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted">{t('cancel')}</button>
              <button onClick={handleSuspend} className="flex-1 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700">{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
