import React, { useState } from 'react';

function Remark({input, setInput, remark, setRemark, amount, selectedTag}) {
    const handleRemarkChange = (e) => {
        setRemark(e.target.value);
    }

    return (
        <>
        <textarea id="content-remark" value={remark} onChange={handleRemarkChange} />
        </>
    );
//   return (
//     <div className="row row-no-wrap m-10">
//       <textarea
//         id="content-remark"
//         placeholder="可輸入关于此笔消费的详细内容 e.g.:老板请吃"
//         value={remark}
//         onChange={handleRemarkChange}
//       />
//       <button id="button-submit" className="btn-submit btn w-100 m-10" onClick={handleSubmit}>
//         提交
//       </button>
//     </div>
//   );
}

export default Remark;
