# 状态代码同步报告 (v4 → APK v6)
**生成时间**: 2026-07-08 15:26

## 同步状态
- **网站 Railway 线上**: 486974 bytes / md5=`fa9af0f40109b26cd53e5eb77d274a37`
- **APK v6 线上下载**: 3327777 bytes / md5=`fe6671271d27101a55c36d081d7e5274`
- **API 客户端**: 16775 bytes / md5=`1b9f9675549b8a0296af4e64e2b7d499`

## 本轮修复 (v4)
1. **P2P 社区互译**: `p2pTab('pub')` 切换时调用 `translateCommunityContent()`; `setLang` 后强制重渲染 + 二次翻译
2. **`pub_cancel` 翻译键**: 6 语种 → 15 语种 (de/pt/ru/it/ar/hi/th/vi/id)
3. **APP 下载按钮**: 新增 `mo-app-dl` 模态框 + 21 个新键 (`appdltt/appdlfeat1-3/...`)
4. **APP 教程按钮**: 新增 `mo-app-tut` 模态框 + 4 步教程 (`tutstep1t-4d`)
5. **APK 永久下载链接**: GitHub artifacts 404 → Railway 静态服务 `/apk/ai-nexus-v6.apk`
6. **APP v6 重新打包**: index.html 486974B + api-client.js 16775B, APK 3.3MB

## APK 内部内容 (v6)
| 文件 | 大小 | MD5 |
|------|------|-----|
| `assets/public/index.html` | 486974 bytes | `fa9af0f40109b26cd53e5eb77d274a37` |
| `assets/public/api-client.js` | 16775 bytes | `1b9f9675549b8a0296af4e64e2b7d499` |

## 备份清单

### 本地备份 (output/backups/)
- `index_v4_apk_v6_20260708_152645_486974.html` (md5=fa9af0f4)
- `public_v4_20260708_152645_486974.html` (md5=fa9af0f4)
- `app_v6_20260708_152645.apk` (md5=fe667127)
- `api-client_v4_20260708_152645_16775.js` (md5=1b9f9675)

### 远端 GitHub 备份 (commit on main)
- `backups/index_v4_apk_v6_20260708_152645_486974.html`
- `backups/api-client_v4_20260708_152645_16775.js`
- `backups/apk/ai-nexus-v6_20260708_152645.apk`

### 在线访问
- 网站: https://www.zhitongwang.cn/
- APK v6: https://www.zhitongwang.cn/apk/ai-nexus-v6.apk
- APK v5 旧版兼容: https://www.zhitongwang.cn/apk/ai-nexus-v5.apk

### Git 提交记录
- `ad46cdc9434b` index.html (root)
- `8db9af1b1c1b` public/index.html
- `222ba329ca49` public/apk/ai-nexus-v6.apk
