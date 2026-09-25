// 金立方 GoldCube 服务：GoldCube 首页/登录 + 原版 VOZEB 登录后页面与 API 反向代理
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const port = Number(process.env.PORT || 3301);
const backend = { hostname: process.env.GOLDCUBE_BACKEND_HOST || "127.0.0.1", port: Number(process.env.GOLDCUBE_BACKEND_PORT || 3300) };
const backendOrigin = "http://localhost:" + backend.port;
const localOrigin = "http://localhost:" + port;
const rootAbs = path.resolve(root);
const NEXT_PROXY_PREFIX = "/goldcube-next/";
// VOZEB 端 admin 用户的 session cookie（env 配置），用于 GoldCube 后端代理
// /api/site/logical-models 拉取真实 logicalModels / defaultModels 供前端动态渲染模型下拉。
const VOICEPRO_SESSION = process.env.GOLDCUBE_VOICEPRO_SESSION || "";
const LOGICAL_MODELS_CACHE_TTL_MS = Number(process.env.GOLDCUBE_LOGICAL_MODELS_TTL_MS || 300000);
const logicalModelsCache = { payload: null, fetchedAt: 0, inflight: null };
function fetchLogicalModelsFromBackend() {
  return new Promise(function(resolve, reject){
    if (!VOICEPRO_SESSION) return reject(new Error("GOLDCUBE_VOICEPRO_SESSION not configured"));
    const headers = { host: "localhost:" + backend.port, "accept-encoding": "identity", "accept": "application/json", cookie: "vozeb_pro_session=" + VOICEPRO_SESSION };
    const upstream = http.request({ ...backend, path: "/api/auth/session", method: "GET", headers }, function(upstreamRes){
      const chunks = [];
      upstreamRes.on("data", function(c){ chunks.push(c); });
      upstreamRes.on("end", function(){
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (upstreamRes.statusCode !== 200) return reject(new Error("voicepro " + upstreamRes.statusCode + ": " + (body && body.msg) || ""));
          if (!body.user) return reject(new Error("voicepro session 失效"));
          const settings = body.settings || {};
          resolve({
            logicalModels: Array.isArray(settings.logicalModels) ? settings.logicalModels : [],
            defaultModels: settings.defaultModels || {},
            systemChannels: Array.isArray(settings.systemChannels) ? settings.systemChannels : [],
            fetchedAt: Date.now()
          });
        } catch (err) { reject(err); }
      });
    });
    upstream.setTimeout(15000, function(){ upstream.destroy(new Error("voicepro /api/auth/session timeout")); });
    upstream.on("error", reject);
    upstream.end();
  });
}
async function getLogicalModels() {
  const now = Date.now();
  if (logicalModelsCache.payload && (now - logicalModelsCache.fetchedAt) < LOGICAL_MODELS_CACHE_TTL_MS) return logicalModelsCache.payload;
  if (logicalModelsCache.inflight) return logicalModelsCache.inflight;
  logicalModelsCache.inflight = fetchLogicalModelsFromBackend().then(function(p){
    logicalModelsCache.payload = p; logicalModelsCache.fetchedAt = Date.now(); logicalModelsCache.inflight = null; return p;
  }).catch(function(err){
    logicalModelsCache.inflight = null; throw err;
  });
  return logicalModelsCache.inflight;
}
function serveLogicalModels(req, res) {
  getLogicalModels().then(function(payload){
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" });
    res.end(JSON.stringify({ data: payload }));
  }).catch(function(err){
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: "GoldCube 后端不可用", detail: err.message || String(err) }));
  });
}
// 在 React 完成水合后仅替换可见文本，不触碰原版运行时代码、CSS class 或 localStorage key，确保登录后交互保持原版。
const BRAND_RUNTIME = "(function(){\n  var started=false;\n  function keepTitle(){var v=replacement(document.title||\"\");if(document.title!==v)document.title=v}\n  function watchTitle(){keepTitle();if(!document.head)return;new MutationObserver(function(){keepTitle()}).observe(document.head,{childList:true,subtree:true,characterData:true})}\n  function replacement(v){if(location.pathname===\"/open-source\"||location.pathname===\"/open-source/\")return v;return v.replace(/VOZEB PRO/g,\"金立方 GoldCube\").replace(/VOZEB/g,\"GoldCube\")}\n  function change(node){if(!node||node.nodeType!==3)return;var p=node.parentElement;if(!p||p.closest(\"script,style,noscript,textarea,input,pre,code\"))return;var v=node.nodeValue,n=replacement(v);if(n!==v)node.nodeValue=n}\n  function scan(root){if(!root)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(var n=w.nextNode();n;n=w.nextNode())change(n);}\n  function removeAdminEntry(){document.querySelectorAll('a[href=\"/admin\"],a[href=\"/admin/\"]').forEach(function(a){var row=a.closest('li[role=\"menuitem\"],[role=\"menuitem\"],.ant-dropdown-menu-item');(row||a).remove()});document.querySelectorAll('li[data-menu-id=\"rc-menu-uuid-admin\"],li[data-menu-id$=\"-admin\"]').forEach(function(row){row.remove()});document.querySelectorAll('[role=\"menuitem\"],li').forEach(function(row){var label=(row.textContent||\"\").trim();if(label===\"管理后台\"||label===\"管理员后台\")row.remove()})}\n  function start(){if(started)return;started=true;scan(document.body);document.title=replacement(document.title);removeAdminEntry();new MutationObserver(function(ms){var changed=false;ms.forEach(function(m){if(m.type===\"childList\"&&m.addedNodes.length)changed=true});if(changed){scan(document.body);removeAdminEntry()}}).observe(document.documentElement,{childList:true,subtree:true});document.documentElement.classList.remove(\"goldcube-brand-pending\")}\n  watchTitle();\n  if(document.readyState===\"complete\")setTimeout(start,1200);else addEventListener(\"load\",function(){setTimeout(start,1200)},{once:true})\n})();";
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".gif":"image/gif", ".mp4":"video/mp4", ".mp3":"audio/mpeg", ".wav":"audio/wav", ".json":"application/json", ".md":"text/markdown; charset=utf-8", ".ico":"image/x-icon", ".woff":"font/woff", ".woff2":"font/woff2", ".ttf":"font/ttf" };
// GoldCube 图片回显体验修复：AI 生成结果图（Agent 对话结果卡 / 创作结果 / 最近生成）统一固定容器框，
// 图片默认等比缩放完整展示（object-fit: contain，不裁切），点击图片放大看全图。
// 只作用于“结果图”容器（figure/AgentMediaPreview 外层），不影响头像、参考图缩略图、作品卡片等小图。
const MEDIA_FIX_CSS = `[data-testid="creative-media-round"] figure, [data-testid="creative-result-group"] figure, [data-testid="creative-video-result"] figure, .agent-media-image-preview img, [data-testid="creative-media-round"] .group\\/media img, [data-testid="creative-result-group"] .group\\/media img{object-fit:contain!important}
[data-testid="creative-media-round"] figure .group\\/media, [data-testid="creative-result-group"] figure .group\\/media{overflow:hidden!important;border-radius:10px}
[data-testid="creative-media-round"] figure img, [data-testid="creative-result-group"] figure img{max-height:70vh!important;width:auto!important;max-width:100%!important;object-fit:contain!important}
[data-testid="creative-media-round"] figure, [data-testid="creative-result-group"] figure{position:relative;overflow:hidden;border-radius:10px;background:#0001}
.ant-image-preview-mask{background:rgba(0,0,0,.88)!important}
.ant-image-preview-operations{background:rgba(0,0,0,.32)!important}
.ant-image-preview-img-wrapper .ant-image-preview-img{max-width:100%!important;max-height:86vh!important;object-fit:contain!important}
.ant-modal.agent-media-image-preview{max-width:min(1200px, calc(100vw - 32px))!important}
.ant-modal.agent-media-image-preview .ant-modal-body{overflow:auto!important}
@media (max-width:640px){[data-testid="creative-media-round"] figure img,[data-testid="creative-result-group"] figure img{max-height:52vh!important}}`;
const MEDIA_FIX_RUNTIME = "(function(){try{\n  function css(){var st=document.getElementById('goldcube-media-fix-style');if(!st&&document.head){st=document.createElement('style');st.id='goldcube-media-fix-style';st.textContent=" + JSON.stringify(MEDIA_FIX_CSS) + ";document.head.appendChild(st)}}\n  function ready(){if(document.readyState==='complete'){css()}else{addEventListener('load',function(){setTimeout(css,60)},{once:true});document.addEventListener('readystatechange',function(){if(document.readyState==='complete')setTimeout(css,60)})}}\n  ready();\n}catch(e){}})();";

