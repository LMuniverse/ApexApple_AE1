/**
 * CCMTV 考勤助手 - 第一/二阶段融合版：全自动Cron签到 + 双保险位置固化 + 凭据自愈
 * 适用平台：Loon / Surge / Shadowrocket
 * 仓库：https://github.com/LMuniverse/ApexApple_AE1
 */

class EnvHelper {
    constructor(name) {
        this.name = name;
        this.isLoon = typeof $loon !== 'undefined';
        this.isSurge = typeof $httpClient !== 'undefined' && !this.isLoon;
        this.isShadowrocket = typeof $rocket !== 'undefined';
    }

    read(key) {
        if (typeof $persistentStore !== 'undefined') {
            return $persistentStore.read(key);
        }
        return null;
    }

    write(val, key) {
        if (typeof $persistentStore !== 'undefined') {
            return $persistentStore.write(val, key);
        }
        return false;
    }

    notify(title, subtitle = '', message = '') {
        if (typeof $notification !== 'undefined') {
            $notification.post(title, subtitle, message);
        } else if (typeof $notify !== 'undefined') {
            $notify(title, subtitle, message);
        }
        console.log(`[${this.name}] 通知: ${title} | ${subtitle} | ${message}`);
    }

    parseArgument() {
        if (typeof $argument === 'undefined' || !$argument) return {};
        if (typeof $argument === 'object') {
            if (Array.isArray($argument)) {
                return {
                    LNG: $argument[0] || '113.25680',
                    LAT: $argument[1] || '23.14200',
                    ADDRESS: $argument[2] || '广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)',
                    CaptureCookie: $argument[3] !== false && $argument[3] !== 'false',
                    EnableNotify: $argument[4] !== false && $argument[4] !== 'false',
                    RandomDelay: $argument[5] !== undefined ? Number($argument[5]) : 300
                };
            }
            return $argument;
        }
        if (typeof $argument === 'string') {
            try {
                if ($argument.startsWith('[') || $argument.startsWith('{')) {
                    const parsed = JSON.parse($argument);
                    if (Array.isArray(parsed)) {
                        return {
                            LNG: parsed[0] || '113.25680',
                            LAT: parsed[1] || '23.14200',
                            ADDRESS: parsed[2] || '广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)',
                            CaptureCookie: parsed[3] !== false && parsed[3] !== 'false',
                            EnableNotify: parsed[4] !== false && parsed[4] !== 'false',
                            RandomDelay: parsed[5] !== undefined ? Number(parsed[5]) : 300
                        };
                    }
                    return parsed;
                }
                const safeDecodeArg = (s) => {
                    try { return decodeURIComponent(s); } catch (e) { return s; }
                };
                return Object.fromEntries(
                    $argument.split('&').map(pair => {
                        const idx = pair.indexOf('=');
                        return idx === -1
                            ? [safeDecodeArg(pair.trim()), '']
                            : [safeDecodeArg(pair.slice(0, idx).trim()), safeDecodeArg(pair.slice(idx + 1))];
                    })
                );
            } catch (e) {
                console.log(`[${this.name}] 解析 $argument 出错: ${e.message}`);
                return {};
            }
        }
        return {};
    }

    get(options) {
        return new Promise((resolve, reject) => {
            if (typeof $httpClient !== 'undefined') {
                $httpClient.get(options, (err, res, body) => {
                    if (err) return reject(err);
                    resolve({ status: res.status || res.statusCode, headers: res.headers, body });
                });
            } else {
                reject(new Error("不支持的网络环境"));
            }
        });
    }

    post(options) {
        return new Promise((resolve, reject) => {
            if (typeof $httpClient !== 'undefined') {
                $httpClient.post(options, (err, res, body) => {
                    if (err) return reject(err);
                    resolve({ status: res.status || res.statusCode, headers: res.headers, body });
                });
            } else {
                reject(new Error("不支持的网络环境"));
            }
        });
    }

    done(data) {
        if (typeof $done !== 'undefined') {
            $done(data || {});
        }
    }
}

const env = new EnvHelper('CCMTV-Attendance');

// 解析配置参数与默认目标常量
const args = env.parseArgument();
const TARGET_LNG = args.LNG || '113.25680';
const TARGET_LAT = args.LAT || '23.14200';
const TARGET_ADDRESS = args.ADDRESS || '广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)';
const CAPTURE_COOKIE = args.CaptureCookie !== 'false' && args.CaptureCookie !== false;
const ENABLE_NOTIFY = args.EnableNotify !== 'false' && args.EnableNotify !== false;
const RANDOM_DELAY_MAX = Number(args.RandomDelay !== undefined && args.RandomDelay !== '' ? args.RandomDelay : 300);
const SKIP_DATES = new Set(parseDateList(args.SkipDates || env.read('CCMTV_SKIP_DATES') || ''));
const POLICY_AUDIT_NOTIFY = args.PolicyAuditNotify === 'true' || args.PolicyAuditNotify === true;
const SERVER_NON_WORKDAY_STATUSES = new Set(['周末', '节假日', '放假', '休息', '请假']);
const SERVER_WORKDAY_STATUSES = new Set(['正常', '旷工', '迟到', '早退']);

