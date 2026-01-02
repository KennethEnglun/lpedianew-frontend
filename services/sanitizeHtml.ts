const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's',
  'p', 'br', 'div', 'span',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'a', 'img', 'font',
  'input'
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  font: new Set(['size', 'color', 'face']),
  div: new Set(['data-lpedia-html-preview', 'data-lpedia-html']),
  pre: new Set(['data-lpedia-html-preview', 'data-lpedia-html']),
  code: new Set(['data-lpedia-html-preview', 'data-lpedia-html']),
  input: new Set(['type', 'value', 'data-lpedia-html-preview-chunk'])
};

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'margin',
  'margin-left',
  'margin-right',
  'margin-top',
  'margin-bottom',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'max-width',
  'width',
  'height',
  'display'
]);

function sanitizeStyle(styleText: string): string {
  const declarations = styleText.split(';');
  const safe: string[] = [];

  for (const decl of declarations) {
    const [rawProp, ...rest] = decl.split(':');
    if (!rawProp || rest.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;

    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('url(') || lowerValue.includes('expression') || lowerValue.includes('javascript:')) {
      continue;
    }

    safe.push(`${prop}: ${value}`);
  }

  return safe.join('; ');
}

function isSafeUrl(urlText: string, forImage: boolean): boolean {
  const value = urlText.trim();
  if (!value) return false;

  // allow relative / anchor links
  if (value.startsWith('#') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    return true;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol === 'http:' || protocol === 'https:') return true;
    if (!forImage && (protocol === 'mailto:' || protocol === 'tel:')) return true;
    if (forImage && protocol === 'data:' && /^data:image\//i.test(value)) return true;

    return false;
  } catch {
    return false;
  }
}

// 基本 HTML 白名單清理，避免 XSS
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const elements = Array.from(doc.body.querySelectorAll('*')).reverse();

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      } else {
        el.remove();
      }
      continue;
    }

    const allowedAttrs = ALLOWED_ATTRS[tag] || new Set<string>();
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const safeStyle = sanitizeStyle(value);
        if (safeStyle) {
          el.setAttribute('style', safeStyle);
        } else {
          el.removeAttribute('style');
        }
        continue;
      }

      if (tag === 'a' && name === 'href') {
        if (!isSafeUrl(value, false)) {
          el.removeAttribute('href');
        }
        continue;
      }

      if (tag === 'img' && name === 'src') {
        if (!isSafeUrl(value, true)) {
          el.removeAttribute('src');
        }
        continue;
      }

      if (!allowedAttrs.has(name)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === 'input') {
      // Only allow hidden inputs (used to store executable HTML preview payload chunks).
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (type !== 'hidden') {
        el.setAttribute('type', 'hidden');
      }
      // Remove potentially interactive attributes if any slipped through.
      el.removeAttribute('name');
      el.removeAttribute('id');
      el.removeAttribute('class');
      el.removeAttribute('autocomplete');
      el.removeAttribute('placeholder');
      el.removeAttribute('checked');
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.removeAttribute('required');
    }

    if (tag === 'a') {
      const target = el.getAttribute('target');
      if (target === '_blank') {
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  return doc.body.innerHTML;
}
