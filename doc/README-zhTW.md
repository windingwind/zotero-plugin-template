# Literature PDF Export for Zotero

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

一個 Zotero 7 外掛，可將收藏集或選取項目中的 PDF 附件匯出到本機資料夾（例如 Google Drive 同步目錄），具備智慧同步、可設定的檔名格式，以及供大語言模型整合使用的 HTTP API。

[English](../README.md) | [繁體中文](./README-zhTW.md) | [简体中文](./README-zhCN.md)

## 功能特色

- **收藏集與項目匯出** - 右鍵點擊收藏集或選取的項目，即可將所有 PDF 附件匯出至指定資料夾。
- **智慧同步** - 透過 manifest 追蹤機制，避免重複匯出、自動更新已變更的檔案、移除孤立檔案。
- **可設定的檔名格式** - 提供 7 種內建格式或自訂模板：

  | 格式                               | 範例                                              |
  | ---------------------------------- | ------------------------------------------------- |
  | 作者 年份 - 標題（預設）           | `Smith 2023 - Machine Learning.pdf`               |
  | BibTeX 引用鍵                      | `smith2023.pdf`                                   |
  | BibTeX 引用鍵 - 標題              | `smith2023 - Machine Learning.pdf`                |
  | Better BibTeX 鍵                   | `smithMachineLearning2023.pdf`                    |
  | Better BibTeX 鍵 - 標題           | `smithMachineLearning2023 - Machine Learning.pdf` |
  | 年份_標題                          | `2023_Machine_Learning.pdf`                       |
  | 自訂模板                           | 使用者自訂佔位符                                  |

- **自訂模板佔位符** - `{author}`、`{year}`、`{title}`、`{citekey}`、`{bbt}`
- **Better BibTeX 整合** - 讀取 BBT citation key；若未安裝 BBT，自動使用 BibTeX key 替代。
- **多語言支援** - 英文、繁體中文、簡體中文。
- **HTTP API（大語言模型整合）** - 在 `localhost:23119` 上提供 REST API，讓 AI 代理（Claude、Codex 等）可程式化地匯入書目及查詢文獻庫。

## 安裝

1. 從 [Releases](https://github.com/email81227/zotero-liturature-survey-plugin/releases) 下載最新的 `.xpi` 檔案。
2. 在 Zotero 中，前往 `工具` > `附加元件`。
3. 點擊齒輪圖示，選擇 `從檔案安裝附加元件...`。
4. 選取下載的 `.xpi` 檔案。

## 使用方式

### 從收藏集匯出

1. 在左側面板右鍵點擊收藏集。
2. 選擇 **匯出收藏集 PDF 到資料夾...**
3. 選擇目的資料夾。

### 匯出選取的項目

1. 在中間面板選取一或多個項目。
2. 右鍵選擇 **匯出選取的 PDF 到資料夾...**
3. 選擇目的資料夾。

### 設定檔名格式

1. 前往 `工具` > `附加元件` > **Literature PDF Export** > `偏好設定`。
2. 從下拉選單選擇偏好的檔名格式。
3. 若選擇**自訂模板**，請輸入包含佔位符的模板字串。

### HTTP API（大語言模型整合）

1. 前往 `工具` > `附加元件` > **Literature PDF Export** > `偏好設定`。
2. 啟用 **HTTP API**，並可選擇設定 API 金鑰。
3. 以下端點將在 `http://localhost:23119` 上可用：

| 方法   | 端點                             | 說明                                |
| ------ | -------------------------------- | ----------------------------------- |
| `POST` | `/litpdfexport/addByIdentifier`  | 透過 DOI、ISBN、PMID 或 arXiv ID 匯入書目 |
| `GET`  | `/litpdfexport/search?q=...`     | 搜尋現有文獻庫項目                   |
| `GET`  | `/litpdfexport/collections`      | 列出所有收藏集                       |

**範例 - 以 DOI 匯入：**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"DOI": "10.1038/nature12373"}'
```

**範例 - 批次匯入：**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"identifiers": [{"DOI": "10.1038/nature12373"}, {"ISBN": "978-0-321-12521-7"}]}'
```

若已設定 API 金鑰，請在 request header 中加入 `X-API-Key: <your-key>`。

## 智慧同步機制

此外掛在目標資料夾中維護一個 `.zotero-export-manifest.json` 檔案來追蹤匯出狀態：

- **新檔案**會被複製到資料夾。
- **已變更的檔案**（大小或修改時間不同）會被覆寫。
- **未變更的檔案**會被跳過。
- **孤立檔案**（來源收藏集中已不存在）會被移除。

這使得重複匯出同一收藏集時不會產生重複檔案。

## 開發

### 前置需求

- [Node.js](https://nodejs.org/)（LTS）
- [Git](https://git-scm.com/)
- [Zotero 7 Beta](https://www.zotero.org/support/beta_builds)

### 設定

```bash
git clone https://github.com/email81227/zotero-liturature-survey-plugin.git
cd zotero-liturature-survey-plugin
npm install
cp .env.example .env
# 編輯 .env 設定你的 Zotero 路徑
```

### 建置

```bash
npm run build
```

`.xpi` 檔案將生成在 `.scaffold/build/` 目錄中。

### 開發模式（熱重載）

```bash
npm start
```

## 授權條款

AGPL-3.0-or-later

## 致謝

基於 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 開發。
