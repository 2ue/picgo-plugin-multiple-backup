# PicGo 多图床备份插件

一个强大的 PicGo 插件，支持在主图床上传成功后自动备份到多个其他图床，确保图片的高可用性和数据安全。

[![npm version](https://badge.fury.io/js/picgo-plugin-multiple-backup.svg)](https://badge.fury.io/js/picgo-plugin-multiple-backup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 功能特性

- ✅ **后台自动运行** - 无需手动操作，上传图片后自动触发备份
- ✅ **多图床支持** - 支持所有 PicGo 兼容的图床服务
- ✅ **路径一致性** - 确保所有图床的文件路径完全一致，便于切换
- ✅ **并发上传** - 同时向多个备份图床上传，提高效率  
- ✅ **智能配置** - 自动检测已配置的图床，排除当前默认图床
- ✅ **详细日志** - 完整的上传过程记录，便于问题排查
- ✅ **错误容错** - 单个备份失败不影响其他备份和主图床

## 📦 安装方法

### 方法一：PicGo 应用内安装
1. 打开 PicGo 应用
2. 进入 `插件设置`
3. 搜索 `multiple-backup` 
4. 点击 `安装`

### 方法二：手动安装
```bash
npm install picgo-plugin-multiple-backup
```

### 方法三：本地安装
1. 下载本仓库代码
2. 在 PicGo 插件目录导入本地插件

## ⚙️ 配置说明

### 1. 配置图床
首先需要在 PicGo 的 `图床设置` 中配置好要用作备份的图床：
- 腾讯云 COS
- 七牛云
- 阿里云 OSS  
- 又拍云
- GitHub
- Gitee 码云
- SM.MS
- 等等...

### 2. 配置插件
1. 进入 PicGo 的 `插件设置`
2. 找到 `multiple-backup` 插件配置
3. 选择要作为备份的图床（可多选）
4. 启用详细日志（推荐）

### 3. 配置界面说明
- **图床信息**：显示当前默认图床（不可修改）
- **选择备份图床**：可多选，选择要备份到的图床
- **启用详细日志**：建议开启，用于调试和监控备份状态

## 🎯 使用方法

配置完成后，插件会自动工作：

1. **正常上传图片** - 使用 PicGo 正常上传图片到默认图床
2. **自动触发备份** - 主图床上传成功后，插件自动备份到选定的图床
3. **查看日志** - 在 PicGo 日志中查看详细的备份过程

### 典型工作流程
```
用户上传图片 → GitHub(主图床)上传成功 
              ↓
              插件自动触发
              ↓
          并发备份到腾讯云COS + 七牛云
              ↓
          所有图床都有相同路径的图片文件
```

## 📝 日志示例

启用详细日志后，可在 PicGo 日志中看到类似内容：

```
[Multiple Backup] 主图床 github 上传成功，开始备份到 2 个图床
[Multiple Backup] ✅ tcyun 备份成功
[Multiple Backup] tcyun 结果 1: https://cos.example.com/path/image.png
[Multiple Backup] ✅ qiniu 备份成功  
[Multiple Backup] qiniu 结果 1: https://qiniu.example.com/path/image.png
[Multiple Backup] 备份完成: 2/2 个成功
```

## 🔧 技术实现

### 插件架构
- **beforeUploadPlugins** - 缓存图片数据
- **afterUploadPlugins** - 执行备份上传
- **并发处理** - 使用 Promise.allSettled 并行备份
- **错误隔离** - 单个备份失败不影响其他操作

### 兼容性
- ✅ PicGo 2.x 全系列
- ✅ 所有主流图床服务
- ✅ Windows / macOS / Linux

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交修改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📋 版本历史

### v1.0.0 (2025-08-12)
- 🎉 首次发布
- ✅ 支持多图床自动备份
- ✅ 完整的错误处理和日志记录
- ✅ 友好的配置界面

## ❓ 常见问题

### Q: 备份失败怎么办？
A: 检查 PicGo 日志，确认备份图床的配置是否正确，网络是否正常。

### Q: 会影响主图床上传吗？
A: 不会。备份是在主图床上传成功后进行的，即使备份全部失败，主图床的上传结果也不会受影响。

### Q: 支持哪些图床？
A: 支持所有 PicGo 兼容的图床服务，包括但不限于腾讯云COS、七牛云、阿里云OSS、GitHub等。

### Q: 如何确保路径一致？
A: 插件使用与主图床完全相同的文件名和路径结构进行备份上传。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [PicGo 官网](https://molunerfinn.com/PicGo/)
- [PicGo 插件开发文档](https://picgo.github.io/PicGo-Core-Doc/zh/dev-guide/cli.html#%E6%8F%92%E4%BB%B6%E7%B3%BB%E7%BB%9F)
- [问题反馈](https://github.com/2ue/picgo-plugin-multiple-backup/issues)

---

如果这个插件对你有帮助，欢迎 ⭐ Star 本仓库！