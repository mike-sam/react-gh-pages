import React from 'react';

function TagSelector({ input, setInput, remark, setRemark, setAmount, selectedTag, setSelectedTag, tags, amount }) {
    const handleReset = () => {
        setInput('');
        setRemark('');
        setAmount('');
        setSelectedTag('');
        // 如果有其他状态需要清空，也在这里处理
    };

    const secondTags = {
        '餐饮美食': ['早餐', '午餐', '晚餐', '零食', '饮料', '外卖', '聚餐'],
        '日常购物': ['超市', '便利店', '3C电子产品(含配件)', '家居用品'],
        '医疗保健': ['药品', '医疗检查', '健康保险'],
        '交通出行': ['公共交通', 'Taxi/Grab', '打油','洗车美容','维修保养', '停车费','车贷','车险'],
        '自我增值': ['教育培训', '书籍', '订阅服务'],
        '休闲娱乐': ['电影', '音乐', '游戏', '运动'],
        '服饰美容': ['服装', '化妆品', '美容护理' ],
        '旅游放松': ['旅行', '酒店', '景点门票'],
        '水电气网': ['水费', '电费', '燃气费', '网络费'],
        '投资金融': ['股票', '基金', '债券', '理财产品'],
        '人情往来': ['礼物', '红包'],
        '居家生活': ['家具', '家电', '装修','房贷', '房租', '物业管理费'],
        '宠物': ['宠物食品', '宠物用品', '宠物医疗'],
    }
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
        <div className="input-container grid grid-2">
            <input type="text" value={input} onChange={handleInputChange} placeholder="输入或选择" style={{'padding':'10px'}}/>
            <button onClick={handleReset}>清空</button>
        </div>
        <div className="secondary-tags-container">
            {secondTags[selectedTag] ? (
                <ul className="second-tag">
                    {secondTags[selectedTag].map((tag, index) => (
                        <li className={`tag ${tag === input ? 'selected' : ''}`} key={index} onClick={() => handleSecondaryTagClick(tag)}>{tag}</li>
                    ))}
                </ul>
            ) : selectedTag ? (
                <p className="help-message"><b>{selectedTag}</b> 没有预设选项,请先输入</p>
            ) : (
                <p className="help-message">请先选择Tag</p>
            )}
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