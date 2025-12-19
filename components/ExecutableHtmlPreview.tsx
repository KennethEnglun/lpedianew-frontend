import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewSrcDoc, decodeBase64ToUtf8 } from '../services/htmlPreview';

type Tab = 'preview' | 'code';

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

  const rawHtml = useMemo(() => {
    try {
      return decodeBase64ToUtf8(encodedHtml);
    } catch {
      return '';
    }
  }, [encodedHtml]);

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

  if (!rawHtml) {
    return (
      <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">
        HTML 預覽內容解析失敗（可能是格式不正確或內容過大）。
      </div>
    );
  }

  const tabButtonBase =
    'px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-brand-brown transition-colors';

  return (
    <div ref={containerRef} className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
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

      {tab === 'code' ? (
        <pre className="p-4 text-xs overflow-auto bg-gray-900 text-gray-100 whitespace-pre">
          <code>{rawHtml}</code>
        </pre>
      ) : (
        <div className="bg-black">
          {shouldLoad ? (
            <iframe
              key={reloadNonce}
              title="Executable HTML Preview"
              sandbox="allow-scripts allow-forms allow-modals"
              referrerPolicy="no-referrer"
              srcDoc={srcDoc}
              style={{ width: '100%', height }}
              className="block w-full"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full flex items-center justify-center text-sm text-gray-200"
              style={{ height }}
            >
              預覽載入中…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