function parseDateList(value) {
    return String(value || '')
        .split(/[;,\s]+/)
        .map(item => item.trim())
        .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));
}

function notifyPolicySkip(dateStr, reason) {
    console.log(`[CCMTV-Cron] 政策跳过 ${dateStr}: ${reason}`);
    if (POLICY_AUDIT_NOTIFY && ENABLE_NOTIFY) {
        env.notify('CCMTV 政策核验', `${dateStr} 不执行打卡`, reason);
    }
}

// 默认通用设备指纹模板（首次拦截手动提交后会自动持久化真实设备指纹覆盖）
const DEFAULT_DEVICE = {
    model: 'iPhone15,3',
    source: 'iOS',
    systemversion: '16.2',
    deviceid: '',
    version: 'V5.8.2'
};

const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;linlicccmtvapp';

// 获取或生成稳定的本地随机设备 UUID（避免仓库中硬编码个人设备指纹）
function getOrCreateLocalDeviceId() {
    let savedId = env.read('CCMTV_DEVICE_ID');
    if (savedId) return savedId;
    const hex = '0123456789ABCDEF';
    const seg = (len) => Array.from({ length: len }, () => hex[Math.floor(Math.random() * 16)]).join('');
    savedId = `${seg(8)}-${seg(4)}-4${seg(3)}-8${seg(3)}-${seg(12)}`;
    env.write(savedId, 'CCMTV_DEVICE_ID');
    return savedId;
}

// 跨环境纯 JavaScript 鲁棒 Base64 解码器
function base64Decode(str) {
    if (!str) return '';
    if (typeof atob === 'function') {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            try { return atob(str); } catch (e2) {}
        }
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

// 跨环境纯 JavaScript Base64 编码器 (兼容无 btoa 的运行时)
function base64Encode(str) {
    if (str === undefined || str === null) return '';
    const raw = String(str);
    if (typeof btoa === 'function') {
        try {
            return btoa(unescape(encodeURIComponent(raw)));
        } catch (e) {
            try { return btoa(raw); } catch (e2) {}
        }
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let utf8 = unescape(encodeURIComponent(raw));
    let output = '';
    for (let idx = 0; idx < utf8.length; ) {
        const c1 = utf8.charCodeAt(idx++);
        const c2 = utf8.charCodeAt(idx++);
        const c3 = utf8.charCodeAt(idx++);
        const e1 = c1 >> 2;
        const e2 = ((c1 & 3) << 4) | (c2 >> 4);
        let e3 = ((c2 & 15) << 2) | (c3 >> 6);
        let e4 = c3 & 63;
        if (isNaN(c2)) {
            e3 = 64;
            e4 = 64;
        } else if (isNaN(c3)) {
            e4 = 64;
        }
        output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
    }
    return output;
}

// 从已捕获的 passport Cookie 中提取用户 UID（passport=<uid>\t<account>...）
function extractUidFromPassport(passportStr) {
    if (!passportStr) return '';
    const rawVal = String(passportStr).replace(/^passport=/i, '').trim();
    let decoded = rawVal;
    try { decoded = decodeURIComponent(rawVal); } catch (e) {}
    const parts = decoded.split(/[\t\r\n]/);
    const uid = (parts[0] || '').trim();
    return /^\d+$/.test(uid) ? uid : '';
}

// 从 HTTP 响应头安全提取 ci_session
function extractCiSession(headers) {
    if (!headers) return '';
    const cookieHeader = headers['set-cookie'] || headers['Set-Cookie'] || headers['SET-COOKIE'] || '';
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    for (const c of cookies) {
        const match = String(c).match(/(ci_session=[^;]+)/);
        if (match) return match[1];
    }
    return '';
}

// 跨环境纯 JavaScript 查询参数构造与解析器 (兼容 Loon / Surge / JSCore 无 URLSearchParams 环境)
function buildQueryString(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.keys(obj)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] === null || obj[k] === undefined ? '' : obj[k]))
        .join('&');
}

function parseQueryString(str) {
    const res = {};
    if (!str || typeof str !== 'string') return res;
    const safeDecode = (s) => {
        try {
            return decodeURIComponent(String(s).replace(/\+/g, ' '));
        } catch (e) {
            return String(s);
        }
    };
    const clean = str.startsWith('?') ? str.slice(1) : str;
    const pairs = clean.split('&');
    for (const pair of pairs) {
        if (!pair) continue;
        const idx = pair.indexOf('=');
        if (idx === -1) {
            res[safeDecode(pair)] = '';
        } else {
            res[safeDecode(pair.slice(0, idx))] = safeDecode(pair.slice(idx + 1));
        }
    }
    return res;
}

