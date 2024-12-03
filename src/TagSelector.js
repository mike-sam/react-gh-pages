import React from 'react';
import { SECONDARY_TAGS } from './config';

function TagSelector({ input, setInput, remark, setRemark, setAmount, selectedTag, setSelectedTag, tags, amount }) {
    const handleReset = () => {
        setInput('');
        setRemark('');
        setAmount('');
        setSelectedTag('');
        // 如果有其他状态需要清空，也在这里处理
    };

    const handleInputChange = (e) => setInput(e.target.value);
    const selectTag = (tag) => {
        setInput('');
        console.log({tag,selectedTag});
        // setRemark('');
        if (selectedTag === tag) {
            setSelectedTag('');
            return;
        }
        setSelectedTag(tag);
    };

    const handleSecondaryTagClick = (tag) => {
        setInput(tag);
        // setRemark('');
    };


    return (
        <>
        
        
        <div className="tag-container">
            {tags.map(tag => (
                <div key={tag} className={`tag ${selectedTag === tag ? 'selected' : ''}`} onClick={() => selectTag(tag)}>
                    {tag}
                </div>
            ))}
        </div>
        <div className="secondary-tags-container">
            {SECONDARY_TAGS [selectedTag] ? (
                <ul className="second-tag">
                    {SECONDARY_TAGS [selectedTag].map((tag, index) => (
                        <li className={`tag ${tag === input ? 'selected' : ''}`} key={index} onClick={() => handleSecondaryTagClick(tag)}>{tag}</li>
                    ))}
                </ul>
            ) : selectedTag ? (
                <p className="help-message"><b>{selectedTag}</b> 没有预设选项,请先输入</p>
            ) : (
                <p className="help-message">请先选择Tag</p>
            )}
        </div>
        <div className="input-container grid grid-2">
            <input type="text" value={input} onChange={handleInputChange} placeholder="输入或选择" style={{'padding':'10px'}}/>
            <button onClick={handleReset}>清空</button>
        </div>
        </>
    );
}

export default TagSelector;