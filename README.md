# 神戶・京都 行程手帖 — 專案說明（技術）

一個資料驅動的靜態行程網站。前端只負責渲染，所有內容都放在 Google Sheet，改資料即改網站。

---

## 1. 架構概觀

```
Google Sheet（發布到網路）
   ├─ CSV  ──► PapaParse ──► app.js 渲染 ──► GitHub Pages（index.html）
   └─ 網頁 ──► iframe 直接嵌入（費用區塊，不經前端）
```

- **靜態殼**：`index.html` + `app.js`，放在 GitHub Pages。
- **資料源**：Google Sheet 各分頁「發布到網路」成 CSV，前端用 PapaParse 讀取後渲染。
- **費用區塊**：不走前端讀取，直接以 `iframe` 嵌入該分頁的 `pubhtml`；唯讀顯示，登入且有編輯權者可點連結進試算表修改。
- **預訂勾選**：目前存 `localStorage`（單機），已預留 `id` 作為日後 GAS 寫回的鍵。

---

## 2. 檔案結構

| 檔案 | 內容 |
|---|---|
| `index.html` | HTML 殼、全部 CSS、四個區塊容器（`#hero`、`#days`、`#resv`、費用 `iframe`），載入 PapaParse 與 `app.js` |
| `app.js` | CSV 網址常數、`loadCSV()`、渲染函式（`renderHero` / `dayCard` / `renderResv`）、`init()` 主流程 |

> `index.html` 與 `app.js` 必須放在**同一層**（`app.js` 以相對路徑載入）；GitHub Pages 區分大小寫，檔名與 `src` 要一致。

---

## 3. 資料源（Google Sheet 分頁）

**發布文件 ID**（CSV／pubhtml 用）：`2PACX-1vR3vflXzFsxsdLDzObMSTt86Ci-nan0KjZjtnGa4QYDLPhD-8OJqg9DyzpH3KbzwQQucBXA7D2p9RMS`
**編輯文件 ID**（edit 用）：`12CES6yCyx6NC2_wbkE1wQzTZnRj9bVijkxOarPYkRso`

| 分頁 | gid | 用途 | 前端消費者 | 發布格式 |
|---|---|---|---|---|
| `site` | 49395692 | Hero（標題、航班、住宿等） | `renderHero` | CSV |
| `meta` | 0 | 每日基本資料 | `renderDays` | CSV |
| `schedule` | 469937186 | 每日行程項目 | `renderDays` | CSV |
| `reservations` | 629136767 | 預訂・確認清單 | `renderResv` | CSV |
| `costs` | 2094658140 | 費用明細 | iframe 嵌入 | 網頁（pubhtml） |

網址格式：
- CSV：`https://docs.google.com/spreadsheets/d/e/{發布ID}/pub?gid={gid}&single=true&output=csv`
- 嵌入：`https://docs.google.com/spreadsheets/d/e/{發布ID}/pubhtml?gid={gid}&single=true&widget=true&headers=false`
- 編輯：`https://docs.google.com/spreadsheets/d/{編輯ID}/edit?gid={gid}#gid={gid}`

---

## 4. 分頁 Schema

### 4.1 `site`（key / value 兩欄）

| key | 說明 |
|---|---|
| `eyebrow` | 頂端小標 |
| `title` | 主標題 |
| `subtitle` | 副標（顯示為 `<h1>` 內小字） |
| `route` | 路線，用 `|` 分段；首尾段自動加粗、段間插入「──」 |
| `fact1_k` … `fact8_k` | 資訊卡標題（最多 8 組） |
| `fact1_v` … `fact8_v` | 資訊卡內容；用 `|` 分成「主字\|小字」，小字渲染為 `<small>` |

> 卡片上限 8 組由 `renderHero` 的 `for (i=1; i<=8; i++)` 決定；要更多就改上限。空的組會自動略過。

### 4.2 `meta`（每天一列）

| 欄 | 說明 |
|---|---|
| `day` | 天數（數字，排序用） |
| `date` | 顯示用日期字串 |
| `theme` | 當天主題 |
| `tags` | 標籤，用 `|` 分隔，渲染成 pill |
| `lodging` | 住宿（目前未渲染，保留欄位） |
| `flag_style` | 提示框樣式：`fixed`＝綠框；其他值（含空白）＝黃框 |
| `flag_text` | 提示框文字；空白則不顯示提示框 |

