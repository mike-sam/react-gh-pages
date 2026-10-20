import React, { useEffect, useState } from 'react';
import HeaderActions from './HeaderActions';
import { FloatingStackItem } from '../context/FloatingStackContext';
import { hrefFor, ROUTES } from '../utils/routing';

const SHOW_TOP_AFTER = 280;

/**
 * Shared shell: back-to-home + location pin + theme.
 * Scroll progress on sticky nav; back-to-top registers into floating stack.
 */
function PageChrome({ title, children, showHomeLink = true }) {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = document.documentElement;
      const scrollTop = window.scrollY || el.scrollTop || 0;
      const max = Math.max(1, el.scrollHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, scrollTop / max));
      setProgress(next);
      setShowTop(scrollTop > SHOW_TOP_AFTER);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const backToTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="page-chrome">
      <div className="page-chrome-top">
        {showHomeLink ? (
          <a className="page-home-link" href={hrefFor(ROUTES.HOME)}>
            ← 入口
          </a>
        ) : (
          <span />
        )}
        {title ? <h1 className="page-chrome-title">{title}</h1> : <span />}
        <HeaderActions compact />
        <div className="page-chrome-scroll-progress" aria-hidden>
          <div
            className="page-chrome-scroll-progress-bar"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>
      {children}

      <FloatingStackItem id="back-to-top" order={10} visible={showTop}>
        <button
          type="button"
          className="back-to-top-btn is-visible"
          onClick={backToTop}
          aria-label="回到頂部"
          title="回到頂部"
        >
          ↑
        </button>
      </FloatingStackItem>
    </div>
  );
}

export default PageChrome;
