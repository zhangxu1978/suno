# Suno 歌曲管理系统

这是一个用于管理 Suno AI 音乐创作平台生成的歌曲的完整系统。系统支持歌曲记录、状态跟踪、背景图上传和前端界面管理。

## 功能特性

- ✅ **自动歌曲记录**: 在 Suno 创建歌曲后自动生成 JSON 记录
- ✅ **状态跟踪**: 跟踪歌曲的下载、背景图、歌词、特效、发布状态
- ✅ **背景图上传**: 支持为每首歌曲上传自定义背景图片
- ✅ **前端界面**: 现代化的 Web 界面，支持搜索和状态管理
- ✅ **文件管理**: 自动管理音频文件、背景图片和歌词文件

## 系统架构

```
suno/
├── song-manager.js      # 歌曲数据管理模块
├── server.js            # Web 服务器
├── suno-create.js       # 修改后的歌曲创建脚本
├── suno-download.js     # 歌曲下载脚本
├── public/              # 前端静态文件
│   ├── index.html       # 主页面
│   ├── style.css        # 样式文件
│   └── script.js        # 前端逻辑
├── songs.json           # 歌曲数据库（自动生成）
├── download/            # 音频文件目录（自动生成）
├── backgrounds/         # 背景图片目录（自动生成）
└── lyric/               # 歌词文件目录（自动生成）
```

## 快速开始

### 1. 启动服务器

运行以下命令启动歌曲管理系统服务器：

```bash
node server.js
```

或者双击运行 `start-server.bat` 文件

服务器启动后，访问 http://localhost:3000 查看前端界面

### 2. 创建歌曲

使用修改后的 `suno-create.js` 创建歌曲：

```bash
node suno-create.js "歌曲主题" "音乐风格"
```

示例：
```bash
node suno-create.js "山水" "中国风"
```

歌曲创建完成后会自动添加到歌曲数据库

### 3. 下载歌曲

使用 `suno-download.js` 下载已创建的歌曲：

```bash
node suno-download.js "歌曲名称"
```

### 4. 管理歌曲

通过 Web 界面管理歌曲：
- 查看所有歌曲列表
- 上传背景图片
- 查看歌词
- 更新歌曲状态
- 搜索和筛选歌曲

## API 接口

### 获取所有歌曲
```
GET /api/songs
```

### 获取单个歌曲
```
GET /api/songs/:id
```

### 更新歌曲状态
```
PUT /api/songs/:id
```

### 上传背景图片
```
POST /api/songs/:id/background
```

### 搜索歌曲
```
GET /api/search?q=关键词
```

### 删除歌曲
```
DELETE /api/songs/:id
```

## 歌曲数据结构

```json
{
  "id": "唯一标识",
  "title": "歌曲标题",
  "style": "音乐风格",
  "lyric": "歌词内容",
  "createdTime": "创建时间",
  "status": {
    "downloaded": false,
    "hasBackground": false,
    "hasLyric": true,
    "hasEffects": false,
    "published": false
  },
  "files": {
    "audio": "音频文件路径",
    "background": "背景图片路径",
    "lyric": "歌词文件路径"
  },
  "metadata": {
    "duration": 0,
    "size": 0,
    "format": ""
  }
}
```

## 使用说明

### 歌曲创建流程
1. 运行 `suno-create.js` 创建歌曲
2. 歌曲信息自动保存到 `songs.json`
3. 歌词保存到 `lyric/` 目录
4. 在 Suno 平台等待歌曲生成完成

### 歌曲下载流程
1. 运行 `suno-download.js` 下载歌曲
2. 音频文件保存到 `download/` 目录
3. 系统自动检测并更新歌曲的下载状态

### 背景图上传
1. 在前端界面点击"上传背景"按钮
2. 选择或拖拽图片文件
3. 图片保存到 `backgrounds/` 目录
4. 歌曲状态自动更新

## 注意事项

- 确保 Chrome 浏览器已安装并可通过端口 48840 访问
- 首次使用前请确保相关目录权限正常
- 建议定期备份 `songs.json` 文件
- 系统会自动创建必要的目录结构

## 故障排除

### 服务器无法启动
- 检查 Node.js 是否已安装
- 检查端口 3000 是否被占用
- 查看控制台错误信息

### 歌曲无法添加
- 检查 `suno-create.js` 执行是否成功
- 确认 Suno 平台登录状态
- 查看浏览器控制台错误

### 文件上传失败
- 检查图片文件大小（限制 5MB）
- 确认文件格式支持（JPG/PNG/GIF）
- 检查服务器磁盘空间

## 更新日志

### v1.0.0
- 初始版本发布
- 支持歌曲记录和状态跟踪
- 实现背景图上传功能
- 提供完整的前端管理界面