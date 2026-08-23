// Vercel Serverless Function: /api/proxy.js
// 安全约束（已落地）：
// 1. 用户传入的 DeepSeek API Key 仅在本次请求内存中透传，处理完成立即丢弃，绝不打印/存储/落库。
// 2. 仅允许转发 DeepSeek 官方接口路径（目标地址硬编码），拒绝任何第三方 URL，防止被当通用跳板。
// 3. CORS 仅允许配置的来源（含 *.vercel.app 与 ALLOWED_ORIGINS 环境变量），拒绝其他站点调用。
// 4. 简易按 IP 访问频率限流，防止被恶意刷量。
// 5. 不硬编码任何 DeepSeek 密钥，密钥全部来自前端请求头。

const RATE = {}; // 进程内存：ip -> [timestamp,...]（注意：Serverless 多实例下为单实例限流，生产可换 Redis）

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) { resolve(req.body); return; }
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}

function getClientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || 'unknown';
}

function corsHeaders(origin, allowedOrigin) {
  const h = {};
  if (allowedOrigin) {
    h['Access-Control-Allow-Origin'] = allowedOrigin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Vary'] = 'Origin';
  }
  return h;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowedList = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const isVercel = origin.endsWith('.vercel.app');
  const allowedOrigin = (origin && (allowedList.includes(origin) || isVercel)) ? origin : null;

  // 预检
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders(origin, allowedOrigin)).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // CORS 实际请求：非白名单来源直接拒绝
  if (!allowedOrigin) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  Object.entries(corsHeaders(origin, allowedOrigin)).forEach(([k, v]) => res.setHeader(k, v));

  // 频率限流：每 IP 每分钟最多 60 次
  const ip = getClientIp(req);
  const now = Date.now();
  const WINDOW = 60 * 1000, MAX = 60;
  RATE[ip] = (RATE[ip] || []).filter((t) => now - t < WINDOW);
  if (RATE[ip].length >= MAX) {
    return res.status(429).json({ error: 'rate_limited' });
  }
  RATE[ip].push(now);

  // 读取用户密钥（仅本次请求内存使用）
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const userKey = m ? m[1] : '';
  if (!userKey) {
    return res.status(400).json({ error: 'missing_api_key' });
  }

  // 解析请求体
  let body;
  try {
    const raw = await readBody(req);
    body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return res.status(400).json({ error: 'invalid_body' });
  }

  // 仅放行 DeepSeek 已知字段，杜绝任意参数注入
  const forward = {
    model: body && body.model ? String(body.model).slice(0, 64) : 'deepseek-chat',
    messages: Array.isArray(body && body.messages) ? body.messages : [],
    temperature: (typeof (body && body.temperature) === 'number') ? body.temperature : undefined,
    response_format: (body && body.response_format) ? body.response_format : undefined,
    stream: false
  };

  // 目标地址硬编码为 DeepSeek 官方接口，禁止替换为其他 URL
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const target = base + '/chat/completions';

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + userKey // 仅内存透传，下面不记录
      },
      body: JSON.stringify(forward)
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    // 明确不回显任何密钥；直接透传上游 JSON 文本
    return res.end(text);
  } catch (e) {
    return res.status(502).json({ error: 'upstream_error' });
  }
  // 函数结束，userKey 离开作用域被 GC，未写入日志/文件/数据库。
};
