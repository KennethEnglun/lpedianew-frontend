import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { sanitizeHtml } from '../services/sanitizeHtml';
import ExecutableHtmlPreview from './ExecutableHtmlPreview';
import { LPEDIA_HTML_PREVIEW_ATTR, LPEDIA_HTML_PREVIEW_CHUNK_ATTR, LPEDIA_HTML_PREVIEW_CODE_PREFIX, LPEDIA_HTML_PREVIEW_HTML_ATTR } from '../services/htmlPreview';

const rootsByMount = new WeakMap<Element, Root>();

function extractEncodedHtmlFromChunks(placeholder: Element): string | null {
  const inputs = Array.from(placeholder.querySelectorAll(`input[${LPEDIA_HTML_PREVIEW_CHUNK_ATTR}]`));
  if (inputs.length === 0) return null;

  const chunks: { index: number; total: number; value: string }[] = [];
  for (const input of inputs) {
    const spec = (input.getAttribute(LPEDIA_HTML_PREVIEW_CHUNK_ATTR) || '').trim();
    const value = input.getAttribute('value') || '';
    const m = spec.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) continue;
    const index = Number(m[1]);
    const total = Number(m[2]);
    if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0 || index <= 0 || index > total) continue;
    chunks.push({ index, total, value });
  }

  if (chunks.length === 0) return null;
  const total = Math.max(...chunks.map((c) => c.total));
  const byIndex = new Map<number, string>();
  for (const c of chunks) {
    if (c.total !== total) continue;
    byIndex.set(c.index, c.value);
  }

  if (byIndex.size !== total) return null;
  const ordered = [];
  for (let i = 1; i <= total; i++) {
    const v = byIndex.get(i);
    if (!v) return null;
    ordered.push(v);
  }
  return ordered.join('');
}

function extractEncodedHtml(placeholder: Element): string | null {
  const fromAttr = placeholder.getAttribute(LPEDIA_HTML_PREVIEW_HTML_ATTR);
  if (fromAttr) return fromAttr;

  const fromChunks = extractEncodedHtmlFromChunks(placeholder);
  if (fromChunks) return fromChunks;

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

    // Fallback: payload stored in hidden <input> chunks.
    const chunkPlaceholders = Array.from(container.querySelectorAll(`input[${LPEDIA_HTML_PREVIEW_CHUNK_ATTR}]`))
      .map((input) => input.closest('div'))
      .filter(Boolean) as Element[];

    for (const el of fallbackPlaceholders) {
      if (!placeholders.includes(el)) placeholders.push(el);
    }
    for (const el of chunkPlaceholders) {
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
