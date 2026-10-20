import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

const FloatingStackContext = createContext(null);

/**
 * Bottom-right floating action stack.
 * Items register via useFloatingStackItem / <FloatingStackItem />;
 * provider lays them out in a column (low order = closer to bottom).
 */
export function FloatingStackProvider({ children }) {
  const [items, setItems] = useState([]);

  const upsert = useCallback((entry) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== entry.id);
      next.push(entry);
      next.sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => ({ upsert, remove }), [upsert, remove]);

  return (
    <FloatingStackContext.Provider value={value}>
      {children}
      <div className="floating-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="floating-stack-slot">
            {item.node}
          </div>
        ))}
      </div>
    </FloatingStackContext.Provider>
  );
}

export function useFloatingStack() {
  const ctx = useContext(FloatingStackContext);
  if (!ctx) {
    throw new Error('useFloatingStack must be used within FloatingStackProvider');
  }
  return ctx;
}

/**
 * Push a floating control into the shared bottom-right stack.
 * Renders nothing in-place; content appears in the stack.
 */
export function FloatingStackItem({ id, order = 0, visible = true, children }) {
  const ctx = useContext(FloatingStackContext);

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

export default FloatingStackContext;
