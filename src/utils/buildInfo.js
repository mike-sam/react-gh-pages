/**
 * 构建信息工具
 * 自动从构建时间生成版本号
 */

// 构建时间（在构建时会被替换）
// 这个值会在构建时通过环境变量或构建脚本设置
const BUILD_TIME = process.env.REACT_APP_BUILD_TIME || new Date().toISOString();

/**
 * 获取构建时间
 */
export const getBuildTime = () => {
  return BUILD_TIME;
};

/**
 * 格式化构建时间为版本号
 * 格式: YYYYMMDD-HHMM
 */
export const getBuildVersion = () => {
  try {
    const buildDate = new Date(BUILD_TIME);
    const year = buildDate.getFullYear();
    const month = String(buildDate.getMonth() + 1).padStart(2, '0');
    const day = String(buildDate.getDate()).padStart(2, '0');
    const hours = String(buildDate.getHours()).padStart(2, '0');
    const minutes = String(buildDate.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}-${hours}${minutes}`;
  } catch (error) {
    console.warn('Failed to parse build time, using current time:', error);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }
};

/**
 * 获取格式化的构建日期字符串
 */
export const getBuildDateString = () => {
  try {
    const buildDate = new Date(BUILD_TIME);
    return buildDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return new Date().toLocaleString('zh-CN');
  }
};

