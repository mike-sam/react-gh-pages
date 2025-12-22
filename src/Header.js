import React from 'react';
import { getBuildVersion } from './utils/buildInfo';

function Header({ onClearCache }) {
    const version = getBuildVersion();
    
    return (
        <div style={{alignSelf: "center", color: "#ccc", margin: "10px 0px", width: "100%", position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <span style={{display:"flex", alignItems: "center"}}>
                Expenses record tools <b style={{marginLeft:"5px"}}>v{version}</b>
            </span>
            {onClearCache && (
                <button 
                    onClick={onClearCache}
                    style={{
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "4px",
                        color: "#ccc",
                        padding: "4px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                    title="清除缓存并重新加载"
                >
                    🔄 清除缓存
                </button>
            )}
        </div>
    );
}

export default Header;
