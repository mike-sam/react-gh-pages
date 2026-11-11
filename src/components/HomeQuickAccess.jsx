import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyHash, getHashPath, hrefFor, ROUTES } from '../utils/routing';

const LAYOUT_KEY = 'homeQuickLayout';

export const HOME_TOOLS = [
  {
    id: 'expense',
    path: ROUTES.EXPENSE,
    icon: '🧾',
    title: '記帳',
    desc: '單筆、排程、報表。URL 參數見內頁 ?',
    direct: '#/expense',
  },
  {
    id: 'photo',
    path: ROUTES.PHOTO,
    icon: '📷',
    title: '拍照記錄',
    desc: '拍照後可記錄到 Telegram，或帶去記帳。',
    direct: '#/photo',
  },
  {
    id: 'eat',
    path: ROUTES.EAT,
    icon: '🍜',
    title: '吃什麼',
    desc: '附近過去一年吃過的，轉一下。不進報表。',
    direct: '#/eat',
  },
  {
    id: 'calendar',
    path: ROUTES.CALENDAR,
    icon: '📅',
    title: '行事曆軌跡',
    desc: '記錄行程軌跡。URL 參數見內頁 ?',
    direct: '#/calendar',
  },
  {
    id: 'vehicles',
    path: ROUTES.VEHICLES,
    icon: '🚗',
    title: '車輛',
    desc: '地圖上看全部車輛，記位置與保養記帳。URL 參數見內頁 ?',
    direct: '#/vehicles',
  },
  {
    id: 'regions',
    path: ROUTES.REGIONS,
    icon: '🗺️',
    title: '地圖管理',
    desc: '區域與地標，定位時自動帶入',
    direct: '#/regions',
  },
];

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const size = raw.size === 'icons' || raw.size === 'min' ? raw.size : 'full';
    const x = Number(raw.x);
    const y = Number(raw.y);
    const floating = Boolean(raw.floating) && Number.isFinite(x) && Number.isFinite(y);
    return { size, floating, x: Number.isFinite(x) ? x : 12, y: Number.isFinite(y) ? y : 72 };
  } catch {
    return null;
  }
}

function isCurrentTool(path) {
  const here = getHashPath();
  if (path === ROUTES.EXPENSE) return here === ROUTES.EXPENSE || here === ROUTES.OBLIGATIONS;
  if (path === ROUTES.VEHICLES) return here === ROUTES.VEHICLES || here === ROUTES.PARKING;
  return here === path;
}

function openTool(path) {
  const fromPhotoPage = getHashPath() === ROUTES.PHOTO && path === ROUTES.EXPENSE;
  applyHash(hrefFor(path), {
    replace: true,
    state: {
      fromHome: true,
      ...(fromPhotoPage ? { fromPhoto: true } : {}),
    },
  });
}

function clampPos(x, y, width, height) {
  const maxX = Math.max(4, window.innerWidth - Math.max(48, width));
  const maxY = Math.max(4, window.innerHeight - Math.max(36, height));
  return {
    x: Math.min(maxX, Math.max(4, x)),
    y: Math.min(maxY, Math.max(4, y)),
  };
}

function HomeQuickAccess() {
  const saved = useRef(loadLayout());
  const [size, setSize] = useState(saved.current?.size || 'full');
  const [floating, setFloating] = useState(Boolean(saved.current?.floating));
  const [pos, setPos] = useState({
    x: saved.current?.x ?? 12,
    y: saved.current?.y ?? 72,
  });
  const navRef = useRef(null);
  const lastOpenSize = useRef(size === 'min' ? 'full' : size);

  useEffect(() => {
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({ size, floating, x: pos.x, y: pos.y })
      );
    } catch {
      /* private mode */
    }
  }, [size, floating, pos.x, pos.y]);

  useEffect(() => {
    if (!floating) return undefined;
    const onResize = () => {
      const nav = navRef.current;
      setPos((cur) => clampPos(cur.x, cur.y, nav?.offsetWidth || 80, nav?.offsetHeight || 48));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [floating]);

  const cameFromPhoto = Boolean(window.history.state?.fromPhoto);
  const tools = HOME_TOOLS.filter((tool) => !isCurrentTool(tool.path));
  if (!tools.length) return null;

  const startDrag = (event) => {
    if (event.button != null && event.button !== 0) return;
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const origin = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.preventDefault();
    const move = (ev) => {
      if (Math.hypot(ev.clientX - origin.startX, ev.clientY - origin.startY) < 6 && !origin.moved) return;
      origin.moved = true;
      const next = clampPos(
        ev.clientX - origin.dx,
        ev.clientY - origin.dy,
        nav.offsetWidth,
        nav.offsetHeight
      );
      setFloating(true);
      setPos(next);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!origin.moved) {
        if (size === 'min') setSize(lastOpenSize.current || 'full');
        return;
      }
      const dropped = clampPos(
        ev.clientX - origin.dx,
        ev.clientY - origin.dy,
        nav.offsetWidth,
        nav.offsetHeight
      );
      if (dropped.y < 56) {
        setFloating(false);
        return;
      }
      setPos(dropped);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const minimize = () => {
    if (size !== 'min') lastOpenSize.current = size;
    setSize('min');
  };

  const nav = (
    <nav
      ref={navRef}
      className={`home-quick${floating ? ' is-float' : ''}${size === 'icons' ? ' is-icons' : ''}${size === 'min' ? ' is-min' : ''}`}
      aria-label="切換功能"
      style={floating ? { left: pos.x, top: pos.y } : undefined}
    >
      <button
        type="button"
        className="home-quick-grip"
        aria-label={size === 'min' ? '拖移或展開' : '拖移'}
        title={size === 'min' ? '拖移或點一下展開' : '拖移。拖回頂端會嵌回頁首'}
        onPointerDown={startDrag}
      >
        ⠿
      </button>
      {size === 'min' ? (
        <button
          type="button"
          className="home-quick-tool"
          aria-label="展開"
          title="展開"
          onClick={() => setSize(lastOpenSize.current || 'full')}
        >
          +
        </button>
      ) : (
        <>
          {tools.map((tool) => {
            const backToPhoto = cameFromPhoto && tool.id === 'photo';
            return (
              <button
                key={tool.id}
                type="button"
                className={`home-quick-item${backToPhoto ? ' is-return' : ''}`}
                aria-label={backToPhoto ? '回拍照記錄' : tool.title}
                title={backToPhoto ? '回拍照記錄' : tool.title}
                onClick={() => openTool(tool.path)}
              >
                <span className="home-quick-icon" aria-hidden="true">{tool.icon}</span>
                <span className="home-quick-name">{backToPhoto ? '← 返回' : tool.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="home-quick-tool"
            aria-label="縮小，只留圖示"
            title="縮小，只留圖示"
            disabled={size === 'icons'}
            onClick={() => {
              lastOpenSize.current = 'icons';
              setSize('icons');
            }}
          >
            −
          </button>
          <button
            type="button"
            className="home-quick-tool"
            aria-label="放大，顯示名稱"
            title="放大，顯示名稱"
            disabled={size === 'full'}
            onClick={() => {
              lastOpenSize.current = 'full';
              setSize('full');
            }}
          >
            +
          </button>
          <button
            type="button"
            className="home-quick-tool"
            aria-label="收合"
            title="收合"
            onClick={minimize}
          >
            _
          </button>
        </>
      )}
    </nav>
  );

  if (floating && typeof document !== 'undefined') return createPortal(nav, document.body);
  return nav;
}

export default HomeQuickAccess;
