export function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export function redirect(res, location, headers = {}) {
  res.writeHead(302, {
    Location: location,
    ...headers
  });
  res.end();
}
