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
                <code>{row.example}</code>
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
