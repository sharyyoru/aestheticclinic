function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getRequestBaseUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const protocol =
    forwardedProto || requestUrl.protocol.replace(":", "") || (host.includes("localhost") ? "http" : "https");

  return trimTrailingSlash(`${protocol}://${host}`);
}

export function getAppBaseUrl(request?: Request) {
  if (request) {
    return getRequestBaseUrl(request);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    return `https://${trimTrailingSlash(process.env.VERCEL_URL)}`;
  }

  return "http://localhost:3000";
}
