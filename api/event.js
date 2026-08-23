// Vercel Serverless Function: /api/event.js
// 接收前端行为埋点，做严格参数过滤后写入 Supabase product_events 表。
// 安全约束（已落地）：
// 1. 一旦请求体出现 api-key / token / secret / 模板内容 / 报告内容 等敏感字段，直接丢弃并拒绝写入。
// 2. Supabase service_role 密钥仅从 Vercel 环境变量读取，绝不暴露给前端，绝不提交到代码仓库。
// 3. 仅接受白名单事件类型，payload 仅保留白名单字段，字符串截断，杜绝采集隐私数据。

const EVENT_WHITELIST = new Set([
  'page_view', 'search_trigger', 'search_success', 'search_fail',
  'click_advanced_config', 'template_edit_trigger', 'click_export_pdf',
  'click_export_html', 'history_item_click', 'api_settings_save'
]);

// 命中即视为敏感，丢弃整条
const FORBIDDEN_KEY = /(api[_-]?key|token|secret|password|template|prompt|report|config|advanced|content|fulltext|raw|messages)/i;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) { resolve(req.body); return; }
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
  });
}

// 递归检查对象/数组的“键”是否命中敏感词（不检查值，值由 strip 进一步截断/剔除）
function containsForbiddenKey(obj) {
  if (Array.isArray(obj)) return obj.some(containsForbiddenKey);
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (FORBIDDEN_KEY.test(k)) return true;
      if (containsForbiddenKey(obj[k])) return true;
    }
  }
  return false;
}

// 只保留白名单键 + 字符串截断 + 剔除敏感键（纵深防御）
const PAYLOAD_WHITELIST = new Set([
  'query_digest', 'analysis_mode', 'model_name', 'duration_ms', 'error_type', 'is_default'
]);
function sanitizePayload(payload) {
  const out = {};
  if (payload && typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      if (FORBIDDEN_KEY.test(k)) continue;            // 兜底剔除敏感键
      if (!PAYLOAD_WHITELIST.has(k)) continue;        // 仅保留已知安全字段
      const v = payload[k];
      out[k] = (typeof v === 'string') ? v.slice(0, 120) : v;
    }
  }
  return out;
}

function getClientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || 'unknown';
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowedList = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const isVercel = origin.endsWith('.vercel.app');
  const allowedOrigin = (origin && (allowedList.includes(origin) || isVercel)) ? origin : null;

  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!allowedOrigin) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');

  let payload;
  try {
    const raw = await readBody(req);
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return res.status(400).json({ error: 'invalid_json' });
  }

  // 安全闸门：请求体任何层级出现敏感键 -> 拒绝写入
  if (containsForbiddenKey(payload)) {
    return res.status(400).json({ error: 'rejected_sensitive_field' });
  }

  const event = payload && payload.event;
  if (!EVENT_WHITELIST.has(event)) {
    return res.status(400).json({ error: 'unknown_event' });
  }

  const row = {
    event: event,
    payload: sanitizePayload(payload.payload || {}),
    origin: origin || null,
    ua: (req.headers['user-agent'] || '').slice(0, 300),
    ip: getClientIp(req)
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 未配置 Supabase 时静默丢弃，不影响前端体验（不报错、不落库）
  if (!supabaseUrl || !serviceRole) {
    return res.status(200).json({ ok: true, stored: false });
  }

  try {
    const r = await fetch(supabaseUrl.replace(/\/+$/, '') + '/rest/v1/product_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRole,                 // service_role，仅服务端使用
        'Authorization': 'Bearer ' + serviceRole,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      return res.status(200).json({ ok: false, stored: false });
    }
    return res.status(200).json({ ok: true, stored: true });
  } catch (e) {
    return res.status(200).json({ ok: false, stored: false });
  }
};
