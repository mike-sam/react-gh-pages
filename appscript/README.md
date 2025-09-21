# Google AppScript 代码

这个文件夹包含了用于支持记账应用的Google AppScript代码。

## 文件说明

- `main.gs` - 主要的处理逻辑
- `photo-handler.gs` - 照片上传处理
- `payment-options.gs` - 支付方式管理
- `location-merchant.gs` - 位置和商家管理

## 部署说明

1. 打开 [Google Apps Script](https://script.google.com)
2. 创建新项目
3. 将相应的代码文件内容复制到对应的 .gs 文件中
4. 部署为 Web 应用
5. 将生成的 URL 更新到 React 应用的 `config.js` 文件中

## 权限要求

- Google Sheets API (用于数据存储)
- Google Drive API (用于照片存储)
- 允许外部访问
