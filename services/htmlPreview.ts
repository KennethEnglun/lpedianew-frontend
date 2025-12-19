export const LPEDIA_HTML_PREVIEW_ATTR = 'data-lpedia-html-preview';
export const LPEDIA_HTML_PREVIEW_HTML_ATTR = 'data-lpedia-html';
export const MAX_LPEDIA_HTML_PREVIEW_CHARS = 300_000;

export function looksLikeExecutableHtml(input: string): boolean {
  const text = (input || '').trim().toLowerCase();
  if (!text) return false;
  if (text.length < 60) return false;

  if (text.startsWith('<!doctype html')) return true;
  if (text.includes('<html')) return true;
  if (text.includes('<head')) return true;
  if (text.includes('<body')) return true;
  if (text.includes('<script')) return true;
  if (text.includes('<style')) return true;

  return false;
}

export function encodeUtf8ToBase64(text: string): string {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  // Fallback for older browsers.
  return btoa(unescape(encodeURIComponent(text)));
}

export function decodeBase64ToUtf8(encoded: string): string {
  const binary = atob(encoded);

  if (typeof TextDecoder !== 'undefined') {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // Fallback for older browsers.
  return decodeURIComponent(escape(binary));
}

export function buildHtmlPreviewPlaceholder(rawHtml: string): string {
  if (rawHtml.length > MAX_LPEDIA_HTML_PREVIEW_CHARS) {
    throw new Error('HTML too large for preview');
  }
  const encoded = encodeUtf8ToBase64(rawHtml);
  return [
    `<div ${LPEDIA_HTML_PREVIEW_ATTR}="1" ${LPEDIA_HTML_PREVIEW_HTML_ATTR}="${encoded}"`,
    'style="border: 2px dashed #94a3b8; padding: 12px; border-radius: 12px; background-color: #f8fafc;">',
    '<div style="font-weight: 800; margin-bottom: 4px;">HTML 可執行預覽</div>',
    '<div style="font-size: 12px; color: #64748b;">此區塊會在討論串中以 iframe 方式執行（允許外部資源與網路連線）。</div>',
    '</div>',
    '<div><br></div>'
  ].join('');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function injectCspIntoHtml(rawHtml: string, csp: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`;

  if (/<head\b[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n${meta}`);
  }

  if (/<html\b[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>\n${meta}\n</head>`);
  }

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    meta,
    '</head>',
    '<body>',
    rawHtml,
    '</body>',
    '</html>'
  ].join('\n');
}

export function buildPreviewSrcDoc(rawHtml: string): string {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https: http: blob:",
    "style-src 'unsafe-inline' https: http: blob:",
    "img-src https: http: data: blob:",
    "font-src https: http: data: blob:",
    'media-src https: http: data: blob:',
    'connect-src https: http: ws: wss:',
    'frame-src https: http:',
    "object-src 'none'",
    "base-uri 'none'"
  ].join('; ');

  return injectCspIntoHtml(rawHtml, csp);
}
