# Google AppScript 代码

这个文件夹包含了用于支持记账应用的Google AppScript代码。

## 文件说明

- `code.gs` - 所有功能的集成文件，包含：
  - `doGet` / `doPost` - HTTP 请求处理
  - 照片上传处理 (`handlePhotoUpload`, `uploadFileToDrive`)
  - 支付方式管理 (`getPaymentOptions`)
  - 位置和商家管理 (`getMerchants`, `updateMerchant`, `findNearestMerchant`)
  - 里程数据管理 (`getMileageData`, `updateMileage`, `calculateFuelEfficiency`)
  - 费用记录提交 (`insertRowToSheet`)

## 行事曆 URL 參數（trackCalendar）

GET 或 POST 都可，參數相同。網址：`<GAS exec URL>?action=trackCalendar&op=...&event=...`

GAS 只認日曆上**描述第一行是 `**start**`** 的行程為「進行中」。各裝置的本地畫面只是預覽，真正判斷都在 GAS。

### action

| action | 用途 |
|---|---|
| `trackCalendar` | 所有寫入（下表的 op） |
| `check_current` | 只讀，回傳進行中的行程。等同 `action=trackCalendar&op=check` |
| `calendarPing` | 測連線。任何請求帶 `op=ping` 也一樣 |

沒有 `action=check`，會回 `Unknown action`。

### op（對應頁面按鈕）

| 按鈕 | op | 要 event？ | 做什麼 |
|---|---|---|---|
| Start/Append | `append` | 要 | 同名行程開著就追加一行；沒有就新開 |
| Append If | `appendIf` | 要 | 同名行程開著才追加；沒有就什麼都不做 |
| Start New | `startNew` | 要 | 直接新開，舊的全部不動 |
| End+Start | `endStart` | 要（新的那個） | 關掉**最近一筆**進行中的，再開 event |
| End | `end` | 要 | 只關這個 event；它沒開著就什麼都不做 |
| End All | `endAll` | 不用 | 關掉過去 `days` 天內全部進行中的 |
| （無按鈕） | `start` | 要 | 關掉**全部**進行中的，再開 event。舊捷徑的預設行為 |

- op 不分大小寫，`_`、`+`、空格都可，例如 `endStart` = `end+start` = `end_start` = `end start`；`endAll` = `end all`；`appendIf` = `appendIfExists`。
- 只寫 op 名稱就好，不必再組 `endScope`。
- op 也可以直接是標題別名：`op=work` 等同 `op=start&event=Work`（`work / commute / driving / trip / sleep`）；`op=end work` 只關 Work。
- 沒帶 op 時當作 `append`。
- 其他：`home`（關掉全部並寫 `[home]`，`startHome=1` 另開 Home）、`block`（記帳用，直接建一段 start→end 的行程）、`check`、`ping`。

### 時間

- 追加類（append / appendIf）：行程結束時間延到 **timestamp + 30 分**。
- 新開（start / startNew / endStart / append 新開時）：先給 1 小時（append 新開給 30 分）。
- 結束類（end / endAll / endStart 的關閉）：結束時間 **= timestamp**。
- 行程開始時間晚於 timestamp 的，不會被關或被追加（避免舊時間戳關到未來的行程）。

### 參數

| 參數 | 必填 | 說明 |
|---|---|---|
| `action` | 是 | 見上 |
| `op` | 是 | 見上 |
| `event` | End All 以外都要 | 行程標題，任意文字，**完全相同**才算同一個（大小寫、空格都算）。`title` 是同義詞，擇一；兩個都給以 `title` 為準 |
| `timestamp` | 建議 | `2026-11-04 23:45:00`，腳本時區的本地時間。也接受 ISO（帶 Z 或 ±08:00）、10/13 位 epoch。沒帶就用 GAS 收到的當下 |
| `timestampMs` | 選填 | 毫秒 epoch。有帶就優先於 `timestamp` |
| `prefix` | 選填 | 寫在軌跡行的標註，例如 `public transportation`。空白寫 `-no input-` |
| `lat` + `lng` | 選填 | 座標。也可用 `latitude` + `longitude`，或 `latlong=1.31,103.86`（`latlng` 同義） |
| `placeName` | 選填 | 軌跡地名。沒帶但有座標時，GAS 用地圖管理的區域反查。`place` 同義 |
| `days` | 選填 | 往回找幾天內的進行中行程，1–14，預設 3。`lookbackDays` 同義 |
| `startHome` | 選填 | 只用於 `op=home`，`1` 另開 Home |
| `timestampEnd` / `timestampEndMs` / `description` | 選填 | 只用於 `op=block` |

布林值接受 `1/0`、`true/false`、`yes/no`、`on/off`。

**舊參數**：`endScope`、`endExisting`、`all`、`endAny` 只在 `op=start` / `op=end` 時有作用（給舊捷徑用）。用 `endStart`、`startNew`、`endAll` 時一律忽略，帶了也沒影響。`silent` 已無作用。

### 防重複

- GAS 一次只處理一個行事曆請求，多台裝置同時送會排隊。
- 同一個 timestamp 已經寫過的，重送會回 `mode: skipped, reason: duplicate`。
- 同標題、開始時間相差 2 分鐘內的新開，視為重複不建立。

### 範例

```
?action=trackCalendar&op=endStart&event=Shopping&timestamp=2026-11-04 23:45:00
?action=trackCalendar&op=endAll&days=3&timestamp=2026-11-04 23:45:00
?action=trackCalendar&op=append&event=Commute&prefix=public transportation&latlong=1.31,103.86
?action=check_current&days=3
```

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
