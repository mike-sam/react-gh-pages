import React, { useState, useEffect } from 'react';
import { SECONDARY_TAGS } from './config';
import { createDoubleSpaceHandler, focusElement } from './utils/keyboardNavigation';

function TagSelector({ input, setInput, remark, setRemark, setAmount, selectedTag, setSelectedTag, tags, amount }) {
    const [showManualInput, setShowManualInput] = useState(false);
    const handleReset = () => {
        setInput('');
        setRemark('');
        setAmount('');
        setSelectedTag('');
        // 如果有其他状态需要清空，也在这里处理
    };

    const handleInputChange = (e) => setInput(e.target.value);
    
    // Auto-focus when manual input is shown
    useEffect(() => {
        if (showManualInput) {
            // Use a longer delay to ensure DOM is ready
            setTimeout(() => {
                const input = document.querySelector('.manual-tag-input');
                if (input) {
                    input.focus();
                    // Force keyboard on mobile by simulating a user click
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    input.dispatchEvent(clickEvent);
                    
                    // Alternative method for stubborn keyboards
                    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                        input.setAttribute('readonly', 'readonly');
                        setTimeout(() => {
                            input.removeAttribute('readonly');
                            input.focus();
                        }, 10);
                    }
                }
            }, 100);
        }
    }, [showManualInput]);
    
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
        console.log({tag,selectedTag});
        // setRemark('');
        if (selectedTag === tag) {
            setSelectedTag('');
            return;
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
            {SECONDARY_TAGS [selectedTag] ? (
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
                    <li className={`tag manual-input-tag ${showManualInput ? 'selected' : ''}`} onClick={(e) => {
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
                    className="manual-tag-input"
                    value={input} 
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
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