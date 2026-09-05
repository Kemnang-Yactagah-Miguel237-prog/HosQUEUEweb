import { useState, useCallback } from 'react';
import { useLang } from '../../lib/store';
import { getServices, createService, updateService, deleteService, type Service } from '../../lib/db';

type Modal = null | 'create' | 'edit' | 'confirmDelete';
interface FormState { nameFr: string; nameEn: string; capacity: number; bookingFee: number; active: boolean; }
const initForm = (): FormState => ({ nameFr: '', nameEn: '', capacity: 30, bookingFee: 1000, active: true });

export default function Services() {
  const { t, lang } = useLang();
  const [services, setServices] = useState<Service[]>(getServices);
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<FormState>(initForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const reload = useCallback(() => setServices(getServices()), []);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  const openCreate = () => { setForm(initForm()); setEditId(null); setModal('create'); };
  const openEdit = (s: Service) => { setForm({ nameFr: s.nameFr, nameEn: s.nameEn, capacity: s.capacity, bookingFee: s.bookingFee, active: s.active }); setEditId(s.id); setModal('edit'); };

  const handleSave = () => {
    if (!form.nameFr.trim() || !form.nameEn.trim()) return;
    if (editId) { updateService(editId, form); }
    else { createService(form); }
    reload();
    showFlash(t('serviceSaved'));
    setModal(null);
  };

  const handleToggle = (id: string, active: boolean) => { updateService(id, { active: !active }); reload(); };

  const handleDelete = () => {
    if (deleteId) { deleteService(deleteId); reload(); showFlash(t('serviceDeleted')); }
    setModal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-serif">{t('servicesTitle')}</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('newService')}
        </button>
      </div>

      {flash && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded text-sm font-medium">{flash}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(s => (
          <div key={s.id} className={`bg-card border rounded p-5 space-y-4 ${s.active ? 'border-border' : 'border-border/50 opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{lang === 'fr' ? s.nameFr : s.nameEn}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{lang === 'fr' ? s.nameEn : s.nameFr}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                {s.active ? t('serviceActive') : t('serviceInactiveLabel')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{t('serviceCapacity')}</p>
                <p className="font-mono font-bold mt-0.5">{s.capacity}</p>
              </div>
              <div className="bg-muted/50 rounded p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{t('serviceBookingFee')}</p>
                <p className="font-mono font-bold mt-0.5">{s.bookingFee.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => openEdit(s)} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {t('edit')}
              </button>
              <button onClick={() => handleToggle(s.id, s.active)} className={`flex-1 py-1.5 text-xs font-semibold border rounded transition-colors ${s.active ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400'}`}>
                {s.active ? t('deactivateService') : t('activateService')}
              </button>
              <button onClick={() => { setDeleteId(s.id); setModal('confirmDelete'); }} className="p-1.5 text-muted-foreground hover:text-red-600 border border-border rounded hover:bg-muted transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="col-span-full text-center py-8 text-sm text-muted-foreground">{t('noData')}</p>}
      </div>

      {/* Create/Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-lg">{modal === 'create' ? t('createService') : t('editService')}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="p-5 space-y-4">
              {[{ key: 'nameFr', label: t('serviceNameFr') }, { key: 'nameEn', label: t('serviceNameEn') }].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('serviceCapacity')}</label>
                  <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('serviceBookingFee')}</label>
                  <input type="number" min="0" value={form.bookingFee} onChange={e => setForm(f => ({ ...f, bookingFee: +e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-10 h-5.5 rounded-full transition-colors relative ${form.active ? 'bg-primary' : 'bg-muted'}`}
                  style={{ height: '22px', width: '40px' }}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ width: '18px', height: '18px' }} />
                </div>
                <span className="text-sm font-medium">{form.active ? t('serviceActive') : t('serviceInactiveLabel')}</span>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted">{t('cancel')}</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
