import React, { useState, useEffect } from 'react';
import { createDoubleSpaceHandler, focusElement } from '../utils/keyboardNavigation';

const ItemizedDescription = ({ onChange, initialValue = '', totalAmount = 0, onItemizedTotalChange, simpleDescription, setSimpleDescription }) => {
  const [items, setItems] = useState([]);

  // Initialize with existing value if provided
  useEffect(() => {
    if (initialValue && !items.length && !simpleDescription) {
      // Try to parse if it's itemized format, otherwise use simple
      if (initialValue.includes('×') && initialValue.includes('=')) {
        // Parse itemized format
        const lines = initialValue.split('\n');
        const parsedItems = [];
        lines.forEach(line => {
          const match = line.match(/^(.+?):\s*(\d*\.?\d*)\s*×\s*(\d*\.?\d*)\s*=\s*(\d*\.?\d*)$/);
          if (match) {
            parsedItems.push({
              id: Date.now() + Math.random(),
              name: match[1],
              unitPrice: parseFloat(match[2]) || 0,
              quantity: parseFloat(match[3]) || 0,
              subtotal: parseFloat(match[4]) || 0
            });
          }
        });
        if (parsedItems.length > 0) {
          setItems(parsedItems);
        } else {
          setSimpleDescription(initialValue);
        }
      } else {
        setSimpleDescription(initialValue);
      }
    }
  }, [initialValue, items.length, simpleDescription]);

  const addNewItem = () => {
    const newItem = {
      id: Date.now(),
      name: '',
      unitPrice: 0,
      quantity: 0,
      subtotal: 0
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    
    // Auto-focus to the new item's name field
    setTimeout(() => {
      const newItemIndex = newItems.length - 1;
      const nameInput = document.querySelector(`.item-name[data-item-index="${newItemIndex}"]`);
      if (nameInput) {
        // For mobile devices, force keyboard to show
        if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)) {
          const tempInput = document.createElement('input');
          tempInput.style.position = 'absolute';
          tempInput.style.left = '-9999px';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          
          tempInput.focus();
          setTimeout(() => {
            document.body.removeChild(tempInput);
            nameInput.focus();
            nameInput.click();
          }, 50);
        } else {
          nameInput.focus();
        }
      }
    }, 100);
  };

  const removeItem = (id) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    updateParent(updatedItems);
  };

  const updateItem = (id, field, value, shouldAutoFocus = false) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        // Trim spaces from value if it's a string
        let updatedItem = { ...item };
        
        updatedItem[field] = value;
        // // Convert to numbers for c
        
        const unit = parseFloat(updatedItem.unitPrice);
        const qty = parseFloat(updatedItem.quantity);
        if (!isNaN(unit) && !isNaN(qty) && unit > 0 && qty > 0) {
          updatedItem.subtotal = parseFloat((unit * qty).toFixed(2));
        }
        
        // // Auto-calculate based on which field was changed and whether fields have values
        // if (field === 'unitPrice' || field === 'quantity') {
        //   // If both unitPrice and quantity have values, auto-calculate subtotal
        //   if (updatedItem.unitPrice > 0 && updatedItem.quantity > 0) {
        //     updatedItem.subtotal = parseFloat((updatedItem.unitPrice * updatedItem.quantity).toFixed(2));
        //   }
        // } else if (field === 'subtotal' && updatedItem.quantity > 0) {
        //   updatedItem.unitPrice = parseFloat((updatedItem.subtotal / updatedItem.quantity).toFixed(2));
        // } else if (field === 'subtotal' && updatedItem.unitPrice > 0) {
        //   updatedItem.quantity = parseFloat((updatedItem.subtotal / updatedItem.unitPrice).toFixed(2));
        // }
        
        return updatedItem;
      }
      return item;
    });
    
    setItems(updatedItems);
    updateParent(updatedItems);
    
    // Auto-focus to next field if requested
    if (shouldAutoFocus) {
      setTimeout(() => {
        focusNextInput(id, field);
      }, 50);
    }
  };

  // utils/keyboardNavigation.js (假設 createDoubleSpaceHandler 已經寫好)
  const createItemChangeHandler = (id, field, updateItem, focusNextInput) => {
    return (e) => {
      const value = e.target.value;
      updateItem(id, field, value);

      // 檢查雙空格 → 觸發導航
      createDoubleSpaceHandler((trimmedValue) => {
        updateItem(id, field, trimmedValue);

        // 跳到下一個輸入框
        focusNextInput(id, field);
      })(e);
    };
  };


  const focusNextInput = (currentId, currentField) => {
    const currentItem = items.find(item => item.id === currentId);
    const currentIndex = items.indexOf(currentItem);
    
    // Define field order based on logic
    let nextField = '';
    let nextIndex = currentIndex;
    
    if (currentField === 'name') {
      nextField = 'unitPrice';
    } else if (currentField === 'unitPrice') {
      // If unitPrice is empty and quantity has value, go to subtotal
      if (!currentItem.unitPrice && currentItem.quantity > 0) {
        nextField = 'subtotal';
      } else {
        nextField = 'quantity';
      }
    } else if (currentField === 'quantity') {
      // If both unitPrice and quantity have values, skip subtotal and go to next item
      if (currentItem.unitPrice > 0 && currentItem.quantity > 0) {
        nextIndex = currentIndex + 1;
        nextField = 'name';
        // Add new item if we're at the end
        if (nextIndex >= items.length) {
          addNewItem();
          nextIndex = items.length; // Will be the new item index
        }
      } else {
        nextField = 'subtotal';
      }
    } else if (currentField === 'subtotal') {
      nextIndex = currentIndex + 1;
      nextField = 'name';
      // Add new item if we're at the end
      if (nextIndex >= items.length) {
        if(currentItem.unitPrice > 0 && currentItem.quantity > 0 && currentItem.name.length > 0){
          addNewItem();
          nextIndex = items.length; // Will be the new item index
        } else {
          removeItem(currentId || currentIndex)
          nextIndex--;
        }
      }
    }

    
    // Focus the next input
    setTimeout(() => {
      const nextInput = document.querySelector(
        `.item-${nextField}[data-item-index="${nextIndex}"]`
      );
      if (nextInput) {
        nextInput.focus();
      }
    }, 100);
  };

  const updateParent = (itemList, description = simpleDescription) => {
    let finalText = '';
    
    if (itemList.length > 0) {
      const formattedText = itemList
        .filter(item => item.name.trim())
        .map(item => `${item.name}: ${item.unitPrice} × ${item.quantity} = ${item.subtotal}`)
        .join('\n');
      
      let total = itemList.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      total = 0;
      const itemizedText = formattedText + (formattedText ? `\n总计: ${total.toFixed(2)}` : '');
      
      // 只有当明细总额与上级金额有差异时才通知父组件（用于税费建议）
      if (onItemizedTotalChange) {
        onItemizedTotalChange(total);
      }
      
      // 合并明细和简单描述
      finalText = [itemizedText, description].filter(Boolean).join('\n\n');
    } else {
      finalText = description;
    }
    
    onChange(finalText);
  };

  // 小工具
  const toNum = v => {
    const n = Number(v);              // 字符串也会转
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = n => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

  // 计算
  const itemsTotal = (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + toNum(item?.subtotal),
    0 // ← 一定要有初始值
  );

  const totalNum = toNum(totalAmount);
  const diff = totalNum - itemsTotal;

  return (
    <div className="description-input">{/* 直接显示明细清单和备注，不需要切换 */}
      
      {/* 备注说明在上方 */}
      <div className="simple-description-section">
        <label className="section-label">备注说明:</label>
        <textarea 
          className="content-remark"
          value={simpleDescription} 
          onChange={(e)=>{
              setSimpleDescription(e.target.value);
              updateParent(items, e.target.value);
              createDoubleSpaceHandler((trimmedValue) => {
                  setSimpleDescription(trimmedValue);
                  if (items.length === 0) {
                    // Add new item and focus to its name
                    addNewItem();
                    focusElement('.item-name[data-item-index="0"]', 100);
                  } else {
                    const el = document.querySelector('.item-name[data-item-index="0"]');
                    if(items.length === 1 && el.value.trim() === ''){
                      focusElement('.item-name[data-item-index="0"]', 100);
                    } else {

                      // Focus to location section
                      focusElement('.unified-action-button');
                    }
                  }
                  
              })(e);
          }}
          autoFocus={true}
          placeholder="添加备注信息"
          rows="3"
        />
      </div>
      
      {/* 项目明细在下方，添加滚动容器 */}
      <div className="items-container">
        <div className="items-header">
          <div className="item-name-header">名称</div>
          <div className="item-price-header">单价</div>
          <div className="item-qty-header">数量</div>
          <div className="item-subtotal-header">小计</div>
          <div className="item-action-header">操作</div>
        </div>
        
        {items.map((item, index) => (
          <div key={item.id || index} className="item-row">
            <input
              type="text"
              className="item-name"
              data-item-index={index}
              value={item.name || ''}
              onChange={(e)=>{
                updateItem(item.id || index, 'name', e.target.value);
                createItemChangeHandler(item.id || index, 'name', updateItem, focusNextInput)(e);
              }}
              placeholder="项目名称"
            />
            <input
              type="text"
              className="item-unitPrice"
              data-item-index={index}
              value={item.unitPrice || ''}
              onChange={(e)=>{
                updateItem(item.id || index, 'unitPrice', e.target.value);
                createItemChangeHandler(item.id || index, 'unitPrice', updateItem, focusNextInput)(e);
              }}
              placeholder="0.00"
            />
            <input
              type="text"
              className="item-quantity"
              data-item-index={index}
              value={item.quantity || ''}
              onChange={(e)=>{
                updateItem(item.id || index, 'quantity', e.target.value);
                createItemChangeHandler(item.id || index, 'quantity', updateItem, focusNextInput)(e);
              }}
              placeholder="0"
            />
            <input
              type="text"
              className={`item-subtotal ${(item.unitPrice > 0 && item.quantity > 0) ? 'auto-calculated' : ''}`}
              data-item-index={index}
              value={item.subtotal || ''}
              onChange={(e)=>{
                updateItem(item.id || index, 'subtotal', e.target.value);
                createItemChangeHandler(item.id || index, 'subtotal', updateItem, focusNextInput)(e);
              }}
              placeholder="0.00"
              readOnly={item.unitPrice > 0 && item.quantity > 0}
            />
            <button
              type="button"
              className="remove-item-btn"
              onClick={() => removeItem(item.id || index)}
            >
              ×
            </button>
          </div>
        ))}
        
        <button type="button" className="add-item-btn" onClick={addNewItem}>
          + 添加项目
        </button>
        
        
        {(items?.length ?? 0) > 0 && (
          <div className="items-summary">
            <div className="items-total">
              明细总计: {fmt(itemsTotal)}
            </div>
            {totalAmount > 0 && (
              <div className="amount-difference">
                差额: {fmt(diff)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemizedDescription;
