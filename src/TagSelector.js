
import React, { useState } from 'react';

function TagSelector({ input, setInput, setRemark }) {
    // const [input, setInput] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);
    const tags = ['餐饮美食', '日常购物', '医疗保健', '交通出行', '自我增值','休闲娱乐', '服饰美容', '旅游放松', '水电网', '人情往来', '家居硬体', '房贷房租物管', '车贷', '宠物', '其他'];
    const handleReset = () => {
        setInput('');
        setRemark('');
        // 如果有其他状态需要清空，也在这里处理
    };
    const handleInputChange = (e) => setInput(e.target.value);
    const selectTag = (tag) => {
        setInput('');
        setRemark('');
        switch(tag){
            case '餐饮美食':
                setInput('吃饭');
                setRemark('午餐');
                break;
        }
        setSelectedTag(tag);
    };

    return (
        <>
        <div className="input-container grid grid-2">
            <input type="text" value={input} onChange={handleInputChange} />
            <button onClick={handleReset}>清空</button>
        </div>
        <div className="tag-container">
            {tags.map(tag => (
                <div key={tag} className={`tag ${selectedTag === tag ? 'selected' : ''}`} onClick={() => selectTag(tag)}>
                    {tag}
                </div>
            ))}
        </div>
        </>
    );
}

export default TagSelector;

