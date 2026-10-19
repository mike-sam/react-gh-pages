import React from 'react';
import { getBuildVersion } from './utils/buildInfo';
import { forceReload } from './utils/forceReload';

function Header({ onClearCache }) {
    const version = getBuildVersion();

    const handleForceReload = async () => {
        if (!window.confirm('將清空快取、註銷 Service Worker 並強制拉取最新版本，確定？')) {
            return;
        }
        await forceReload();
    };
    
    return (
        <div style={{alignSelf: "center", color: "#ccc", margin: "10px 0px", width: "100%", position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap"}}>
            <span style={{display:"flex", alignItems: "center"}}>
                Expenses record tools <b style={{marginLeft:"5px"}}>v{version}</b>
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button 
                    onClick={handleForceReload}
                    style={{
                        background: "rgba(255, 100, 50, 0.25)",
                        border: "1px solid rgba(255, 140, 80, 0.55)",
                        borderRadius: "4px",
                        color: "#ffcc99",
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                    title="清空 Cache Storage、註銷 SW，並以時間戳強制重載"
                >
                    🔄 強制更新
                </button>
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
                        title="清除 KeyValue 缓存并重新加载"
                    >
                        清除資料快取
                    </button>
                )}
            </div>
        </div>
    );
}

export default Header;
