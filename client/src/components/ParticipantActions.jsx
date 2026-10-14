import { EllipsisVertical, Trash2, Unplug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { Menu, MenuItem, useToast } from './ui.jsx';

/** Row menu to disconnect or delete a participant. Calls onChange with the fresh host state. */
export default function ParticipantActions({ sessionId, player, onChange, dark = false }) {
  const { t } = useTranslation('host');
  const toast = useToast();
  const run = async (method, path, msg) => {
    try {
      const d = await api(`/sessions/${sessionId}/participants/${player.id}${path}`, { method });
      onChange?.(d);
      toast(msg, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  const name = player.name;
  return (
    <Menu trigger={(
      <button title={t('actions.title')} className={`grid h-7 w-7 place-items-center rounded-lg ${dark ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
        <EllipsisVertical className="h-4 w-4" />
      </button>
    )}>
      {!player.disconnected && (
        <MenuItem
          icon={Unplug} sub={t('actions.disconnectSub')}
          onClick={() => { if (confirm(t('actions.confirmDisconnect', { name }))) run('POST', '/disconnect', t('actions.disconnected', { name })); }}
        >{t('actions.disconnect')}</MenuItem>
      )}
      <MenuItem
        icon={Trash2} danger sub={t('actions.deleteSub')}
        onClick={() => { if (confirm(t('actions.confirmDelete', { name }))) run('DELETE', '', t('actions.deleted', { name })); }}
      >{t('actions.delete')}</MenuItem>
    </Menu>
  );
}
