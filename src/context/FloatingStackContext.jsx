import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

const FloatingStackDispatchContext = createContext(null);
const FloatingStackStateContext = createContext([]);

/**
 * Bottom-right floating action stack.
 *
 * Important: dispatch and state are split so upsert/remove only re-render the
 * overlay — NOT the whole app tree. Putting items state above {children} caused
 * an iOS/production white-screen loop:
 *   upsert → Provider setState → App re-render → new `children` element →
 *   FloatingStackItem effect → upsert → …
 */
export function FloatingStackProvider({ children }) {
  const [items, setItems] = useState([]);

  const upsert = useCallback((entry) => {
    setItems((prev) => {
      const without = prev.filter((x) => x.id !== entry.id);
      const next = [...without, entry];
      next.sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => {
      if (!prev.some((x) => x.id === id)) return prev;
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const dispatch = useMemo(() => ({ upsert, remove }), [upsert, remove]);

  return (
    <FloatingStackDispatchContext.Provider value={dispatch}>
      {children}
      <FloatingStackStateContext.Provider value={items}>
        <FloatingStackOverlay />
      </FloatingStackStateContext.Provider>
    </FloatingStackDispatchContext.Provider>
  );
}

function FloatingStackOverlay() {
  const items = useContext(FloatingStackStateContext);
  return (
    <div className="floating-stack" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="floating-stack-slot">
          {item.node}
        </div>
      ))}
    </div>
  );
}

export function useFloatingStack() {
  const ctx = useContext(FloatingStackDispatchContext);
  if (!ctx) {
    throw new Error('useFloatingStack must be used within FloatingStackProvider');
  }
  return ctx;
}

/**
 * Push a floating control into the shared bottom-right stack.
 * Renders nothing in-place; content appears in the overlay.
 */
export function FloatingStackItem({ id, order = 0, visible = true, children }) {
  const ctx = useContext(FloatingStackDispatchContext);

  useLayoutEffect(() => {
    if (!ctx) return undefined;
    if (!visible) {
      ctx.remove(id);
      return () => ctx.remove(id);
    }
    ctx.upsert({ id, order, node: children });
    return () => ctx.remove(id);
  }, [ctx, id, order, visible, children]);

  return null;
}

export default FloatingStackDispatchContext;