// 0.3 边界：外壳首页、登录页仍由 GoldCube 提供；登录后的用户端页面走 3300 原版。
const BLOCKED_PREFIXES = ["/admin/setup", "/admin-setup", "/link-management"];
const ORIGINAL_ROUTES = [
  "/create", "/canvas", "/drama", "/assets", "/works", "/community", "/prompts", "/my-prompts",
  "/me", "/profile", "/billing", "/help"
];
const LOCAL_ROUTE_FILES = new Map([["/login", "/login.html"], ["/register", "/register.html"], ["/forgot-password", "/forgot-password.html"]]);
const HTML_ALIASES = new Map([
  ["/create.html", "/create"], ["/canvas.html", "/canvas"], ["/drama.html", "/drama"],
  ["/assets.html", "/assets"], ["/works.html", "/works"], ["/community.html", "/community"],
  ["/prompts.html", "/prompts"], ["/my-prompts.html", "/my-prompts"], ["/me.html", "/me"],
  ["/profile.html", "/profile"], ["/billing.html", "/billing"], ["/billing-checkout.html", "/billing/checkout"],
  ["/billing-success.html", "/billing/success"], ["/billing-cancel.html", "/billing/cancel"], ["/help.html", "/help"]
]);

function pathnameOf(req) {
  try { return decodeURIComponent(new URL(req.url || "/", localOrigin).pathname); } catch { return null; }
}
function isBlocked(pathname) {
  return BLOCKED_PREFIXES.some((base) => pathname === base || pathname.startsWith(base + "/"));
}
function isNextFlightRequest(req) {
  const headers = req.headers || {};
  const accept = String(headers.accept || "").toLowerCase();
  return headers.rsc === "1" || Boolean(headers["next-router-state-tree"]) || Boolean(headers["next-url"]) || Boolean(headers["next-router-prefetch"]) || accept.includes("text/x-component");
}
function isOriginalPage(pathname) {
  // 登录后的原版可能新增二级/三级路由；无扩展名页面一律保持原版，而非回退到旧静态原型。
  return ORIGINAL_ROUTES.some((base) => pathname === base || pathname.startsWith(base + "/"))
    || (!path.extname(pathname) && pathname !== "/" && !LOCAL_ROUTE_FILES.has(pathname) && !isBlocked(pathname));
}
function rewriteSetCookie(value) {
  return value.map((cookie) => cookie
    .replace(/;\s*Domain=[^;]*/ig, "")
    .replace(/;\s*Secure/ig, ""));
}
function rewriteLocation(value) {
  if (!value) return value;
  return value.replaceAll(backendOrigin, localOrigin).replaceAll("localhost:" + backend.port, "localhost:" + port);
}
function proxyToBackend(req, res, options = {}) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-forwarded-for"];
  // 禁用上游压缩，便于谨慎处理 HTML 品牌文案并避免跨端口资源地址残留。
  headers["accept-encoding"] = "identity";
  headers.host = "localhost:" + backend.port;
  headers.origin = backendOrigin;
  headers.referer = backendOrigin + "/";
  const upstreamPath = options.nextAlias ? (req.url || "").replace(/^\/goldcube-next\//, "/_next/") : req.url;
  let upstreamResponse;
  const fail = (err) => {
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: "GoldCube 后端不可用", detail: err.code || err.message }));
  };
  const upstream = http.request({ ...backend, path: upstreamPath, method: req.method, headers }, (upstreamRes) => {
    upstreamResponse = upstreamRes;
    upstreamRes.on("error", fail);
    const outHeaders = { ...upstreamRes.headers };
    if (outHeaders["set-cookie"]) outHeaders["set-cookie"] = rewriteSetCookie(outHeaders["set-cookie"]);
    if (outHeaders.location) outHeaders.location = rewriteLocation(outHeaders.location);
    // 3300 原版通过 CSP 的 upgrade-insecure-requests 强制 HTTPS；3301 当前为 HTTP，浏览器会因此把同源 CSS/JS 升级到 HTTPS 并全部加载失败。
    // 仅移除这一条不适用于 HTTP 部署的指令，保留其余安全策略，确保登录后原版页面正常加载样式。
    if (outHeaders["content-security-policy"]) {
      outHeaders["content-security-policy"] = outHeaders["content-security-policy"]
        .replace(/(^|;)\s*upgrade-insecure-requests\s*(?=;|$)/ig, "")
        .replace(/;;+/g, ";")
        .replace(/^;|;$/g, "")
        .trim();
    }
    const type = String(outHeaders["content-type"] || "").toLowerCase();
    const isEventStream = type.split(";", 1)[0].trim() === "text/event-stream";
    const streaming = options.streaming || isEventStream;
    if (isEventStream) outHeaders["x-accel-buffering"] = "no";
    const shouldTransform = !streaming && (options.html || (options.transform && (type.startsWith("text/") || type.includes("javascript") || type.includes("json"))));
    if (shouldTransform) {
      delete outHeaders["content-length"];
      delete outHeaders["content-encoding"];
      if (options.html) outHeaders["content-type"] = "text/html; charset=utf-8";
      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        let body = Buffer.concat(chunks).toString("utf8");
        // 原版 SSR/运行时会同时出现普通 URL 与 JSON 转义 URL，二者均需留在 3301。
        body = body.replaceAll(backendOrigin, localOrigin).replaceAll("localhost:" + backend.port, "localhost:" + port);
        // 将品牌同步写入 SSR 与 Flight 数据，确保 React 水合拿到的初始文本与页面一致，避免品牌运行时改写触发 #418。
        if (false) body = body.replaceAll("VOZEB PRO", "金立方 GoldCube").replaceAll("VOZEB", "GoldCube");
        // 以独立本地路径加载 Next 资源：既避免浏览器旧缓存，又让动态 chunk 继续经 3301 代理。
        if (options.html || options.transform) body = body.replaceAll("/_next/", NEXT_PROXY_PREFIX);
        // title 不参与 React 页面水合，服务端直接品牌化，避免首次绘制仍显示原版标题。
        body = body.replace(/<title>([\s\S]*?)<\/title>/i, (_, title) => `<title>${title.replace(/VOZEB PRO/g, "金立方 GoldCube").replace(/VOZEB/g, "GoldCube")}</title>`);
        // SSR 与原版 React 运行时保持同一文本，待水合完成后再品牌化可见文字，避免 React #418 水合错误。
        if (options.html) {
          const nonce = [...body.matchAll(/nonce="([^"]+)"/gi)].map((match) => match[1]).find((value) => value);
          const compat = nonce ? "<script nonce=\"" + nonce + "\">(function(){try{var c=globalThis.crypto;if(c\u0026\u0026typeof c.randomUUID!==\"function\"\u0026\u0026typeof c.getRandomValues===\"function\"){var uuid=function(){var b=new Uint8Array(16);c.getRandomValues(b);b[6]=(b[6]\u0026 15)|64;b[8]=(b[8]\u0026 63)|128;var h=Array.from(b,function(x){return x.toString(16).padStart(2,\"0\")}).join(\"\");return h.slice(0,8)+\"-\"+h.slice(8,12)+\"-\"+h.slice(12,16)+\"-\"+h.slice(16,20)+\"-\"+h.slice(20)};try{c.randomUUID=uuid}catch(e){try{Object.defineProperty(c,\"randomUUID\",{value:uuid,configurable:true})}catch(e2){}}}}catch(e){}})();</script>" : "";
          const preload = nonce ? "<style nonce=\"" + nonce + "\">html.goldcube-brand-pending body > div:not([hidden]){visibility:hidden!important}</style><script nonce=\"" + nonce + "\">document.documentElement.classList.add(\"goldcube-brand-pending\")</script>" : "";
          const runtime = nonce ? "<script nonce=\"" + nonce + "\">" + BRAND_RUNTIME + "</script>" : "";
          const mediaFix = nonce ? "<script nonce=\"" + nonce + "\">" + MEDIA_FIX_RUNTIME + "</script>" : "";
          body = body.replace("</head>", compat + preload + runtime + mediaFix + "</head>");
        }
        res.writeHead(upstreamRes.statusCode || 502, outHeaders);
        res.end(body);
      });
      return;
    }
    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    if (streaming) res.flushHeaders();
    upstreamRes.pipe(res);
  });
  upstream.setTimeout(30000, () => upstream.destroy(new Error("upstream timeout")));
  upstream.on("error", fail);
  // Stop only the disconnected HTTP subscription, never the durable Agent run.
  res.on("close", () => {
    upstreamResponse?.destroy();
    upstream.destroy();
  });
  req.pipe(upstream);
}
function serveStatic(req, res) {
  const pathname = pathnameOf(req);
  if (!pathname) { res.writeHead(400); return res.end("Bad Request"); }
  let p = pathname;
  if (p.endsWith("/")) p += "index.html";
  const file = path.resolve(root, "." + path.normalize(p));
  if (!(file === rootAbs || file.startsWith(rootAbs + path.sep))) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }); return res.end("404 Not Found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}
http.createServer((req, res) => {
  const pathname = pathnameOf(req) || "/";
  const localRoute = LOCAL_ROUTE_FILES.get(pathname);
  if (localRoute) {
    req.url = localRoute + ((req.url || "").includes("?") ? (req.url || "").slice((req.url || "").indexOf("?")) : "");
    return serveStatic(req, res);
  }
  const alias = HTML_ALIASES.get(pathname);
  if (alias) {
    const query = (req.url || "").includes("?") ? (req.url || "").slice((req.url || "").indexOf("?")) : "";
    res.writeHead(302, { Location: alias + query, "Cache-Control": "no-store" });
    return res.end();
  }
  if (isBlocked(pathname)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }); return res.end("404 Not Found"); }
  if (pathname === "/api/site/logical-models" && req.method === "GET") return serveLogicalModels(req, res);
  // Analysis emits JSON whitespace heartbeats while waiting for the model.
  // Forward them immediately; buffering recreates the outer proxy timeout.
  if (pathname === "/api/drama/analyze") return proxyToBackend(req, res, { streaming: true });
  if (pathname.startsWith("/api/")) return proxyToBackend(req, res, { transform: true });
  if (pathname.startsWith(NEXT_PROXY_PREFIX)) return proxyToBackend(req, res, { transform: true, nextAlias: true });
  if (pathname.startsWith("/_next/")) return proxyToBackend(req, res, { transform: true });
  if (pathname === "/manifest.webmanifest") return proxyToBackend(req, res, { transform: true });
  if (isOriginalPage(pathname)) return proxyToBackend(req, res, isNextFlightRequest(req) ? { transform: true } : { html: true });
  return serveStatic(req, res);
}).listen(port, "0.0.0.0", () => console.log("GoldCube 0.3 http://localhost:" + port + " -> " + backendOrigin + " (home/login local; user pages original)"));
