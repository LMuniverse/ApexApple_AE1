# CCMTV 考勤助手 (第一阶段：双保险位置固化与凭据捕获)

专为 **Loon**（并兼容 Shadowrocket / Surge）设计的 CCMTV 考勤签到位置锁定与凭据顺风车捕获插件。

---

## 🚀 一键安装与订阅

在 Loon 中，进入 **配置 -> 插件**，点击右上角 `+`，选择 **从链接安装**，粘贴以下插件链接：

```text
https://raw.githubusercontent.com/LMuniverse/ApexApple_AE1/refs/heads/main/module/loon/ccmtv/CCMTV_Attendance.plugin
```

> **脚本源地址**：`https://raw.githubusercontent.com/LMuniverse/ApexApple_AE1/refs/heads/main/scripts/ccmtv/ccmtv_attendance.js`

---

## 🛠️ 参数化配置项（可在 Loon 插件界面可视化调整）

| 参数名称 | 默认值 | 作用与说明 |
| :--- | :--- | :--- |
| **经度 (GCJ-02)** (`LNG`) | `113.25680` | 高德坐标系经度，已与南部战区总医院越秀院区东门精确匹配 |
| **纬度 (GCJ-02)** (`LAT`) | `23.14200` | 高德坐标系纬度，已与南部战区总医院越秀院区东门精确匹配 |
| **签到地址** (`ADDRESS`) | `广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)` | 高德逆地理编码反查与历史成功考勤记录逐字一致的标准地址 |
| **自动捕获凭据** (`CaptureCookie`) | `true` | 是否自动将有效会话 Cookie 与设备参数存入 Loon 存储，为第二阶段定时自动打卡做准备 |
| **系统通知** (`EnableNotify`) | `true` | 触发打卡拦截或凭据捕获成功时是否弹出 iOS 系统横幅提示 |

---

## 🔍 “双保险”运作原理

1. **第一层保险：前端页面 DOM/JS 运行时注入 (`http-response`)**
   - 拦截 `GET .../Sign_in_clock_home/user_index` 考勤主页；
   - 在 HTML 末尾注入轻量补丁，强制锁定 `$('.add')` 坐标为医院常量，并劫持 `window.getCurrentPositions` 定位入口；
   - **成效**：彻底粉碎前端源码第 1002 行“经纬度为空直接弹窗‘定位地点获取失败’并不发请求”的本地拦截门禁，手机界面直观亮出医院标准地址，打卡按钮就绪。

2. **第二层保险：考勤提交接口兜底重写 (`http-request`)**
   - 拦截 `POST .../userMySignPost` 等打卡提交请求；
   - 在请求发出前，强制将表单 Body 中的 `lng`、`lat`、`address` 正则/键值改写为目标常量；
   - 发送系统横幅通知提示拦截成功。

3. **顺风车机制：自动捕获凭据（为第二阶段无缝升级铺路）**
   - 提取请求头中的有效会话 Cookie 及设备参数，写入 `$persistentStore`（`CCMTV_COOKIE`、`CCMTV_AUTH_BUNDLE`、`CCMTV_LAST_SIGN_PARAMS`）；
   - 后续第二阶段只需在插件中追加一段 `cron` 定时任务，即可直接读取该凭据实现无人值守全自动打卡。

---

## 📋 使用前必备检查

1. **开启 Loon 的 MitM**：在 Loon 首页开启 MitM 开关；
2. **信任 CA 证书**：系统“设置” -> “通用” -> “关于本机” -> “证书信任设置” -> 开启 Loon CA 完全信任；
3. **打开 CCMTV App 验证**：
   - 进入“我的考勤”，界面应直接显示南部战区总医院；
   - 在考勤时间段内点击签到，手机弹出通知，提示打卡拦截成功。
