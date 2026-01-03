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

function looksLikeReactOrTsx(raw: string): boolean {
  const text = String(raw || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes("from 'react'") || lower.includes('from "react"')) return true;
  if (lower.includes('import react') || lower.startsWith('import ')) return true;
  if (lower.includes('export default') || lower.includes('useeffect(') || lower.includes('usestate(')) return true;
  if (text.includes('className=') && text.includes('return (')) return true;
  return false;
}

function extractBareImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  const text = String(source || '');
  const importFrom = /\b(?:import|export)\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g;
  const importOnly = /\bimport\s*['"]([^'"]+)['"]/g;
  const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  const push = (spec: string) => {
    const s = String(spec || '').trim();
    if (!s) return;
    if (s.startsWith('.') || s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return;
    out.add(s);
  };

  let m: RegExpExecArray | null;
  while ((m = importFrom.exec(text))) push(m[1]);
  while ((m = importOnly.exec(text))) push(m[1]);
  while ((m = dynamicImport.exec(text))) push(m[1]);

  return Array.from(out);
}

function buildEsmShUrl(specifier: string): string {
  return `https://esm.sh/${specifier}`;
}

function addEsmShQuery(url: string, params: Record<string, string>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (!q) return url;
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`;
}

function buildReactTsxRunnerSrcDoc(opts: { encodedSource: string; imports: string[] }): string {
  const reactVer = '19.2.3';
  const imports: Record<string, string> = {
    react: buildEsmShUrl(`react@${reactVer}`),
    'react/jsx-runtime': buildEsmShUrl(`react@${reactVer}/jsx-runtime`),
    'react/jsx-dev-runtime': buildEsmShUrl(`react@${reactVer}/jsx-dev-runtime`),
    // Ensure react-dom shares the same React instance (avoid duplicate React copies).
    'react-dom': addEsmShQuery(buildEsmShUrl(`react-dom@${reactVer}`), { external: 'react' }),
    'react-dom/client': addEsmShQuery(buildEsmShUrl(`react-dom@${reactVer}/client`), { external: 'react' })
  };

  for (const spec of opts.imports) {
    if (imports[spec]) continue;
    // Externalize React to force a single React instance across deps (e.g. recharts).
    imports[spec] = addEsmShQuery(buildEsmShUrl(spec), { external: 'react,react-dom,react-dom/client' });
  }

  const importMapJson = JSON.stringify({ imports });
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' https: http: blob:",
    "style-src 'unsafe-inline' https: http: blob:",
    "img-src https: http: data: blob:",
    "font-src https: http: data: blob:",
    'media-src https: http: data: blob:',
    'connect-src https: http: ws: wss:',
    'frame-src https: http:',
    "object-src 'none'",
    "base-uri 'none'"
  ].join('; ');

  // Note: this runner intentionally enables external network imports via esm.sh.
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>html,body{height:100%;margin:0}body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial}#root{min-height:100%}.err{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;background:#111827;color:#fff;border:2px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 12px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:pre-wrap;display:none}</style>',
    `<script type="importmap">${importMapJson}</script>`,
    // Tailwind CDN is optional but improves UX for common className usage.
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    '<div id="err" class="err"></div>',
    '<script>',
    '  (function(){',
    '    var box=document.getElementById("err");',
    '    function show(msg){ try{ box.style.display="block"; box.textContent=String(msg||"").slice(0,20000); }catch(e){} }',
    '    window.addEventListener("error",function(e){ show((e&&e.message?e.message:"Runtime error") + (e&&e.error&&e.error.stack?("\\n"+e.error.stack):"")); });',
    '    window.addEventListener("unhandledrejection",function(e){ var r=e&&e.reason; show("Unhandled promise rejection\\n"+(r&&r.stack?r.stack:String(r))); });',
    '    window.__LPEDIA_SHOW_ERROR__=show;',
    '  })();',
    '</script>',
    '<script type="module">',
    '  function b64ToUtf8(b64){',
    '    const bin=atob(b64);',
    '    const bytes=new Uint8Array(bin.length);',
    '    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);',
    '    return new TextDecoder().decode(bytes);',
    '  }',
    '  const encodedSource=' + JSON.stringify(String(opts.encodedSource || '')) + ';',
    '  const source=b64ToUtf8(encodedSource);',
    '  const hasDefaultExport=/\\bexport\\s+default\\b/.test(source);',
    '  if(!hasDefaultExport){ window.__LPEDIA_SHOW_ERROR__("需要 default export（例如：export default function App() { ... }）"); }',
    '  let compiled="";',
    '  try{',
    '    compiled=Babel.transform(source,{',
    '      filename:"App.tsx",',
    '      sourceFileName:"App.tsx",',
    '      sourceType:"module",',
    '      presets:[["env",{targets:{esmodules:true},modules:false}],["react",{runtime:"classic"}],"typescript"],',
    '    }).code;',
    '  }catch(e){',
    '    window.__LPEDIA_SHOW_ERROR__("編譯失敗\\n"+(e&&e.message?e.message:String(e)));',
    '  }',
    '  if(!compiled){}',
    '  else{',
    '    try{',
    '      const blob=new Blob([compiled],{type:"text/javascript"});',
    '      const url=URL.createObjectURL(blob);',
    '      const mod=await import(url);',
    '      URL.revokeObjectURL(url);',
    '      const App=mod.default;',
    '      if(!App){ window.__LPEDIA_SHOW_ERROR__("找不到 default export（mod.default）"); }',
    '      else{',
    '        const ReactMod=await import("react");',
    '        const React=ReactMod.default||ReactMod;',
    '        const ReactDom=await import("react-dom/client");',
    '        const createRoot=ReactDom.createRoot||(ReactDom.default&&ReactDom.default.createRoot);',
    '        if(!createRoot){ window.__LPEDIA_SHOW_ERROR__("react-dom/client 缺少 createRoot()"); }',
    '        else{',
    '          const root=createRoot(document.getElementById("root"));',
    '          root.render(React.createElement(App));',
    '        }',
    '      }',
    '    }catch(e){',
    '      window.__LPEDIA_SHOW_ERROR__("執行失敗\\n"+(e&&e.stack?e.stack:String(e)));',
    '    }',
    '  }',
    '</script>',
    '</body>',
    '</html>'
  ].join('\n');
}

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
  const isReactLike = useMemo(() => looksLikeReactOrTsx(rawHtml) && !rawHtml.toLowerCase().includes('<html'), [rawHtml]);
  const [tab, setTab] = useState<Tab>(() => (isReactLike ? 'preview' : defaultTab));
  const srcDoc = useMemo(() => buildPreviewSrcDoc(rawHtml), [rawHtml]);
  const tsxRunnerDoc = useMemo(() => {
    if (!isReactLike) return '';
    const imports = extractBareImportSpecifiers(rawHtml);
    return buildReactTsxRunnerSrcDoc({ encodedSource: encodedHtml, imports });
  }, [encodedHtml, isReactLike, rawHtml]);

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
          ) : isReactLike ? (
            <iframe
              key={reloadNonce}
              title="React/TSX Preview"
              sandbox="allow-scripts allow-forms allow-modals"
              referrerPolicy="no-referrer"
              srcDoc={tsxRunnerDoc}
              style={{ width: '100%', height: '100%' }}
              className="block w-full bg-white"
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
