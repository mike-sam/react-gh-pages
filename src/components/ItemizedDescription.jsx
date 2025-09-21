import React, { useState, useEffect } from 'react';

const ItemizedDescription = ({ onChange, initialValue = '', totalAmount = 0, onItemizedTotalChange }) => {
  const [items, setItems] = useState([]);
  const [simpleDescription, setSimpleDescription] = useState('');

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
      quantity: 1,
      subtotal: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    updateParent(updatedItems);
  };

  const updateItem = (id, field, value) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate based on which field was changed
        if (field === 'unitPrice' || field === 'quantity') {
          updatedItem.subtotal = parseFloat((updatedItem.unitPrice * updatedItem.quantity).toFixed(2));
        } else if (field === 'subtotal' && updatedItem.quantity > 0) {
          updatedItem.unitPrice = parseFloat((updatedItem.subtotal / updatedItem.quantity).toFixed(2));
        } else if (field === 'subtotal' && updatedItem.unitPrice > 0) {
          updatedItem.quantity = parseFloat((updatedItem.subtotal / updatedItem.unitPrice).toFixed(2));
        }
        
        return updatedItem;
      }
      return item;
    });
    
    setItems(updatedItems);
    updateParent(updatedItems);
  };

  const updateParent = (itemList, description = simpleDescription) => {
    let finalText = '';
    
    if (itemList.length > 0) {
      const formattedText = itemList
        .filter(item => item.name.trim())
        .map(item => `${item.name}: ${item.unitPrice} × ${item.quantity} = ${item.subtotal}`)
        .join('\n');
      
      const total = itemList.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const itemizedText = formattedText + (formattedText ? `\n总计: ${total.toFixed(2)}` : '');
      
      // 通知父组件明细总额变化
      if (onItemizedTotalChange && total > 0) {
        onItemizedTotalChange(total);
      }
      
      // 合并明细和简单描述
      finalText = [itemizedText, description].filter(Boolean).join('\n\n');
    } else {
      finalText = description;
    }
    
    onChange(finalText);
  };

  return (
    <div className="description-input">{/* 直接显示明细清单和备注，不需要切换 */}
      
      {/* 备注说明在上方 */}
      <div className="simple-description-section">
        <label className="section-label">备注说明:</label>
        <textarea 
          className="content-remark"
          value={simpleDescription} 
          onChange={(e) => {
            setSimpleDescription(e.target.value);
            updateParent(items, e.target.value);
          }} 
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
              value={item.name || ''}
              onChange={(e) => updateItem(item.id || index, 'name', e.target.value)}
              placeholder="项目名称"
            />
            <input
              type="number"
              className="item-price"
              value={item.unitPrice || ''}
              onChange={(e) => updateItem(item.id || index, 'unitPrice', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              step="0.01"
            />
            <input
              type="number"
              className="item-quantity"
              value={item.quantity || ''}
              onChange={(e) => updateItem(item.id || index, 'quantity', parseFloat(e.target.value) || 0)}
              placeholder="1"
              step="1"
            />
            <input
              type="number"
              className="item-subtotal"
              value={item.subtotal || ''}
              onChange={(e) => updateItem(item.id || index, 'subtotal', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              step="0.01"
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
        
        {items.length > 0 && (
          <div className="items-summary">
            <div className="items-total">
              明细总计: {items.reduce((sum, item) => sum + (item.subtotal || 0), 0).toFixed(2)}
            </div>
            {totalAmount > 0 && (
              <div className="amount-difference">
                差额: {(totalAmount - items.reduce((sum, item) => sum + (item.subtotal || 0), 0)).toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemizedDescription;
