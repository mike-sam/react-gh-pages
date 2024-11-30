import React from 'react';

function Output(output) {
  
return (
    <div 
        className="output"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(output) }}
    />
    );
}

export default Output;
