/**
 * CCMTV 考勤助手 - 第一阶段：位置常量化与凭据捕获脚本
 * 适用平台：Loon / Surge / Shadowrocket
 * 仓库：https://github.com/LMuniverse/ApexApple_AE1
 * 
 * 功能职责：
 * 1. [http-response] 拦截 user_index 考勤页面，注入位置补丁，粉碎前端“定位失败”门禁，视觉直观呈现医院全称。
 * 2. [http-request]  拦截考勤提交接口，强制重写 body 中的 lng/lat/address 为南部战区总医院标准常量。
 * 3. [凭据顺风车]    捕获有效会话 Cookie 与签到参数，持久化存入 $persistentStore，为第二阶段全自动 Cron 铺路。
 */

// ========== 1. 跨平台兼容环境适配器 ==========
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
                    EnableNotify: $argument[4] !== false && $argument[4] !== 'false'
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
                            EnableNotify: parsed[4] !== false && parsed[4] !== 'false'
                        };
                    }
                    return parsed;
                }
                return Object.fromEntries(
                    $argument.split('&').map(pair => {
                        const idx = pair.indexOf('=');
                        return idx === -1 ? [pair, ''] : [pair.slice(0, idx), decodeURIComponent(pair.slice(idx + 1))];
                    })
                );
            } catch (e) {
                console.log(`[${this.name}] 解析 $argument 出错: ${e.message}`);
                return {};
            }
        }
        return {};
    }

    done(data) {
        $done(data || {});
    }
}

const env = new EnvHelper('CCMTV-Attendance');

// ========== 2. 解析配置参数与默认目标常量 ==========
const args = env.parseArgument();

// 南部战区总医院(越秀院区)高德标准经纬度与逐字核验地址
const TARGET_LNG = args.LNG || '113.25680';
const TARGET_LAT = args.LAT || '23.14200';
const TARGET_ADDRESS = args.ADDRESS || '广东省广州市越秀区流花街道人民北路辅路中国人民解放军南部战区总医院(越秀院区)';
const CAPTURE_COOKIE = args.CaptureCookie !== 'false' && args.CaptureCookie !== false;
const ENABLE_NOTIFY = args.EnableNotify !== 'false' && args.EnableNotify !== false;

// ========== 3. 主流程分发处理 ==========
(async () => {
    // -------------------------------------------------------------
    // 分支 A: [http-response] 拦截考勤主页面，执行前端 DOM/JS 运行时注入
    // -------------------------------------------------------------
    if (typeof $response !== 'undefined' && $response.body) {
        const url = $request ? $request.url : '';
        console.log(`[CCMTV] 命中考勤页面响应: ${url}`);

        let body = $response.body;

        // 注入客户端锁定代码：直接锁定 $('.add') 属性并劫持高德定位逻辑
        const injectionScript = `
<!-- CCMTV 考勤位置固化注入补丁 -->
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

    // 1. 立即执行一次
    applyAttendanceLocation();

    // 2. DOM Ready 时执行
    if (window.$) {
        $(document).ready(function() {
            applyAttendanceLocation();
        });
    }

    // 3. 彻底劫持考勤页面的定位获取函数，防止高德异步回调或刷新按钮冲掉数据
    window.getCurrentPositions = function() {
        applyAttendanceLocation();
        return true;
    };

    // 4. 定时轮询捍卫 DOM 状态，确保在任何时间点点击打卡都具备有效坐标
    setInterval(applyAttendanceLocation, 500);

    console.log("[CCMTV-Plugin] 前端考勤定位已成功锁定至目标常量: " + fixedAddress);
})();
</script>
`;

        if (body.includes('</body>')) {
            body = body.replace('</body>', injectionScript + '</body>');
        } else {
            body = body + injectionScript;
        }

        console.log(`[CCMTV] 成功注入前端位置固化补丁，已就绪`);
        env.done({ body: body });
        return;
    }

    // -------------------------------------------------------------
    // 分支 B: [http-request] 拦截考勤提交请求，重写请求体并捕获会话凭据
    // -------------------------------------------------------------
    if (typeof $request !== 'undefined') {
        const url = $request.url;
        console.log(`[CCMTV] 命中考勤网络请求: ${url}`);

        // 1. 顺风车凭据捕获：记录有效会话 Cookie
        if (CAPTURE_COOKIE) {
            const rawCookie = $request.headers ? ($request.headers.Cookie || $request.headers.cookie) : '';
            if (rawCookie) {
                env.write(rawCookie, 'CCMTV_COOKIE');
                const authBundle = {
                    cookie: rawCookie,
                    captured_at: new Date().toISOString(),
                    user_agent: $request.headers['User-Agent'] || $request.headers['user-agent'] || '',
                    url: url
                };
                env.write(JSON.stringify(authBundle), 'CCMTV_AUTH_BUNDLE');
                console.log(`[CCMTV] 成功捕获并更新会话 Cookie 与凭据包`);
            }
        }

        // 2. 考勤提交接口兜底拦截：重写表单参数
        const isSignSubmit = /\/(userMySignPost|userMySignPostFace|immediatelySignPost)/i.test(url);
        if (isSignSubmit && $request.body) {
            let body = $request.body;
            let groupName = '未知班次';

            try {
                const params = new URLSearchParams(body);
                if (params.has('group_name')) {
                    groupName = params.get('group_name');
                }

                // 强制改写关键坐标与地址参数为目标常量
                params.set('lng', TARGET_LNG);
                params.set('lat', TARGET_LAT);
                params.set('address', TARGET_ADDRESS);

                body = params.toString();

                // 将打卡关键参数归档保存，供第二阶段 Cron 调试与比对
                const lastParams = {
                    group_name: params.get('group_name'),
                    date: params.get('date'),
                    lng: params.get('lng'),
                    lat: params.get('lat'),
                    address: params.get('address'),
                    sign_port: params.get('sign_port'),
                    device: params.get('device'),
                    config_id: params.get('config_id'),
                    config_key: params.get('config_key'),
                    updated_at: new Date().toISOString()
                };
                env.write(JSON.stringify(lastParams), 'CCMTV_LAST_SIGN_PARAMS');

                console.log(`[CCMTV] 提交表单已完成目标常量重写: [${groupName}] -> ${TARGET_LNG}, ${TARGET_LAT}`);
            } catch (err) {
                console.log(`[CCMTV] URLSearchParams 解析失败，启用正则备用替换: ${err.message}`);
                body = body.replace(/(lng=)[^&]*/, `$1${TARGET_LNG}`)
                           .replace(/(lat=)[^&]*/, `$1${TARGET_LAT}`)
                           .replace(/(address=)[^&]*/, `$1${encodeURIComponent(TARGET_ADDRESS)}`);
            }

            // 发送系统推送通知
            if (ENABLE_NOTIFY) {
                env.notify(
                    'CCMTV 考勤拦截已生效',
                    `班次: ${groupName}`,
                    `已固化坐标至南部战区总医院 (${TARGET_LNG}, ${TARGET_LAT})`
                );
            }

            env.done({ body: body });
            return;
        }

        // 其他请求直接放行
        env.done({});
        return;
    }

    env.done({});
})().catch(err => {
    console.log(`[CCMTV] 脚本运行异常: ${err.message}`);
    env.done({});
});
