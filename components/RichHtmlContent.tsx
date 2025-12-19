import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { sanitizeHtml } from '../services/sanitizeHtml';
import ExecutableHtmlPreview from './ExecutableHtmlPreview';
import { LPEDIA_HTML_PREVIEW_ATTR, LPEDIA_HTML_PREVIEW_HTML_ATTR } from '../services/htmlPreview';

const rootsByMount = new WeakMap<Element, Root>();

export default function RichHtmlContent({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mounts: Element[] = [];
    const placeholders = Array.from(
      container.querySelectorAll(`[${LPEDIA_HTML_PREVIEW_ATTR}="1"]`)
    );

    for (const placeholder of placeholders) {
      const encoded = placeholder.getAttribute(LPEDIA_HTML_PREVIEW_HTML_ATTR);
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
