import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { SECONDARY_TAGS } from './config';
import { createDoubleSpaceHandler, focusElement } from './utils/keyboardNavigation';
import SelectInput from '@mui/material/Select/SelectInput';

function TagSelector({ input, setInput, remark, setRemark, setAmount, selectedTag, setSelectedTag, tags, amount }) {
    const [showManualInput, setShowManualInput] = useState(false);
    const manualInputRef = useRef(null);
    const handleReset = () => {
        setInput('');
        setRemark('');
        setAmount('');
        setShowManualInput(false);
        setSelectedTag('');
        // 如果有其他状态需要清空，也在这里处理
    };

    const handleInputChange = (e) => setInput(e.target.value);
    
    // Auto-focus when manual input is shown
    useLayoutEffect(() => {
        if (showManualInput && manualInputRef.current) {
            focusElement('.manual-tag-input',200);
            manualInputRef.current.focus();
        }
    }, [showManualInput, selectedTag]);
    
    // Double space navigation handler
    const handleKeyDown = createDoubleSpaceHandler((trimmedValue) => {
        setInput(trimmedValue);
        // Show calculator if conditions are met
        if (window.showCalculator) {
            window.showCalculator();
        } else {
            focusElement('.mobile-amount-display, .calculator-btn');
        }
    });
    const selectTag = (tag) => {
        setInput('');
        // setRemark('');
        if (selectedTag === tag) {
            setSelectedTag('');
            return;
        }
        if(selectedTag == '其他'){
            setShowManualInput(true);
        } 
        setSelectedTag(tag);
    };

    const handleSecondaryTagClick = (tag) => {
        if (tag === '手动输入') {
            setShowManualInput(true);
            setInput('');
        } else {
            setInput(tag);
            setShowManualInput(false);
            setTimeout(() => {
                if (window.showCalculator) {
                    window.showCalculator();
                }
            }, 80); // Slightly longer delay to ensure blur is processed
        }
    };

    const handleManualInputClick = () => {
        // This ensures keyboard pops up on mobile because it's a direct user interaction
        const input = document.querySelector('.manual-tag-input');
        if (input) {
            input.focus();
            // For iOS, we need to trigger a click to ensure keyboard shows
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                input.click();
            }
        }
    };

    const handleInputBlur = () => {
        // Show calculator when user leaves the tag input field
        if (selectedTag && input.trim() && (!amount || amount === '0' || amount === '')) {
            // The showCalculator function will handle keyboard hiding
            setTimeout(() => {
                if (window.showCalculator) {
                    window.showCalculator();
                }
            }, 150); // Slightly longer delay to ensure blur is processed
        }
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
            {SECONDARY_TAGS [selectedTag] && SECONDARY_TAGS[selectedTag].length > 0 ? (
                <ul className="second-tag">
                    {SECONDARY_TAGS [selectedTag].map((tag, index) => (
                        <li className={`tag ${tag === input ? 'selected' : ''}`} key={index} onClick={() => handleSecondaryTagClick(tag)}>{tag}</li>
                    ))}
                    <li className={`tag manual-input-tag ${showManualInput ? 'selected' : ''}`} onClick={(e) => {
                        e.stopPropagation();
                        setShowManualInput(true);
                        setInput('');
                    }}>手动输入</li>
                </ul>
            ) : selectedTag ? (
                <ul className="second-tag">
                    <li className={`tag manual-input-tag ${showManualInput ? 'selected' : 'selected'}`} onClick={(e) => {
                        e.stopPropagation();
                        setShowManualInput(true);
                        setInput('');
                    }}>手动输入</li>
                </ul>
            ) : (
                <p className="help-message">请先选择Tag</p>
            )}
        </div>
        
        {/* 手动输入框只在选择"手动输入"后显示 */}
        {(showManualInput || !SECONDARY_TAGS[selectedTag]) && selectedTag && (
            <div className="input-container grid grid-2">
                <input 
                    type="text" 
                    ref={manualInputRef}
                    className="manual-tag-input"
                    value={input} 
                    onChange={(e)=>{
                        setInput(e.target.value);
                        createDoubleSpaceHandler((trimmedValue) => {
                            setInput(trimmedValue);

                            // 雙空格後跳到下一個輸入框
                            if (window.showCalculator) {
                                window.showCalculator();
                            }
                        })(e);
                    }}

                    onBlur={handleInputBlur}
                    onClick={handleManualInputClick}
                    autoFocus
                    placeholder="输入或选择" 
                    style={{'padding':'10px'}}
                />
                <button onClick={handleReset}>清空</button>
            </div>
        )}
        </>
    );
}

export default TagSelector;