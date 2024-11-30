import React from 'react';

function Log({log}) {
  // const [log, setLog] = useState('');

  // useEffect(() => {
  //   // appendLog()
  // }, [input]);

  
  return (
    <div className="log">
      {log.map((entry, index) => (
        <pre key={index}>{entry}</pre>
      ))}
    </div>
  );
}

export default Log;
