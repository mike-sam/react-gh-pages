
import React, { useState } from 'react';

function TagSelector({ input, setInput, setRemark, setAmount, selectedTag, setSelectedTag, tags}) {
    const handleReset = () => {
        setInput('');
        setRemark('');
        setAmount('0');
        // 如果有其他状态需要清空，也在这里处理
    };
    const handleInputChange = (e) => setInput(e.target.value);
    const selectTag = (tag) => {
        setInput('');
        setRemark('');
        if (selectedTag == tag) {
            setSelectedTag('');
            return;
        }
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

