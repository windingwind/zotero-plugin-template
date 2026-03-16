# Literature PDF Export for Zotero

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

一个 Zotero 7 插件，可将收藏集或选中项目中的 PDF 附件导出到本地文件夹（如 Google Drive 同步目录），具备智能同步、可配置的文件名格式，以及供大语言模型集成使用的 HTTP API。

[English](../README.md) | [繁體中文](./README-zhTW.md) | [简体中文](./README-zhCN.md)

## 功能特性

- **收藏集与项目导出** - 右键点击收藏集或选中的项目，即可将所有 PDF 附件导出至指定文件夹。
- **智能同步** - 通过 manifest 追踪机制，避免重复导出、自动更新已变更的文件、移除孤立文件。
- **可配置的文件名格式** - 提供 7 种内置格式或自定义模板：

  | 格式                               | 示例                                              |
  | ---------------------------------- | ------------------------------------------------- |
  | 作者 年份 - 标题（默认）           | `Smith 2023 - Machine Learning.pdf`               |
  | BibTeX 引用键                      | `smith2023.pdf`                                   |
  | BibTeX 引用键 - 标题              | `smith2023 - Machine Learning.pdf`                |
  | Better BibTeX 键                   | `smithMachineLearning2023.pdf`                    |
  | Better BibTeX 键 - 标题           | `smithMachineLearning2023 - Machine Learning.pdf` |
  | 年份_标题                          | `2023_Machine_Learning.pdf`                       |
  | 自定义模板                         | 用户自定义占位符                                  |

- **自定义模板占位符** - `{author}`、`{year}`、`{title}`、`{citekey}`、`{bbt}`
- **Better BibTeX 集成** - 读取 BBT citation key；若未安装 BBT，自动使用 BibTeX key 替代。
- **多语言支持** - 英文、繁体中文、简体中文。
- **HTTP API（大语言模型集成）** - 在 `localhost:23119` 上提供 REST API，让 AI 代理（Claude、Codex 等）可编程地导入书目及查询文献库。

## 安装

1. 从 [Releases](https://github.com/email81227/zotero-liturature-survey-plugin/releases) 下载最新的 `.xpi` 文件。
2. 在 Zotero 中，前往 `工具` > `附加组件`。
3. 点击齿轮图标，选择 `从文件安装附加组件...`。
4. 选择下载的 `.xpi` 文件。

## 使用方式

### 从收藏集导出

1. 在左侧面板右键点击收藏集。
2. 选择 **导出收藏集 PDF 到文件夹...**
3. 选择目标文件夹。

### 导出选中的项目

1. 在中间面板选中一个或多个项目。
2. 右键选择 **导出选中的 PDF 到文件夹...**
3. 选择目标文件夹。

### 设置文件名格式

1. 前往 `工具` > `附加组件` > **Literature PDF Export** > `首选项`。
2. 从下拉菜单选择偏好的文件名格式。
3. 若选择**自定义模板**，请输入包含占位符的模板字符串。

### HTTP API（大语言模型集成）

1. 前往 `工具` > `附加组件` > **Literature PDF Export** > `首选项`。
2. 启用 **HTTP API**，并可选择设置 API 密钥。
3. 以下端点将在 `http://localhost:23119` 上可用：

| 方法   | 端点                             | 说明                                |
| ------ | -------------------------------- | ----------------------------------- |
| `POST` | `/litpdfexport/addByIdentifier`  | 通过 DOI、ISBN、PMID 或 arXiv ID 导入书目 |
| `GET`  | `/litpdfexport/search?q=...`     | 搜索现有文献库项目                   |
| `GET`  | `/litpdfexport/collections`      | 列出所有收藏集                       |

**示例 - 以 DOI 导入：**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"DOI": "10.1038/nature12373"}'
```

**示例 - 批量导入：**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"identifiers": [{"DOI": "10.1038/nature12373"}, {"ISBN": "978-0-321-12521-7"}]}'
```

若已设置 API 密钥，请在 request header 中加入 `X-API-Key: <your-key>`。

## 智能同步机制

此插件在目标文件夹中维护一个 `.zotero-export-manifest.json` 文件来追踪导出状态：

- **新文件**会被复制到文件夹。
- **已变更的文件**（大小或修改时间不同）会被覆写。
- **未变更的文件**会被跳过。
- **孤立文件**（源收藏集中已不存在）会被移除。

这使得重复导出同一收藏集时不会产生重复文件。

## 开发

### 前置要求

- [Node.js](https://nodejs.org/)（LTS）
- [Git](https://git-scm.com/)
- [Zotero 7 Beta](https://www.zotero.org/support/beta_builds)

### 设置

```bash
git clone https://github.com/email81227/zotero-liturature-survey-plugin.git
cd zotero-liturature-survey-plugin
npm install
cp .env.example .env
# 编辑 .env 设置你的 Zotero 路径
```

### 构建

```bash
npm run build
```

`.xpi` 文件将生成在 `.scaffold/build/` 目录中。

### 开发模式（热重载）

```bash
npm start
```

## 许可证

AGPL-3.0-or-later

## 致谢

基于 [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) 开发。
