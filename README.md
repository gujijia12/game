# 电子斗蛐蛐 - 自走棋

一款纯前端实现的自走棋网页游戏，支持本地游玩，也支持通过内置接口接收玩家建议。

## 玩法

- 🛒 从商店购买棋子，放置到棋盘上
- ⭐ 3个相同棋子自动合成为更高星级
- 🔗 凑齐同种族/职业的棋子激活羁绊加成
- ⚔️ 点击"开战"，棋子自动寻敌战斗
- 🏆 挑战30回合，生存到最后！

## 操作

### 鼠标（桌面端）
- 左键点击选中棋子，再点击目标位置放置/交换
- 右键点击棋子快速出售

### 触屏（手机端）
- 点击选中棋子，再点击目标位置放置
- 点击"出售"按钮出售选中的棋子

### 快捷键
- `D` 刷新商店
- `F` 买经验
- `E` 出售选中棋子
- `空格/回车` 开战
- `ESC` 取消选中

## 部署

纯静态文件，支持任意静态托管平台：

- **GitHub Pages**: 推送到仓库，在 Settings → Pages 中开启
- **Vercel**: 连接仓库，自动部署
- **Netlify**: 拖拽文件夹即可

## 玩家建议收集（真实在线接收）

项目已内置建议反馈弹窗，点击页面顶部 `💬 建议` 可提交。  
如使用 `server.ps1` 启动服务，建议会写入服务器本地文件 `data/feedback.json`。

### 接口

- `POST /api/feedback` 提交建议
- `GET /api/feedback?limit=100` 查看最近建议

### 启动方式

```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```

> 说明：如果你部署到纯静态平台（如 GitHub Pages），`/api/feedback` 不存在，建议会退回本机保存。  
> 要跨设备统一接收建议，请将本项目部署到支持后端接口的环境（如 Windows 服务器运行 `server.ps1`、Node 服务、云函数等）。

## 赚钱模式（广告变现）

项目已内置广告位与合规页面，按下面步骤即可启用：

1. 上线站点（推荐 GitHub Pages）：确保线上地址可访问
2. 申请 Google AdSense 并通过审核
3. 编辑 `js/ads.js` 中的 `AD_CONFIG`
   - `enabled: true`
   - `adClient: 'ca-pub-你的ID'`
   - 可选填写 `slots.start/result/gameover`
4. 提交并推送代码，刷新线上页面

### 合规页面

- `privacy.html` 隐私政策
- `about.html` 关于页面

主页面右下角已提供入口，便于广告审核检查。

## 技术栈

纯 HTML / CSS / JavaScript，无任何框架依赖。
