# 点点计数

一个免费的安卓小工具 App，用来记录念经 / 持咒的遍数，边读边点、顺手计数。纯前端网页（HTML/CSS/原生 JS）用 Capacitor 打包成 APK，不含任何联网上传、不含广告、不含内购，所有数据只存在你手机本地。

> 内容来源说明见文末「关于与免责声明」。

## 功能

- **计数**：主页底部一个大圆「+1」按钮，落在拇指好按的位置；也可全屏计数，点屏幕任意处 +1，带震动与提示音。
- **计时**：内置念诵计时器，满 1 小时后显示「时:分:秒」；归零需二次确认，避免误点。
- **经文**：内置 15 部常用经文 / 咒语（简体课诵本），每个字上方可显示拼音注音（可开关），支持佛门通行读音（如「南无 nā mó」「般若 bō rě」）。
- **书架**：可收藏常用经文、一键切换主页显示哪一部；支持「导入我的经文」——粘贴文字或选 txt 文件存进书架。
- **多计数器**：可为不同经文各建计数器，记录每天遍数，详情页有最近 14 天柱状图。
- **设置**：调节文字大小、开关按键音、查看教程、检查更新。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript（无框架），位于 `www/`。
- 打包：[Capacitor](https://capacitorjs.com/) 7 封装为安卓应用。
- 拼音注音：由 `sutra_src/gen_pinyin.py`（基于 `pypinyin`）离线生成 `www/sutra_pinyin.js`，渲染用 `<ruby><rt>`。
- 图标 / 启动页：本地用 Pillow 生成的扁平琥珀风念珠图标。

## 目录结构

```
counter-app/
├── www/                 # 网页本体（App 真正运行的内容）
│   ├── index.html
│   ├── app.js           # 逻辑
│   ├── sutras.js        # 内置经文数据
│   └── sutra_pinyin.js  # 拼音注音（脚本生成）
├── android/             # Capacitor 生成的安卓工程
├── assets/              # 图标 / 启动页母图
└── capacitor.config.json
```

## 本地构建（安卓）

前置：Node.js、JDK 17+、Android SDK。

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

## 版本与更新

`www/app.js` 里的 `APP_VERSION` 需与 `android/app/build.gradle` 的 `versionName` 一致，`versionCode` 每次发版递增。同签名覆盖安装会保留本地数据。

## 关于与免责声明

- 本应用**永久免费**，仅供学习、交流、参考。
- App 内经文 / 咒语内容整理自网络公开资料，已尽量交叉核对，但**不排除存在错漏**；争议较大的版本未收录。若有讹误，欢迎指正。
- 咒语为梵文音译，各道场、各师承念法本就有出入，App 标注的是最通行的汉字读音，**请以你所属道场、依止师父的传授为准**。
- 计数与导入的记录仅保存在本机，不上传任何服务器。
- 纠错 / 联系：邮箱 banlu6@qq.com ｜ 博客 https://banlublog.pages.dev/

## 许可

代码可自由使用与学习；经文内容版权归原出处。
