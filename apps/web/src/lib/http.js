import querystring from "node:querystring";

export function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  for (const cookie of cookies.split(";")) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value || "");
    }
  }

  return null;
}

export function readForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolve(querystring.parse(raw));
    });
    req.on("error", reject);
  });
}

export function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
