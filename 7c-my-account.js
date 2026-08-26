/**
 * 蜂鸟众包 - 用「我的」7c云凭证接入 (Quantumult X 重写)
 * ============================================================
 * 思路：App 发往 api*.7ccccccc.com 的卡密请求，被本脚本拦下，
 *       把 appKey 换成我自己的、用我的 appSecret 按官方公式重算 sign，
 *       请求原样打到真实 7c 平台，平台用我的账号校验卡密返回真·code:0。
 *
 * 启用方式见 7c-my-account.snippet / README。
 *
 * 两种模式（同一个文件，圈X 分别用 request-body / response-body 规则调用）：
 *   A) script-request-body : 改写请求中的 appKey + 重算 sign（核心）
 *   B) script-response-body: 兜底——若 App 只校验 code、不校验响应 sign，
 *                            把非 0 响应改成 code:0（见底部说明）
 */

// ============ 你的凭证（按官方后台填） ============
const MY_APPKEY    = 'FBgOqEtSkcooDyJW5j';
const MY_APPSECRET = 'mXatLbBPLvUQYIukLLwdCENtSf9Qdqfe';
const MY_APPNAME   = '蜂鸟';
// 若原请求里本来就有 appName 字段，则一并换成你的；否则不新增（避免破坏签名串）
// =================================================

// ---------------- MD5（标准实现，圈X 无内置 $md5） ----------------
function md5(input) {
  function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >>> 16) + (y >>> 16) + (lsw >>> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { a = safeAdd(safeAdd(a, q), safeAdd(x, t)); return safeAdd(bitRotateLeft(a, s), b); }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | (~d)), a, b, x, s, t); }

  function str2rstr_utf8(s) {
    let out = '';
    let i = -1, len = s.length;
    while (++i < len) {
      const c = s.charCodeAt(i);
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0x800) out += String.fromCharCode(0xc0 | (c >>> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c < 0xe000) { i++; const c2 = 0x10000 + (((c & 0x3ff) << 10) | (s.charCodeAt(i) & 0x3ff)); out += String.fromCharCode(0xf0 | (c2 >>> 18), 0x80 | ((c2 >>> 12) & 0x3f), 0x80 | ((c2 >>> 6) & 0x3f), 0x80 | (c2 & 0x3f)); }
      else out += String.fromCharCode(0xe0 | (c >>> 12), 0x80 | ((c >>> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }
  function rstr2binl(input) {
    const out = [];
    for (let i = 0; i < input.length * 8; i += 8) {
      out[i >> 5] = (out[i >> 5] || 0) | ((input.charCodeAt(i / 8) & 0xff) << (i % 32));
    }
    return out;
  }
  function binl2rstr(input) {
    let out = '';
    for (let i = 0; i < input.length * 32; i += 8) out += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xff);
    return out;
  }
  function binl_md5(x, len) {
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = md5ff(a, b, c, d, x[i], 7, -680876936); d = md5ff(d, a, b, c, x[i + 1], 12, -389564586); c = md5ff(c, d, a, b, x[i + 2], 17, 606105819); b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897); d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426); c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417); c = md5ff(c, d, a, b, x[i + 10], 17, -42063); b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, x[i + 13], 12, -40341101); c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510); d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632); c = md5gg(c, d, a, b, x[i + 11], 14, 643717713); b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691); d = md5gg(d, a, b, c, x[i + 10], 9, 38016083); c = md5gg(c, d, a, b, x[i + 15], 14, -660478335); b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438); d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690); c = md5gg(c, d, a, b, x[i + 3], 14, -187363961); b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, x[i + 2], 9, -51403784); c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i + 5], 4, -378558); d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463); c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353); c = md5hh(c, d, a, b, x[i + 7], 16, -155497632); b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174); d = md5hh(d, a, b, c, x[i], 11, -358537222); c = md5hh(c, d, a, b, x[i + 3], 16, -722521979); b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487); d = md5hh(d, a, b, c, x[i + 12], 11, -421815835); c = md5hh(c, d, a, b, x[i + 15], 16, 530742520); b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i], 6, -198630844); d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415); c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606); c = md5ii(c, d, a, b, x[i + 10], 15, -1051523); b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, x[i + 15], 10, -30611744); c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070); d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379); c = md5ii(c, d, a, b, x[i + 2], 15, 718787259); b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
    }
    return [a, b, c, d];
  }
  function rstr2hex(input) {
    const tab = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < input.length; i++) { const x = input.charCodeAt(i); out += tab.charAt((x >>> 4) & 0x0f) + tab.charAt(x & 0x0f); }
    return out;
  }
  function rstr_md5(s) { return binl2rstr(binl_md5(rstr2binl(s), s.length * 8)); }
  return rstr2hex(rstr_md5(str2rstr_utf8(input)));
}

