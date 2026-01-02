import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildPreviewSrcDoc, decodeBase64ToUtf8 } from '../services/htmlPreview';

type Tab = 'preview' | 'code';

type ExtractedIframe = {
  src: string;
  title?: string;
  allow?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
};

function extractEmbeddableIframe(rawHtml: string): ExtractedIframe | null {
  if (typeof DOMParser === 'undefined') return null;
  const trimmed = String(rawHtml || '').trim();
  if (!trimmed) return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(trimmed, 'text/html');
  } catch {
    return null;
  }

  const iframes = Array.from(doc.querySelectorAll('iframe'));
  if (iframes.length !== 1) return null;
  if (doc.querySelectorAll('script').length > 0) return null;

  const iframe = iframes[0];
  const src = String(iframe.getAttribute('src') || '').trim();
  if (!src) return null;
  if (!/^https?:\/\//i.test(src)) return null;

  const visibleText = String(doc.body?.textContent || '').replace(/\s+/g, '').trim();
  if (visibleText) return null;

  const allow = String(iframe.getAttribute('allow') || '').trim() || undefined;
  const title = String(iframe.getAttribute('title') || '').trim() || undefined;
  const rp = String(iframe.getAttribute('referrerpolicy') || '').trim().toLowerCase();
  const referrerPolicy = (rp || undefined) as React.HTMLAttributeReferrerPolicy | undefined;

  return { src, title, allow, referrerPolicy };
}

export default function ExecutableHtmlPreview({
  encodedHtml,
  defaultTab = 'preview',
  height = 520
}: {
  encodedHtml: string;
  defaultTab?: Tab;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rawHtml = useMemo(() => {
    try {
      return decodeBase64ToUtf8(encodedHtml);
    } catch {
      return '';
    }
  }, [encodedHtml]);

  const extractedIframe = useMemo(() => extractEmbeddableIframe(rawHtml), [rawHtml]);
  const srcDoc = useMemo(() => buildPreviewSrcDoc(rawHtml), [rawHtml]);

  useEffect(() => {
    if (tab !== 'preview') return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            return;
          }
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [tab]);

  useEffect(() => {
    if (!isFullscreen) return;
    setShouldLoad(true);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  if (!rawHtml) {
    return (
      <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">
        HTML 預覽內容解析失敗（可能是格式不正確或內容過大）。
      </div>
    );
  }

  const tabButtonBase =
    'px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-brand-brown transition-colors';

  const renderTopBar = (fullscreen: boolean) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${tabButtonBase} ${tab === 'preview' ? 'bg-[#A1D9AE] text-white' : 'bg-white text-brand-brown'}`}
          onClick={() => setTab('preview')}
        >
          預覽
        </button>
        <button
          type="button"
          className={`${tabButtonBase} ${tab === 'code' ? 'bg-[#A1D9AE] text-white' : 'bg-white text-brand-brown'}`}
          onClick={() => setTab('code')}
        >
          程式碼
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-gray-300 bg-white hover:bg-gray-100"
          onClick={() => setIsFullscreen(!fullscreen)}
          title={fullscreen ? '退出全螢幕' : '全螢幕'}
        >
          {fullscreen ? '退出全螢幕' : '全螢幕'}
        </button>

        {tab === 'preview' && (
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-gray-300 bg-white hover:bg-gray-100"
            onClick={() => {
              setShouldLoad(true);
              setReloadNonce((n) => n + 1);
            }}
            title="重新載入"
          >
            重新載入
          </button>
        )}
      </div>
    </div>
  );

  const renderBody = (bodyHeight: number | string) => {
    if (tab === 'code') {
      return (
        <pre className="p-4 text-xs overflow-auto bg-gray-900 text-gray-100 whitespace-pre">
          <code>{rawHtml}</code>
        </pre>
      );
    }

    return (
      <div className="bg-black" style={{ height: bodyHeight }}>
        {shouldLoad ? (
          extractedIframe ? (
            <iframe
              key={reloadNonce}
              title={extractedIframe.title || 'Embedded Preview'}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation"
              referrerPolicy={extractedIframe.referrerPolicy || 'strict-origin-when-cross-origin'}
              src={extractedIframe.src}
              allow={
                extractedIframe.allow ||
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
              }
              allowFullScreen
              style={{ width: '100%', height: '100%' }}
              className="block w-full"
              loading="lazy"
            />
          ) : (
            <iframe
              key={reloadNonce}
              title="Executable HTML Preview"
              sandbox="allow-scripts allow-forms allow-modals"
              referrerPolicy="no-referrer"
              srcDoc={srcDoc}
              style={{ width: '100%', height: '100%' }}
              className="block w-full"
              loading="lazy"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-200">
            預覽載入中…
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div ref={containerRef} className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
        {renderTopBar(false)}
        {renderBody(height)}
      </div>

      {isFullscreen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 p-2 md:p-6">
            <div className="h-full w-full bg-white rounded-2xl overflow-hidden border-4 border-brand-brown shadow-comic flex flex-col">
              {renderTopBar(true)}
              <div className="flex-1 min-h-0">{renderBody('100%')}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