### 4.3 `schedule`（每個行程項目一列）

| 欄 | 說明 |
|---|---|
| `id` | 固定編號（如 `D5-70`），插入／重排不影響 |
| `day` | 對應 `meta.day` |
| `seq` | 當天排序；建議用 10、20、30 間隔，方便中間插入 |
| `kind` | `hub`／`move`／`spot`／`lunch`／`dinner`／`airport`／`note` |
| `time` | 時間字串（可空） |
| `title` | 項目名稱 |
| `cost` | 費用字串（如 `¥1,300`，可空） |
| `note` | 補充說明（可空） |
| `badge` | 標記，用 `|` 疊加：`fix`→班次、`resv`→預約、`free`→免費（未知值原樣顯示） |
| `status` | 填 `blank`＝該餐做成斜紋「待填」卡 |

**渲染分流規則（`dayCard`）**：
- **時間軸**收：`hub`、`move`、`spot`，以及**有填 `time`** 的 `lunch`／`dinner`。
  - `hub`→深色大點；`spot`→實心點；`move`→淺色文字＋空心點；`lunch`/`dinner`→實心點並自動加「午餐：／晚餐：」前綴。
- **餐食欄**收：`lunch`、`dinner`、`airport`、`note`，依 `lunch → dinner/airport → note` 排序。
  - `status=blank` → 斜紋「待填」卡（用於未定的晚餐、機場餐）。
- 同一筆 `lunch`/`dinner` 若有 `time`，會**同時**出現在時間軸與餐食欄；沒 `time` 只出現在餐食欄。

### 4.4 `reservations`（每個項目一列）

| 欄 | 說明 |
|---|---|
| `id` | 固定編號（GAS 寫回的鍵） |
| `group` | 分組標題（依首次出現順序分組） |
| `group_color` | 分組圓點顏色（hex） |
| `title` | 項目 |
| `when` | 行動時間標籤 |
| `sub` | 補充說明 |
| `done` | `TRUE`／`FALSE`，決定初始勾選狀態 |

> 勾選後寫入 `localStorage`（鍵：`resv_<id>`），且**本機值會覆蓋** `done` 欄的初始值。

### 4.5 `costs`

前端**不解析**此分頁，直接以 `iframe` 嵌入 `pubhtml`，故欄位結構自由。目前採每筆一列的明細帳（項目／日幣／台幣／方式／分類），分類統計以試算表內 `SUMIF` 公式計算。

---

## 5. 部署與設定

1. **建立分頁並貼上資料**（site／meta／schedule／reservations／costs）。
2. **發布**：檔案 → 共用 → 發布到網路。
   - site／meta／schedule／reservations → 各自選分頁、格式 **CSV**。
   - costs → 選分頁、格式 **網頁**。
3. **填網址**：把四個 CSV 網址填入 `app.js` 頂端常數；把 costs 的 `pubhtml` 填入 `index.html` 的 `iframe src`、編輯網址填入其後的連結。
4. **GitHub Pages**：Settings → Pages → Source＝Deploy from a branch → 分支（如 `main`）＋ `/ (root)` → Save。等 1–3 分鐘出現網址。

---

## 6. 擴充點（技術）

- **預訂跨裝置同步**：把 `renderResv` 內「勾選存本機」那段換成呼叫 GAS `doPost`，以 `id` 為鍵寫回 `reservations.done`。前端骨架已預留 `id`，不需重寫渲染。
- **各分頁獨立錯誤處理**：`init()` 已將 site／reservations／（meta+schedule）分開載入，單一分頁失敗只影響自己的區塊。
- **Hero 卡片數**：上限 8，改 `renderHero` 迴圈上界即可。
- **匯率**：費用換算寫在試算表公式（除以 5.07），不在前端，改率只動試算表。

---

## 7. 注意事項

- **發布＝公開可讀**：勿把護照號、訂房確認碼、住址等敏感資訊放進已發布的分頁。
- **CSV 快取延遲**：改試算表後，發布的 CSV 可能延遲數分鐘才更新。
- **權限即防護**：費用嵌入為唯讀，「登入才能改」靠 Google 帳號權限（你＝編輯者、其他人＝檢視者），前端不需自寫驗證。
- **localStorage 僅單機**：換裝置／清快取即失效；需持久化才接 GAS。
