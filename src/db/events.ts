/** Tiny pub/sub so the sync manager can push shortly after a local write. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalWrite(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalWrite(): void {
  for (const l of listeners) l();
}
