import { EllipsisVertical, Trash2, Unplug } from 'lucide-react';
import { api } from '../lib/api.js';
import { Menu, MenuItem, useToast } from './ui.jsx';

/** Row menu to disconnect or delete a participant. Calls onChange with the fresh host state. */
export default function ParticipantActions({ sessionId, player, onChange, dark = false }) {
  const toast = useToast();
  const run = async (method, path, msg) => {
    try {
      const d = await api(`/sessions/${sessionId}/participants/${player.id}${path}`, { method });
      onChange?.(d);
      toast(msg, 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Menu trigger={(
      <button title="Participant actions" className={`grid h-7 w-7 place-items-center rounded-lg ${dark ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
        <EllipsisVertical className="h-4 w-4" />
      </button>
    )}>
      {!player.disconnected && (
        <MenuItem
          icon={Unplug} sub="Stops their game, keeps their results"
          onClick={() => { if (confirm(`Disconnect ${player.name}? They will not be able to keep playing.`)) run('POST', '/disconnect', `${player.name} disconnected`); }}
        >Disconnect</MenuItem>
      )}
      <MenuItem
        icon={Trash2} danger sub="Removes the player and all their answers"
        onClick={() => { if (confirm(`Delete ${player.name} and all their answers? This cannot be undone.`)) run('DELETE', '', `${player.name} deleted`); }}
      >Delete</MenuItem>
    </Menu>
  );
}
