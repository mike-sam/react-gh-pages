import { API_ENDPOINTS } from '../config';

const CACHE_PREFIX = 'kv_cache_';
const CACHE_TIMESTAMP_PREFIX = 'kv_cache_ts_';
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * 获取Key-Value值（带缓存）
 * @param {string} key - 要获取的key
 * @returns {Promise<{success: boolean, value: any, updatedAt: string|null}>}
 */
export async function getKeyValue(key) {
  if (!key) {
    return { success: false, value: null, error: 'Key is required' };
  }

  // 检查缓存
  const cacheKey = CACHE_PREFIX + key;
  const timestampKey = CACHE_TIMESTAMP_PREFIX + key;
  const cached = localStorage.getItem(cacheKey);
  const cacheTimestamp = localStorage.getItem(timestampKey);
  const now = new Date().getTime();

  // 如果缓存存在且未过期（24小时内），直接返回
  if (cached && cacheTimestamp && (now - parseInt(cacheTimestamp)) < ONE_DAY) {
    try {
      const parsed = JSON.parse(cached);
      return { success: true, value: parsed.value, updatedAt: parsed.updatedAt };
    } catch (e) {
      console.warn('Failed to parse cached key-value:', e);
    }
  }

  // 从服务器获取
  try {
    const url = new URL(API_ENDPOINTS.KEY_VALUE);
    url.searchParams.append('action', 'getKeyValue');
    url.searchParams.append('key', key);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.success) {
      // 更新缓存
      localStorage.setItem(cacheKey, JSON.stringify({ value: data.value, updatedAt: data.updatedAt }));
      localStorage.setItem(timestampKey, now.toString());
      return { success: true, value: data.value, updatedAt: data.updatedAt };
    } else {
      return { success: false, value: null, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error('Error fetching key-value:', error);
    // 如果网络错误但有缓存，返回缓存（即使过期）
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { success: true, value: parsed.value, updatedAt: parsed.updatedAt, fromCache: true };
      } catch (e) {
        // ignore
      }
    }
    return { success: false, value: null, error: error.toString() };
  }
}

/**
 * 设置Key-Value值
 * @param {string} key - 要设置的key
 * @param {any} value - 要设置的值
 * @returns {Promise<{success: boolean, value: any, updatedAt: string|null}>}
 */
export async function setKeyValue(key, value) {
  if (!key) {
    return { success: false, value: null, error: 'Key is required' };
  }

  try {
    const response = await fetch(API_ENDPOINTS.KEY_VALUE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'setKeyValue',
        key: key,
        value: value
      })
    });

    const data = await response.json();

    if (data.success) {
      // 更新缓存
      const cacheKey = CACHE_PREFIX + key;
      const timestampKey = CACHE_TIMESTAMP_PREFIX + key;
      const now = new Date().getTime();
      localStorage.setItem(cacheKey, JSON.stringify({ value: data.value, updatedAt: data.updatedAt }));
      localStorage.setItem(timestampKey, now.toString());
      return { success: true, value: data.value, updatedAt: data.updatedAt };
    } else {
      return { success: false, value: null, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error('Error setting key-value:', error);
    return { success: false, value: null, error: error.toString() };
  }
}

/**
 * 清除指定key的缓存
 * @param {string} key - 要清除的key（如果为空，清除所有key-value缓存）
 */
export function clearKeyValueCache(key = null) {
  if (key) {
    localStorage.removeItem(CACHE_PREFIX + key);
    localStorage.removeItem(CACHE_TIMESTAMP_PREFIX + key);
  } else {
    // 清除所有key-value缓存
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith(CACHE_PREFIX) || k.startsWith(CACHE_TIMESTAMP_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
  }
}

