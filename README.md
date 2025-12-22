# 大蒜助手 (Dasuan Helper)

## 简介
基于微信小程序 + 云开发 (CloudBase) 的笔记应用。
支持 Markdown 格式笔记，图片上传，以及简单的审核发布流程。

## 数据库集合设计 (Database Schema)

请在微信开发者工具 -> 云开发 -> 数据库 中创建以下集合：

### 1. `notes` 集合
用于存储用户的笔记。

| 字段 | 类型 | 说明 | 权限 |
| --- | --- | --- | --- |
| `_id` | String | 自动生成 | 读写(仅创建者) |
| `_openid` | String | 自动生成 (用户唯一标识) | 读写(仅创建者) |
| `content` | String | 笔记内容 (Markdown) | 读写(仅创建者) |
| `images` | Array | 图片 fileID 列表 | 读写(仅创建者) |
| `status` | String | 状态: `draft`(草稿), `pending`(待审核), `published`(已发布), `rejected`(驳回) | 读写(仅创建者) |
| `createTime` | Date | 创建时间 | 读写(仅创建者) |
| `updateTime` | Date | 更新时间 | 读写(仅创建者) |

**权限设置**: 
- `notes` 集合权限应设置为 "仅创建者可读写"。

### 2. `admin_audit` (可选/逻辑实现)
简单起见，管理员功能在前端通过硬编码 `openid` 或在云函数中校验。

## 部署说明
1. 在 `project.config.json` 中配置你的 `appid`。
2. 在 `app.js` 中初始化云环境 (无需手动填 env ID，默认即可)。
3. 上传云函数（如有）。

## 功能列表
- [x] 笔记列表 (只能看自己的)
- [x] 新建/编辑笔记 (支持 Markdown 语法)
- [x] 图片上传
- [x] 发布审核 (模拟)
