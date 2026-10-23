import React, { useRef } from 'react';

const HOLD_MS = 650;

/** Pointer hold (~650ms) without firing the following click. Same idea as 年度 bar. */
function Holdable({ as = 'button', onHold, onClick, disabled, children, ...rest }) {
  const holdRef = useRef(0);
  const heldRef = useRef(false);
  const clearHold = () => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current);
      holdRef.current = 0;
    }
  };
  const Tag = as;
  return (
    <Tag
      type={as === 'button' ? 'button' : undefined}
      disabled={disabled}
      {...rest}
      onContextMenu={(e) => {
        if (onHold) e.preventDefault();
        rest.onContextMenu?.(e);
      }}
      onPointerDown={(e) => {
        rest.onPointerDown?.(e);
        if (disabled || !onHold) return;
        heldRef.current = false;
        clearHold();
        holdRef.current = window.setTimeout(() => {
          holdRef.current = 0;
          heldRef.current = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerUp={(e) => {
        clearHold();
        rest.onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        clearHold();
        rest.onPointerLeave?.(e);
      }}
      onPointerCancel={(e) => {
        clearHold();
        rest.onPointerCancel?.(e);
      }}
      onClick={(e) => {
        if (heldRef.current) {
          heldRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
    >
      {children}
    </Tag>
  );
}

export default Holdable;
export { HOLD_MS };
