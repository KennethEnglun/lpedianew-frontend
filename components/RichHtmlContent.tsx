import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { sanitizeHtml } from '../services/sanitizeHtml';
import ExecutableHtmlPreview from './ExecutableHtmlPreview';
import { LPEDIA_HTML_PREVIEW_ATTR, LPEDIA_HTML_PREVIEW_CODE_PREFIX, LPEDIA_HTML_PREVIEW_HTML_ATTR } from '../services/htmlPreview';

const rootsByMount = new WeakMap<Element, Root>();

function extractEncodedHtml(placeholder: Element): string | null {
  const fromAttr = placeholder.getAttribute(LPEDIA_HTML_PREVIEW_HTML_ATTR);
  if (fromAttr) return fromAttr;

  const code = placeholder.querySelector('code');
  const text = (code?.textContent || '').trim();
  if (text.startsWith(LPEDIA_HTML_PREVIEW_CODE_PREFIX)) {
    const encoded = text.slice(LPEDIA_HTML_PREVIEW_CODE_PREFIX.length).trim();
    return encoded || null;
  }

  return null;
}

export default function RichHtmlContent({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mounts: Element[] = [];
    const placeholders: Element[] = Array.from(
      container.querySelectorAll(`[${LPEDIA_HTML_PREVIEW_ATTR}="1"]`)
    );

    // Fallback: older content might have had the data-* marker stripped,
    // but still contains the embedded payload in a <code> text node.
    const fallbackPlaceholders = Array.from(container.querySelectorAll('code'))
      .map((code) => {
        const text = (code.textContent || '').trim();
        if (!text.startsWith(LPEDIA_HTML_PREVIEW_CODE_PREFIX)) return null;
        const wrapper = code.closest('div');
        if (!wrapper) return null;
        if (!wrapper.textContent?.includes('HTML 可執行預覽')) return null;
        return wrapper;
      })
      .filter(Boolean) as Element[];

    for (const el of fallbackPlaceholders) {
      if (!placeholders.includes(el)) placeholders.push(el);
    }

    for (const placeholder of placeholders) {
      const encoded = extractEncodedHtml(placeholder);
      if (!encoded) continue;

      const mount = document.createElement('div');
      const parent = placeholder.parentNode;
      if (!parent) continue;
      parent.replaceChild(mount, placeholder);
      mounts.push(mount);

      const root = createRoot(mount);
      rootsByMount.set(mount, root);
      root.render(<ExecutableHtmlPreview encodedHtml={encoded} />);
    }

    return () => {
      for (const mount of mounts) {
        const root = rootsByMount.get(mount);
        if (root) {
          root.unmount();
          rootsByMount.delete(mount);
        }
      }
    };
  }, [safeHtml]);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