// 清洗班次名称括号备注，仅用于通知展示；网络请求负载保留原始 groupName
function formatDisplayGroupName(name) {
    const raw = String(name || '');
    const cleaned = raw.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
    return cleaned || raw || '未知班次';
}

// 核心自主会话自愈引擎：基于本地已捕获的 passport 令牌向网关重铸合法 ci_session
async function refreshSession(passportStr, deviceInfo) {
    console.log('[CCMTV-Cron] 启动自主会话自愈 (Mint Fresh ci_session)...');
    let passportCookie = '';
    if (passportStr && passportStr.includes('passport=')) {
        const m = passportStr.match(/passport=[^;]+/);
        if (m) passportCookie = m[0];
    }
    if (!passportCookie) {
        console.log('[CCMTV-Cron] 自愈中止: 本地尚未捕获 passport 凭据，请先打开一次 App 考勤页');
        return null;
    }

    const uid = extractUidFromPassport(passportCookie);
    if (!uid) {
        console.log('[CCMTV-Cron] 自愈中止: 无法从 passport 中解析出有效 uid');
        return null;
    }

    const dev = deviceInfo || DEFAULT_DEVICE;
    const dataPayload = base64Encode(base64Encode(JSON.stringify({ act: 'getHomeFuncList', uid: uid })));
    const datacheckPayload = base64Encode(base64Encode(JSON.stringify({
        source: dev.source || 'iOS',
        password: '123456',
        sourceflag: 'account_login',
        model: dev.model || 'iPhone15,3',
        version: String(dev.version || 'V5.8.2').replace(/^V/i, ''),
        userAccount: uid,
        systemversion: dev.systemversion || '16.2'
    })));
    const gpApiBody = `data=${encodeURIComponent(dataPayload)}&datacheck=${encodeURIComponent(datacheckPayload)}`;

    try {
        const gpRes = await env.post({
            url: 'https://yun.ccmtv.cn//admin.php/AndroidGpApi/index',
            headers: {
                'User-Agent': 'CCMTV/5.8.2 (iPhone; iOS 16.2; Scale/3.00)',
                'Cookie': passportCookie,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: gpApiBody
        });

        const s1 = base64Decode(gpRes.body.trim());
        const s2 = base64Decode(s1);
        const parsed = JSON.parse(s2);

        let appUrl = null;
        const findUrl = (o) => {
            if (!o || typeof o !== 'object') return null;
            if (o.app_url) return o.app_url;
            for (const k in o) {
                const res = findUrl(o[k]);
                if (res) return res;
            }
            return null;
        };
        appUrl = findUrl(parsed);
        if (!appUrl) {
            console.log('[CCMTV-Cron] 自愈失败: 未从 AndroidGpApi 返回中解析出 app_url');
            return null;
        }

        console.log('[CCMTV-Cron] 获得动态换票 URL，发起首飞换票...');
        const indexRes = await env.get({
            url: appUrl,
            headers: {
                'User-Agent': DEFAULT_UA,
                'Cookie': passportCookie
            }
        });

        const newCiSession = extractCiSession(indexRes.headers);
        if (!newCiSession) {
            console.log('[CCMTV-Cron] 自愈失败: 换票响应头未包含有效 ci_session');
            return null;
        }

        const freshCookie = `${newCiSession}; ${passportCookie}`;
        env.write(freshCookie, 'CCMTV_COOKIE');
        console.log(`[CCMTV-Cron] 🎉 会话自主自愈成功！新 ci_session: ${newCiSession.slice(0, 22)}...`);
        return freshCookie;
    } catch (e) {
        console.log(`[CCMTV-Cron] 会话自愈流程异常: ${e.message}`);
        return null;
    }
}

// ==============================================================
// 模块 1: [Phase 2] Cron 全自动无人值守签到主逻辑
// ==============================================================
// 全天考勤终盘对账看板引擎：拉取全天三大班次真实状态，汇总成权威看板
// ==============================================================
// 全天考勤终盘对账看板引擎：拉取全天三大班次真实状态，汇总成权威看板
// ==============================================================
// 获取昨日考勤总对账数据 (用于早班晨报)
async function getYesterdayAudit(baseHeaders) {
    const pad = n => String(n).padStart(2, '0');
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const monthStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}`;
    const dateStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

    try {
        const res = await env.get({
            url: `https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/getUserSignList/${monthStr}`,
            headers: baseHeaders
        });
        const data = JSON.parse(res.body);
        const item = data.data && data.data.find(d => d.date === dateStr);
        if (item) {
            return `${dateStr}(${item.week}) 全天考勤: ${item.status} ✅`;
        }
    } catch(e) {}
    return "昨日全天考勤记录核验通过 ✅";
}

async function fetchServerDayPolicy(baseHeaders, dateStr) {
    if (SKIP_DATES.has(dateStr)) {
        return { allow: false, reason: '本地例外日期策略跳过' };
    }

    const monthStr = dateStr.slice(0, 7);
    const res = await env.get({
        url: `https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/getUserSignList/${monthStr}`,
        headers: baseHeaders
    });
    const payload = JSON.parse(res.body);
    if (payload.code !== undefined && String(payload.code) !== '0') {
        return { allow: false, reason: `服务端月度状态异常: ${payload.msg || payload.errorMessage || payload.code}` };
    }

    const day = Array.isArray(payload.data) ? payload.data.find(item => item && item.date === dateStr) : null;
    if (!day || !day.status) {
        return { allow: false, reason: '服务端未返回当天考勤日状态' };
    }

    const status = String(day.status).trim();
    if (SERVER_NON_WORKDAY_STATUSES.has(status)) {
        return { allow: false, reason: `服务端标记为${status}` };
    }
    if (!SERVER_WORKDAY_STATUSES.has(status)) {
        return { allow: false, reason: `服务端返回未知考勤日状态: ${status}` };
    }
    return { allow: true, status };
}

async function generateDailyAuditBoard(baseHeaders, dateStr, groupList) {
    const summary = [];
    let allDone = true;
    for (const g of groupList) {
        try {
            const bodyStr = 'date=' + encodeURIComponent(dateStr) +
                            '&group_name=' + encodeURIComponent(g.group_name) +
                            '&config_id=' + encodeURIComponent(g.config_id || '') +
                            '&config_key=' + encodeURIComponent(g.config_key) +
                            '&config_type=' + encodeURIComponent(g.config_type || '');
            const res = await env.post({
                url: 'https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/getMySignTypeInfo',
                headers: baseHeaders,
                body: bodyStr
            });
            const info = JSON.parse(res.body);
            const item = info.data && info.data[0];
            const isDone = item && (item.click === '0' || !!item.user_sign_in_time);
            if (!isDone) allDone = false;
            const timeClean = (item && item.user_sign_in_time) ? item.user_sign_in_time.replace('签到时间：', '').trim() : '未签';
            const shortName = g.group_name.includes('早') ? '早' : (g.group_name.includes('下班') || g.group_name.includes('晚') ? '晚' : '中');
            summary.push(shortName + ': ' + (isDone ? ('✅' + timeClean) : '⏳未签'));
        } catch(e) {
            const shortName = g.group_name.includes('早') ? '早' : (g.group_name.includes('下班') || g.group_name.includes('晚') ? '晚' : '中');
            summary.push(shortName + ': ❓查询异常');
        }
    }
    return {
        allDone: allDone,
        summaryText: summary.join(' | ')
    };
}

async function executeCronAutoCheckin() {
    console.log("[CCMTV-Cron] 唤醒全自动考勤打卡任务...");

    // === 时间与基准变量前置初始化 (防止 TDZ ReferenceError) ===
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        notifyPolicySkip(dateStr, '周末额外排班不属于自动打卡范围');
        return;
    }
    if (SKIP_DATES.has(dateStr)) {
        notifyPolicySkip(dateStr, '配置为不打卡日期');
        return;
    }
    // 判定是否处于关窗前15分钟压哨抢救窗口 (早班 07:40~08:00, 中班 14:10~14:30, 晚班 22:40~23:00)
    const isRescueWindow = (currentTimeVal >= 460 && currentTimeVal <= 485) ||
                           (currentTimeVal >= 850 && currentTimeVal <= 875) ||
                           (currentTimeVal >= 1360 && currentTimeVal <= 1385);


    // 1. 读取持久化凭证与设备指纹（完全由本地运行态捕获，无硬编码个人凭据）
    let savedCookie = env.read('CCMTV_COOKIE') || '';
    let passport = env.read('CCMTV_PASSPORT') || '';
    if (savedCookie && savedCookie.includes('passport=')) {
        const pMatch = savedCookie.match(/passport=[^;]+/);
        if (pMatch) passport = pMatch[0];
    }

    let device = { ...DEFAULT_DEVICE, deviceid: getOrCreateLocalDeviceId() };
    let userAgent = DEFAULT_UA;
    try {
        const lastParams = JSON.parse(env.read('CCMTV_LAST_SIGN_PARAMS') || '{}');
        if (lastParams.device && typeof lastParams.device === 'object') {
            device = { ...device, ...lastParams.device };
            if (!device.deviceid) device.deviceid = getOrCreateLocalDeviceId();
        }
        const authBundle = JSON.parse(env.read('CCMTV_AUTH_BUNDLE') || '{}');
        if (authBundle.user_agent) {
            userAgent = authBundle.user_agent;
        }
    } catch (e) {
        console.log(`[CCMTV-Cron] 读取扩展凭据警告: ${e.message}，使用默认设备指纹`);
    }

    if (!savedCookie && !passport) {
        console.log('[CCMTV-Cron] 本地尚未初始化凭据，等待用户首次打开考勤页自动捕获');
        if (ENABLE_NOTIFY) {
            env.notify('CCMTV 自动打卡待初始化', '尚未捕获账号会话凭据', '请打开一次 CCMTV App 考勤页，插件将自动捕获并持久化凭据');
        }
        return;
    }

    // 0. 早班长夜唤醒与会话时效前置主动巡检 (消除任何303隐患)
    const lastRefreshTime = Number(env.read('CCMTV_LAST_REFRESH_TIME') || 0);
    const nowTime = Date.now();
    const isMorning = currentTimeVal >= 400 && currentTimeVal <= 540;
    const isStale = (nowTime - lastRefreshTime) > 70 * 60 * 1000;

    if (isMorning || isStale || !savedCookie) {
        console.log("[CCMTV-Cron] 触发前置自愈巡检 (isMorning=" + isMorning + ", isStale=" + isStale + ")，主动重铸最新有效会话...");
        const freshCookie = await refreshSession(passport, device);
        if (freshCookie) {
            savedCookie = freshCookie;
            env.write(String(nowTime), 'CCMTV_LAST_REFRESH_TIME');
        } else if (!savedCookie) {
            env.notify('CCMTV 自动打卡未就绪', '未检测到会话凭据且自愈失败', '请在手机 App 内打开一次考勤页完成初始化凭据捕获');
            return;
        }
    }


    const baseHeaders = {
        'User-Agent': userAgent,
        'Cookie': savedCookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/user_index'
    };

    try {
        const dayPolicy = await fetchServerDayPolicy(baseHeaders, dateStr);
        if (!dayPolicy.allow) {
            notifyPolicySkip(dateStr, dayPolicy.reason);
            return;
        }
        console.log(`[CCMTV-Cron] 服务端确认 ${dateStr} 为${dayPolicy.status}考勤日`);
    } catch (err) {
        console.log(`[CCMTV-Cron] 服务端考勤日状态查询失败: ${err.message}，安全退出`);
        return;
    }

    // 2. 第一道防火墙：获取今日排班列表 (集成深度自愈与重试)
    let groupList = [];
    async function fetchTypeList(cookie) {
        const typeListRes = await env.post({
            url: 'https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/typeList',
            headers: { ...baseHeaders, 'Cookie': cookie },
            body: `date=${dateStr}`
        });
        return JSON.parse(typeListRes.body);
    }

    try {
        let typeData = null;
        try {
            typeData = await fetchTypeList(savedCookie);
        } catch (fetchErr) {
            console.log(`[CCMTV-Cron] 初次请求排班异常: ${fetchErr.message}，判定为Cookie过期，触发自愈...`);
        }

        // 检查排班数据有效性，若返回空或状态非1，说明会话已失效，立即触发自愈
        if (!typeData || typeData.status !== '1' || !typeData.data?.group_list) {
            console.log('[CCMTV-Cron] 排班数据异常或会话失效，启动自主自愈刷新...');
            const refreshedCookie = await refreshSession(passport, device);
            if (refreshedCookie) {
                savedCookie = refreshedCookie;
                baseHeaders['Cookie'] = refreshedCookie;
                typeData = await fetchTypeList(refreshedCookie);
            }
        }

        if (!typeData || typeData.status !== '1' || !typeData.data?.group_list || typeData.data.group_list.length === 0) {
            console.log(`[CCMTV-Cron] 今日无排班或接口返回空: ${typeData ? (typeData.errorMessage || '无排班') : '请求失败'}，安全退出`);
            return;
        }
        groupList = typeData.data.group_list;
        console.log(`[CCMTV-Cron] 成功获取今日排班，共 ${groupList.length} 个班次`);
    } catch (err) {
        console.log(`[CCMTV-Cron] 排班获取失败: ${err.message}`);
        env.notify('CCMTV 自动打卡异常', '获取排班失败', '会话凭据可能已失效，请打开一次 App 考勤页自动续期');
        return;
    }

    // 3. 第二道防火墙：逐个询问服务端，由服务端决定当前是否存在可打班次
    async function fetchSignInfo(group) {
        const body = 'date=' + encodeURIComponent(dateStr) +
                     '&group_name=' + encodeURIComponent(group.group_name) +
                     '&config_id=' + encodeURIComponent(group.config_id || '') +
                     '&config_key=' + encodeURIComponent(group.config_key) +
                     '&config_type=' + encodeURIComponent(group.config_type || '');
        const res = await env.post({
            url: 'https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/getMySignTypeInfo',
            headers: baseHeaders,
            body
        });
        return JSON.parse(res.body);
    }

    const eligibleGroups = [];
    for (const group of groupList) {
        try {
            const signInfo = await fetchSignInfo(group);
            if (signInfo.status !== '1' || !Array.isArray(signInfo.data) || signInfo.data.length === 0) {
                continue;
            }
            const item = signInfo.data[0];
            const alreadySigned = String(item.click) === '0' || !!item.user_sign_in_time;
            const windowOpen = String(item.btn_status) === '1';
            const canClick = String(item.click) === '1';
            if (!alreadySigned && windowOpen && canClick) {
                eligibleGroups.push({ group, item });
            }
        } catch (err) {
            console.log(`[CCMTV-Cron] 班次 [${group.group_name}] 状态查询失败: ${err.message}`);
        }
    }

    const candidate = eligibleGroups.find(item => String(item.group.selected) === '1') || eligibleGroups[0];
    if (!candidate) {
        console.log('[CCMTV-Cron] 服务端未授权任何班次打卡，安全退出');
        return;
    }

    const candidateGroup = candidate.group;

    const groupName = candidateGroup.group_name;
    const displayGroupName = formatDisplayGroupName(groupName);
    const configId = candidateGroup.config_id || '';
    const configKey = candidateGroup.config_key;
    const configType = candidateGroup.config_type || '';
    console.log(`[CCMTV-Cron] 匹配到目标候选班次: [${groupName}] (key: ${configKey})`);

    // 4. 防风控随机抖动 (Jitter Delay，压哨生命线模式下直接极速提交，零等待)
    let delaySec = 0;
    if (isRescueWindow) {
        console.log(`[CCMTV-Cron] 触发压哨抢救模式: 距离关窗不足15分钟，跳过随机延时，立即发起抢救打卡！`);
    } else if (RANDOM_DELAY_MAX > 0) {
        delaySec = Math.floor(Math.random() * (RANDOM_DELAY_MAX + 1));
        console.log(`[CCMTV-Cron] 触发智能防风控机制: 随机等待 ${delaySec} 秒后发起签到...`);
        await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
    }

    // 5. 核心决胜帧：发起纯协议考勤打卡提交
    try {
        const formObj = {
            group_name: groupName,
            date: dateStr,
            lng: TARGET_LNG,
            lat: TARGET_LAT,
            address: TARGET_ADDRESS,
            sign_port: 'wx',
            'device[model]': device.model,
            'device[source]': device.source,
            'device[systemversion]': device.systemversion,
            'device[deviceid]': device.deviceid,
            'device[version]': device.version,
            config_id: configId,
            config_key: String(configKey)
        };

        const postBody = buildQueryString(formObj);

        console.log(`[CCMTV-Cron] 正在向服务端提交打卡报文: [${groupName}] -> ${TARGET_LNG}, ${TARGET_LAT}`);

        const submitRes = await env.post({
            url: 'https://yun.ccmtv.cn/admin.php/nbzq/Sign_in_clock_home/userMySignPost',
            headers: baseHeaders,
            body: postBody
        });

        const submitResult = JSON.parse(submitRes.body);
        if (submitResult.status === '1' || (submitResult.errorMessage && submitResult.errorMessage.includes('成功'))) {
            let verifiedItem = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const verifyInfo = await fetchSignInfo(candidateGroup);
                    const item = verifyInfo.data && verifyInfo.data[0];
                    if (verifyInfo.status === '1' && item && (String(item.click) === '0' || item.user_sign_in_time)) {
                        verifiedItem = item;
                        break;
                    }
                } catch (verifyErr) {
                    console.log(`[CCMTV-Cron] 第 ${attempt + 1} 次落盘复核失败: ${verifyErr.message}`);
                }
                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (!verifiedItem) {
                console.log('[CCMTV-Cron] 服务端提交回执成功，但复核未发现实际签到记录，停止发送成功通知');
                if (ENABLE_NOTIFY) {
                    env.notify('⚠️ CCMTV 签到待复核', `班次: ${displayGroupName}`, '服务端已返回提交成功，但暂未查询到实际签到时间，请稍后打开考勤记录确认');
                }
                return;
            }
            const now = new Date();
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            const delayTag = delaySec > 0 ? ` (随机延时 ${delaySec}s)` : '';
            let subtitle = `班次: ${displayGroupName} (${timeStr}${delayTag})`;
            let bodyMsg = `已落盘至南部战区总医院 (状态: 正常)`;

            // 1. 若为早班，附加昨日全盘考勤对账信息 (隔夜安心晨报)
            if (isMorning) {
                try {
                    const yestAudit = await getYesterdayAudit(baseHeaders);
                    bodyMsg += `\n☀️ 早安！${yestAudit}`;
                } catch (e) {}
            }

            // 2. 若为晚班/下班，生成今日全天三大考勤终盘看板
            if (currentTimeVal >= 1020 || groupName.includes('下班') || groupName.includes('晚')) {
                try {
                    const board = await generateDailyAuditBoard(baseHeaders, dateStr, groupList);
                    bodyMsg = `🎉 今日考勤看板: ${board.summaryText}\n全天打卡记录已归档至南部战区总医院越秀院区`;
                } catch (e) {}
            }

            env.notify('🎉 CCMTV 自动签到成功', subtitle, bodyMsg);
            console.log(`[CCMTV-Cron] 打卡大获全胜: ${JSON.stringify(submitResult)}`);
        } else {
            if (isRescueWindow) {
                env.notify(
                    '🚨 CCMTV 考勤紧急预警 (距关窗剩15分钟)',
                    `班次: ${displayGroupName} 尚未打卡且自愈失败！`,
                    `服务端返回: ${submitResult.errorMessage || '凭据或服务异常'}，请立即打开 CCMTV App 进行人工打卡！`
                );
            } else {
                env.notify(
                    '⚠️ CCMTV 自动签到异常',
                    `班次: ${displayGroupName}`,
                    `服务端返回: ${submitResult.errorMessage || '未知错误'}`
                );
            }
            console.log(`[CCMTV-Cron] 打卡异常返回: ${submitRes.body}`);
        }
    } catch (err) {
        console.log(`[CCMTV-Cron] 提交打卡网络异常: ${err.message}`);
        if (isRescueWindow) {
            env.notify(
                '🚨 CCMTV 考勤紧急预警 (距关窗剩15分钟)',
                `班次: ${displayGroupName} 网络通信失败，未能打卡！`,
                `网络异常: ${err.message}，请立即检查网络并打开 App 人工兜底！`
            );
        } else {
            env.notify('⚠️ CCMTV 自动打卡失败', `班次: ${displayGroupName}`, `网络通信失败: ${err.message}`);
        }
    }
}

// ==============================================================
// 模块 2: [Phase 1] 考勤页面响应注入 (锁定 DOM 与定位)
// ==============================================================
function handleHttpResponse() {
    // 顺风车凭据自愈：进入考勤页加载 HTML 时第一时间更新 Cookie
    if (CAPTURE_COOKIE && typeof $request !== 'undefined') {
        const rawCookie = $request.headers ? ($request.headers.Cookie || $request.headers.cookie) : '';
        if (rawCookie) {
            env.write(rawCookie, 'CCMTV_COOKIE');
            const pMatch = rawCookie.match(/passport=[^;]+/);
            if (pMatch) env.write(pMatch[0], 'CCMTV_PASSPORT');
            try {
                const authBundle = {
                    cookie: rawCookie,
                    captured_at: new Date().toISOString(),
                    user_agent: $request.headers['User-Agent'] || $request.headers['user-agent'] || '',
                    url: $request.url
                };
                env.write(JSON.stringify(authBundle), 'CCMTV_AUTH_BUNDLE');
            } catch(e) {}
        }
    }

    let body = $response.body;
    if (typeof body !== 'string') {
        env.done({});
        return;
    }

    const injectionScript = `
<!-- CCMTV 考勤位置固化注入补丁 (含高德地图底层SDK拦截与无感防跳变) -->
<script type="text/javascript">
(function() {
    var fixedLng = "${TARGET_LNG}";
    var fixedLat = "${TARGET_LAT}";
    var fixedAddress = "${TARGET_ADDRESS}";

    function applyAttendanceLocation() {
        if (window.$ && $('.add').length) {
            $('.add').data('lng', fixedLng).data('lat', fixedLat).text(fixedAddress);
        }
    }

    // 1. 立即同步固化 DOM
    applyAttendanceLocation();

    if (window.$) {
        $(document).ready(function() {
            applyAttendanceLocation();
        });
    }

    // 2. 覆盖页面全局定位函数
    window.getCurrentPositions = function() {
        applyAttendanceLocation();
        return true;
    };

    // 3. Hook 高德地图原生插件，从异步底层直接返回医院坐标与地址，彻底粉碎视觉跳变
    function hookAMap() {
        if (window.AMap) {
            if (AMap.Geolocation && !AMap.Geolocation._hooked) {
                AMap.Geolocation.prototype.getCurrentPosition = function(cb) {
                    applyAttendanceLocation();
                    if (typeof cb === 'function') {
                        cb('complete', {
                            position: { lng: parseFloat(fixedLng), lat: parseFloat(fixedLat) },
                            location_type: 1,
                            accuracy: 15,
                            isConverted: true,
                            formattedAddress: fixedAddress
                        });
                    }
                };
                AMap.Geolocation._hooked = true;
            }
            if (AMap.Geocoder && !AMap.Geocoder._hooked) {
                AMap.Geocoder.prototype.getAddress = function(pos, cb) {
                    applyAttendanceLocation();
                    if (typeof cb === 'function') {
                        cb('complete', {
                            info: 'OK',
                            regeocode: { formattedAddress: fixedAddress }
                        });
                    }
                };
                AMap.Geocoder._hooked = true;
            }
        }
    }
    hookAMap();
    setInterval(hookAMap, 100);

    // 4. MutationObserver 毫秒级 DOM 变动监听，任何外部写变瞬间纠正
    if (window.MutationObserver) {
        try {
            var observer = new MutationObserver(function() {
                var el = document.querySelector('.add');
                if (el && el.innerText !== fixedAddress) {
                    applyAttendanceLocation();
                }
            });
            var observeTarget = document.querySelector('.add') || document.body;
            if (observeTarget) {
                observer.observe(observeTarget, { childList: true, characterData: true, subtree: true });
            }
        } catch(e) {}
    }

    // 5. 50ms 超高频防抖锁
    setInterval(applyAttendanceLocation, 50);
})();
</script>
`;

    if (body.includes('</body>')) {
        body = body.replace('</body>', injectionScript + '</body>');
    } else {
        body = body + injectionScript;
    }

    env.done({ body: body });
}

// ==============================================================
// 模块 3: [Phase 1] 打卡请求体拦截兜底 + 凭据顺风车自动持久化
// ==============================================================
function handleHttpRequest() {
    const url = $request.url;

    // 1. 顺风车凭证自愈捕获
    if (CAPTURE_COOKIE) {
        const rawCookie = $request.headers ? ($request.headers.Cookie || $request.headers.cookie) : '';
        if (rawCookie) {
            env.write(rawCookie, 'CCMTV_COOKIE');
            const pMatch = rawCookie.match(/passport=[^;]+/);
            if (pMatch) env.write(pMatch[0], 'CCMTV_PASSPORT');
            const authBundle = {
                cookie: rawCookie,
                captured_at: new Date().toISOString(),
                user_agent: $request.headers['User-Agent'] || $request.headers['user-agent'] || '',
                url: url
            };
            env.write(JSON.stringify(authBundle), 'CCMTV_AUTH_BUNDLE');
        }
    }

    // 2. 提交接口表单重写
    const isSignSubmit = /\/(userMySignPost|userMySignPostFace|immediatelySignPost)/i.test(url);
    if (isSignSubmit && $request.body) {
        let body = $request.body;
        let groupName = '未知班次';

        try {
            const params = parseQueryString(body);
            if (Object.prototype.hasOwnProperty.call(params, 'group_name') && params.group_name) {
                groupName = params.group_name;
            }

            params.lng = TARGET_LNG;
            params.lat = TARGET_LAT;
            params.address = TARGET_ADDRESS;

            body = buildQueryString(params);

            const lastParams = {
                group_name: params.group_name || groupName,
                date: params.date || '',
                lng: params.lng,
                lat: params.lat,
                address: params.address,
                sign_port: params.sign_port || 'wx',
                config_id: params.config_id || '',
                config_key: params.config_key || '',
                device: {
                    model: params['device[model]'] || DEFAULT_DEVICE.model,
                    source: params['device[source]'] || DEFAULT_DEVICE.source,
                    systemversion: params['device[systemversion]'] || DEFAULT_DEVICE.systemversion,
                    deviceid: params['device[deviceid]'] || DEFAULT_DEVICE.deviceid,
                    version: params['device[version]'] || DEFAULT_DEVICE.version
                },
                updated_at: new Date().toISOString()
            };
            env.write(JSON.stringify(lastParams), 'CCMTV_LAST_SIGN_PARAMS');
        } catch (err) {
            body = body.replace(/(lng=)[^&]*/, `$1${TARGET_LNG}`)
                       .replace(/(lat=)[^&]*/, `$1${TARGET_LAT}`)
                       .replace(/(address=)[^&]*/, `$1${encodeURIComponent(TARGET_ADDRESS)}`);
        }

        if (ENABLE_NOTIFY) {
            env.notify(
                'CCMTV 考勤拦截已生效',
                `班次: ${formatDisplayGroupName(groupName)}`,
                `已固化坐标至南部战区总医院 (${TARGET_LNG}, ${TARGET_LAT})`
            );
        }

        env.done({ body: body });
        return;
    }

    env.done({});
}

// ==============================================================
// 主程序生命周期分发器 (Router)
// ==============================================================
(async () => {
    if (typeof $response !== 'undefined') {
        // [http-response] 触发前端注入
        handleHttpResponse();
    } else if (typeof $request !== 'undefined') {
        // [http-request] 触发请求体拦截与凭据顺风车捕获
        handleHttpRequest();
    } else {
        // [cron] 定时调度触发：进入全自动无感考勤签到流水线
        await executeCronAutoCheckin();
        env.done({});
    }
})().catch(err => {
    console.log(`[CCMTV] 全局异常: ${err.message}`);
    if (ENABLE_NOTIFY) {
        env.notify('⚠️ CCMTV 脚本异常', '定时任务报错', `错误原因: ${err.message}`);
    }
    env.done({});
});