// ---------------- 工具 ----------------
function parseInto(params, str) {
  if (!str) return;
  str.split('&').forEach(function (p) {
    if (!p) return;
    const idx = p.indexOf('=');
    const k = idx < 0 ? p : p.slice(0, idx);
    const v = idx < 0 ? '' : p.slice(idx + 1);
    params[k] = decodeURIComponent(v.replace(/\+/g, ' '));
  });
}
function enc(k, v) { return k + '=' + encodeURIComponent(v); }

// =================================================================
// 模式 A：请求重写
// =================================================================
if (typeof $request !== 'undefined') {
  const url = $request.url;
  const isCard = url.indexOf('/v1/card/') !== -1;
  const isSoft = url.indexOf('/v1/software/') !== -1;

  if (isCard || isSoft) {
    const method = ($request.method || 'POST').toUpperCase();
    const um = url.match(/^https?:\/\/([^\/?#]+)(\/[^?#]*)?(\?[^#]*)?/);
    const host = um ? um[1] : '';
    const path = um && um[2] ? um[2] : '/';
    const query = um && um[3] ? um[3].slice(1) : '';

    const params = {};
    parseInto(params, query);
    if (method === 'POST' && $request.body) parseInto(params, $request.body);

    // 换成我的凭证
    params.appKey = MY_APPKEY;
    if ('appName' in params) params.appName = MY_APPNAME;   // 仅当原请求已有该字段才覆盖
    delete params.sign;

    // 签名：参数按 key 升序排，值【不】urlencode，最后追加 appSecret
    const keys = Object.keys(params).sort();
    const pstr = keys.map(function (k) { return k + '=' + params[k]; }).join('&');
    const raw = method + host + path + pstr + MY_APPSECRET;
    const sign = md5(raw);
    params.sign = sign;

    const out = keys.map(function (k) { return enc(k, params[k]); });
    out.push(enc('sign', sign));

    if (method === 'POST') {
      const newBody = out.join('&');
      console.log('[7c] 请求已改写为我的凭证 appKey=' + MY_APPKEY + ' sign=' + sign);
      $done({ body: newBody });
    } else {
      const newUrl = url.replace(/\?.*$/, '') + '?' + out.join('&');
      console.log('[7c] GET 请求已改写为我的凭证');
      $done({ url: newUrl });
    }
  } else {
    $done({});
  }
}

// =================================================================
// 模式 B：响应兜底（仅当 App 只校验 code、不校验响应 sign 时有效）
//   说明：真实平台用【我的】appSecret 签响应；而 App 内置的是【作者】的
//   appSecret。若 App 会校验响应 sign，则本兜底改写会破坏校验，需改用
//   frida/dylib 方案（能抓到 App 内置 appSecret 伪造合法 sign）。
// =================================================================
else if (typeof $response !== 'undefined') {
  let body = $response.body || '';
  let obj = null;
  try { obj = JSON.parse(body); } catch (e) { obj = null; }

  if (obj && typeof obj === 'object' && obj.code !== undefined && obj.code !== 0) {
    obj.code = 0;
    obj.message = 'ok';
    if (!obj.result || typeof obj.result !== 'object') obj.result = {};
    const now = Math.floor(Date.now() / 1000);
    obj.result.expires = obj.result.expires || '2099-12-31 23:59:59';
    obj.result.expires_ts = obj.result.expires_ts || 4102444799;
    obj.result.server_time = obj.result.server_time || now;
    console.log('[7c] 响应兜底 -> code:0 (若App校验sign此法无效)');
    $done({ body: JSON.stringify(obj) });
  } else {
    $done({});
  }
}
