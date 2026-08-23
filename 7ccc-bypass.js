/**
 * 7c云网络验证系统 - 响应改写脚本
 * =============================================
 * 用途：绕过蜂鸟骑士的卡密验证（api*.7ccccccc.com）
 * 原理：请求照常发到服务器，响应到达圈X时被本脚本改写，
 *       强制把授权结果改成「已授权」，app 收到的就是通过状态。
 *       因请求是 HTTP 明文，无需 MITM / CA 证书。
 *
 * 配合 7ccc-bypass.snippet 使用。
 */

const url = $request.url;
let body = $response.body || '';

// 构造一份"成功授权"的响应对象
function successObject(extra) {
    const now = Math.floor(Date.now() / 1000);
    return Object.assign({
        code: 0,
        message: 'ok',
        result: {
            expires: '2099-12-31 23:59:59',
            expires_ts: 4102444799,          // 2099-12-31 的秒级时间戳
            server_time: now
        }
    }, extra || {});
}

let obj = null;
try {
    obj = JSON.parse(body);
} catch (e) {
    obj = null;
}

if (obj && typeof obj === 'object') {
    // ---- 强制授权成功 ----
    obj.code = 0;
    obj.message = 'ok';

    // 兼容不同接口可能用到的各种"成功标志位"
    if ('success' in obj) obj.success = true;
    if ('status' in obj)  obj.status  = 1;
    if ('isValid' in obj) obj.isValid = true;

    // 补全 result 字段
    if (!obj.result || typeof obj.result !== 'object') {
        obj.result = {};
    }
    obj.result.expires     = obj.result.expires     || '2099-12-31 23:59:59';
    obj.result.expires_ts  = obj.result.expires_ts  || 4102444799;
    obj.result.server_time = obj.result.server_time || Math.floor(Date.now() / 1000);
    obj.result.token       = obj.result.token       || ('bypass-' + Date.now());
} else {
    // 非 JSON 响应（空、HTML、纯文本等），直接给一份成功 JSON
    obj = successObject();
}

// 强制 HTTP 200 + JSON，确保 app 端解析为授权成功
$done({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
});
