import React from 'react';
import HeaderActions from './HeaderActions';
import { hrefFor, ROUTES } from '../utils/routing';

/**
 * Shared shell: back-to-home + location pin + theme.
 */
function PageChrome({ title, children, showHomeLink = true }) {
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
      </div>
      {children}
    </div>
  );
}

export default PageChrome;
