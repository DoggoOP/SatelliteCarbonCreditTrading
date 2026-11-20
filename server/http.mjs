export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function fetchJson(url, options = {}, timeoutMs = 28000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const detail =
        body && typeof body === "object"
          ? body.detail || body.message || body.error
          : typeof body === "string"
            ? body.slice(0, 240)
            : "";
      throw new ApiError(
        502,
        "UPSTREAM",
        `Satellite service returned ${res.status}${detail ? `: ${detail}` : ""}.`,
      );
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") {
      throw new ApiError(
        504,
        "TIMEOUT",
        "A satellite request timed out. Try a smaller area, or run the analysis again.",
      );
    }
    throw new ApiError(
      502,
      "UPSTREAM",
      "Could not reach the satellite data service. Check the network and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        out[index] = { ok: true, value: await fn(items[index], index) };
      } catch (error) {
        out[index] = { ok: false, error };
      }
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError(504, "TIMEOUT", message));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
