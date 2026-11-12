# Shadowrocket（小火箭）CCMTV 考勤助手使用与测试指南

本模块与 Loon 插件共享同一核心脚本 [`ccmtv_attendance.js`](../../scripts/ccmtv/ccmtv_attendance.js)，已针对 iOS JavaScriptCore（无 `URLSearchParams` 环境）及 Shadowrocket `key=value` 参数格式完成全兼容加固。

---

## 一、 模块订阅链接

打开 **Shadowrocket** -> 底部 **「配置」** -> **「模块」** -> 右上角 **`+`** -> 粘贴以下链接安装：

```text
https://raw.githubusercontent.com/LMuniverse/ApexApple_AE1/refs/heads/main/module/shadowrocket/ccmtv.module
```

*(国内加速镜像：`https://gh-proxy.com/https://raw.githubusercontent.com/LMuniverse/ApexApple_AE1/refs/heads/main/module/shadowrocket/ccmtv.module`)*

> 注意：请仅安装 `ccmtv.module`（历史早期 `ccmtv.sgmodule` 已废弃移除）。

---

## 二、 必须开启的客户端设置

1. **开启 HTTPS 解密（MitM）**：
   - 进入 **设置 -> HTTPS 解密**，开启 **HTTPS 解密** 开关。
   - 生成并安装 CA 证书，随后前往 **iOS 系统设置 -> 通用 -> 关于本机 -> 证书信任设置**，开启对该 CA 证书的完全信任。
   - 模块已声明 `hostname = %APPEND% yun.ccmtv.cn`，启用模块后即可自动接管 `yun.ccmtv.cn`。
2. **开启后台保活（按需连接 / On Demand）**：
   - 进入 Shadowrocket **设置 -> 按需连接（On Demand）** 并开启，确保锁屏或后台被释放时可由 NetworkExtension 自动拉起。
   - 保持 **蜂窝移动网络** 常开，且睡前 **不要开启 iOS 低电量模式**。
3. **开启系统通知权限**：
   - 在 **iOS 系统设置 -> 通知 -> Shadowrocket** 中允许通知，确保打卡结果、晨报/晚报看板及压哨预警正常弹窗。

---

## 三、 小火箭实测验收清单（测试期间使用）

1. **安装与更新**：导入 `ccmtv.module` 并启用，确认模块脚本列表可见 2 条 HTTP 脚本 + 6 条 Cron 定时任务。
2. **第一阶段前端注入与凭证捕获验证**：
   - 保持 Shadowrocket 开启，打开 CCMTV App 进入「考勤签到」页。
   - 确认页面定位地址稳定显示为 `广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)`，无定位失败弹窗或跳变。
   - 查看 Shadowrocket 脚本日志，确认 `CCMTV_COOKIE` 与 `CCMTV_PASSPORT` 已捕获写入。
3. **手动拦截与参数落盘验证（可选，在有效考勤窗口操作）**：
   - 点击一次签到后，确认收到 `CCMTV 考勤拦截已生效` 通知，且副标题班次名已清洗括号备注（如 `班次: 下午上班`）。
4. **第二阶段 Cron 与通知显示验证**：
   - 在 Shadowrocket 的脚本调试/Cron 列表中手动执行一次 `ccmtv-cron-*`（或在下一常规窗口观察）。
   - 确认能正常输出核验或打卡通知、无 `ReferenceError` / `URLSearchParams` 报错，且通知副标题时间与 `(随机延时 xxs)` 完整显示。
