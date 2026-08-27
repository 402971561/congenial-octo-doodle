/*
 * 圈X 重写脚本: 将插件调用的作者服务器
 *   45.205.27.47:8088/api/v1/p   (虚拟定位轨迹下发, 已死)
 * 重定向到可用模拟服务器
 *   61.184.8.198:5562/api/v1/p  (区间模拟过点验证, 可用)
 * 仅替换 host[:port], method / headers / body / path / query 全部原样转发。
 */
const AUTHOR = '45.205.27.47:8088';
const TARGET = '61.184.8.198:5562';

(function () {
  const url = $request.url;
  if (!url) { $done({}); return; }
  // 只处理命中作者主机的请求, 其余放行
  if (url.indexOf(AUTHOR) < 0) { $done({}); return; }

  const newUrl = url.replace(AUTHOR, TARGET);
  // 圈X 只返回 {url} 时 Host 头可能不会自动更新, 这里显式同步 Host
  const headers = $request.headers || {};
  headers['Host'] = TARGET;

  console.log('[sim-redirect] ' + url + '  ->  ' + newUrl);
  console.log('[sim-redirect] Host -> ' + TARGET);
  $done({ url: newUrl, headers: headers });
})();
