import { io } from 'socket.io-client';
import { useEffect, useRef } from 'react';

/** Connects a socket for the lifetime of the component and emits `watch` on (re)connect. */
export function useSocket(watchEvent, watchPayload, handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const key = JSON.stringify(watchPayload);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const s = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    sockRef.current = s;
    s.on('connect', () => s.emit(watchEvent, watchPayload));
    const names = Object.keys(handlersRef.current || {});
    names.forEach((n) => s.on(n, (...args) => handlersRef.current[n]?.(...args)));
    return () => { s.close(); sockRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchEvent, key, enabled]);
  return sockRef;
}
