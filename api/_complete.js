// api/_complete.js — one Anthropic Messages call that never hands back a truncated reply (Edge-safe: no node: imports).
// stop_reason "max_tokens" means the reply was cut off. The call is retried ONCE with the next, higher limit in
// `limits`; if that is also cut off the result is { ok: false, truncated: true } and no partial text is returned,
// so callers can never parse or send half an output.
// Time budget: `opts.deadline` (absolute ms) aborts any fetch still running at the deadline ({ ok:false, timeout:true }),
// and the truncation retry is skipped ({ truncated:true, retrySkipped:true }) when fewer than `opts.retryMin` ms remain,
// so a request can never stack a second model call past its plan limit.
// The endpoint URL is passed in by the handler (which has already passed verifyLicense): auth-gate rule - no helper
// module names the Anthropic host itself.
export async function callComplete(url, apiKey, buildBody, limits, opts = {}) {
  const { deadline = Infinity, retryMin = 0 } = opts;
  for (let i = 0; i < limits.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ok: false, timeout: true, err: 'Time budget exhausted before the model call', attempts: i };
    const ctl = new AbortController();
    const timer = Number.isFinite(remaining) ? setTimeout(() => ctl.abort(), remaining) : null;
    let response, data;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(buildBody(limits[i])),
        signal: ctl.signal,
      });
      if (!response.ok) return { ok: false, status: response.status, err: await response.text() };
      data = await response.json();
    } catch (e) {
      if (ctl.signal.aborted) return { ok: false, timeout: true, err: 'Model call exceeded the time budget', attempts: i + 1 };
      throw e;
    } finally { if (timer) clearTimeout(timer); }
    if (data.stop_reason === 'max_tokens') {
      if (i < limits.length - 1) {
        if (deadline - Date.now() >= retryMin) continue;
        return { ok: false, truncated: true, retrySkipped: true, err: 'Model reply was cut off and there was no time left to retry', stop: data.stop_reason, attempts: i + 1 };
      }
      return { ok: false, truncated: true, err: 'Model reply was cut off at the token limit', stop: data.stop_reason, attempts: i + 1 };
    }
    // Extract the text block by type, not by position (adaptive thinking can put a "thinking" block first).
    const text = data.content?.find(b => b.type === 'text')?.text;
    if (!text) return { ok: false, err: `No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`, stop: data.stop_reason };
    return { ok: true, text, stop: data.stop_reason, attempts: i + 1 };
  }
  return { ok: false, err: 'no token limits given' };
}
