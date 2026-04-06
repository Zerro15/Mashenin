export function createApiClient(apiBaseUrl) {
  async function apiFetch(path, options = {}, sessionToken) {
    const headers = { ...(options.headers || {}) };

    if (sessionToken) {
      headers["x-session-token"] = sessionToken;
    }

    return fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  }

  async function proxyJson(res, path, fallback, sessionToken, options = {}) {
    try {
      const response = await apiFetch(path, options, sessionToken);
      const payload = await response.text();
      res.writeHead(response.status, { "content-type": "application/json; charset=utf-8" });
      res.end(payload);
    } catch {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(fallback));
    }
  }

  return {
    apiFetch,
    proxyJson
  };
}
