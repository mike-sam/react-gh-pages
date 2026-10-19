import React from 'react';
import LocationStatusBar from './LocationStatusBar';
import ThemeToggle from './ThemeToggle';
import { hrefFor, ROUTES } from '../utils/routing';

/**
 * Shared shell: back-to-home + theme + optional location bar.
 */
function PageChrome({ title, showLocationBar = false, children, showHomeLink = true }) {
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
        <ThemeToggle compact />
      </div>
      {showLocationBar && <LocationStatusBar />}
      {children}
    </div>
  );
}

export default PageChrome;
