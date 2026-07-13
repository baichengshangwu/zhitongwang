/**
 * Cloudflare Worker - 双站故障自动切换
 * 部署到 Cloudflare Workers 后，绑定自定义域名即可
 * 
 * 使用前修改 PRIMARY 和 SECONDARY 为你的实际部署地址
 */

const PRIMARY = 'https://你的项目.vercel.app';   // 主站 Vercel
const SECONDARY = 'https://你的项目.netlify.app'; // 备用 Netlify

const TIMEOUT = 8000; // 8秒超时

async function fetchWithTimeout(url, request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 健康检查端点直接返回 OK
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // 1. 尝试主站
    const primaryUrl = PRIMARY + url.pathname + url.search;
    let response = await fetchWithTimeout(primaryUrl, request);
    
    if (response && response.status < 500) {
      return response;
    }
    
    // 2. 主站故障，切换到备用站
    const secondaryUrl = SECONDARY + url.pathname + url.search;
    response = await fetchWithTimeout(secondaryUrl, request);
    
    if (response && response.status < 500) {
      // 添加响应头，让前端知道当前在使用备用站
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Backup-Active', 'true');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }
    
    // 3. 双站均故障
    return new Response('Service temporarily unavailable. Please try again later.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
