import React from 'react';
import { useOfflineQueue } from '../context/QueueContext';

function QueueStatusBadge() {
  const { pending, flushing, flushQueue } = useOfflineQueue();
  if (!pending && !flushing) return null;

  return (
    <button
      type="button"
      className="queue-status-badge"
      onClick={() => flushQueue()}
      title="點擊重試同步"
    >
      {flushing ? '同步中…' : `🟠 ${pending} 筆待同步`}
    </button>
  );
}

export default QueueStatusBadge;
