import React from 'react';

function Output({ output }) {
  if (!output || Object.keys(output).length === 0) return null;

  const formatOutput = (data) => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  return (
    <div className="output-container">
      <h4>📤 提交结果</h4>
      <div className="output-content">
        <pre>
          {formatOutput(output)}
        </pre>
      </div>
    </div>
  );
}

export default Output;
