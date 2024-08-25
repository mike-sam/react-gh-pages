import React, { useState } from 'react';

function Form({input, setInput, remark, setRemark, amount}) {
    const handleRemarkChange = (e) => {
        setRemark(e.target.value);
    }

    const handleReset = () => {
        setInput('');
        setRemark('');
        // 如果有其他状态需要清空，也在这里处理
    };

    const handleSubmit = (e) => {
        // Handle form submission logic here
        e.preventDefault();
        // 提交表单的逻辑
    };

    return (
        <form onSubmit={handleSubmit}>
        <div className="form-container">
        
        <textarea value={remark} onChange={handleRemarkChange} />
        <button onClick={handleSubmit}>提交</button>
        </div>
        </form>
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

export default Form;
