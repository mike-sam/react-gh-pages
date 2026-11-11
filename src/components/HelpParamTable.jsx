import React from 'react';

function HelpParamTable({ rows = [] }) {
  return (
    <div className="entry-help-table-wrap">
      <table className="entry-help-table">
        <thead>
          <tr>
            <th>param</th>
            <th>必填</th>
            <th>example</th>
            <th>說明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{row.required}</td>
              <td>
                {row.example ? <code>{row.example}</code> : null}
                {'fallback' in row ? (
                  <div className="entry-help-default">
                    {`預設 ${row.fallback == null || row.fallback === '' ? '空' : row.fallback}`}
                  </div>
                ) : null}
              </td>
              <td>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HelpParamTable;
