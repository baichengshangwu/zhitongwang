const PRIMARY = 'https://baichengshangwu.github.io/zhitongwang/';
const SECONDARY = 'https://your-site.netlify.app/';
const TIMEOUT = 8000;

async function fetchWithTimeout(url, request) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, TIMEOUT);
  try {
    const init = {};
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.method = request.method;
      init.headers = request.headers;
      init.body = request.body;
    }
    const response = await fetch(url, Object.assign(init, { signal: controller.signal }));
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  var url = new URL(request.url);

  if (url.pathname === '/health') {
    return new Response('OK', { status: 200 });
  }

  var primaryUrl = PRIMARY + url.pathname.slice(1) + url.search;
  var response = await fetchWithTimeout(primaryUrl, request);

  if (response && response.status < 500) {
    return response;
  }

  var secondaryUrl = SECONDARY + url.pathname.slice(1) + url.search;
  response = await fetchWithTimeout(secondaryUrl, request);

  if (response && response.status < 500) {
    var newHeaders = new Headers(response.headers);
    newHeaders.set('X-Backup-Active', 'true');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  return new Response('Service temporarily unavailable.', { status: 503 });
}
