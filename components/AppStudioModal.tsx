import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Copy, Folder, FolderPlus, Globe, Loader2, Maximize2, Plus, Save, Send, StopCircle, Terminal, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { authService } from '../services/authService';

type StudioApp = {
  id: string;
  ownerId: string;
  ownerRole: string;
  title: string;
  visibility: 'private' | 'public';
  latestVersionId?: string | null;
  folderId?: string | null;
  updatedAt?: string;
  stats?: { forks?: number; submissions?: number; lastSubmissionAt?: number | null };
  owner?: any;
};

const AppStudioModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [tab, setTab] = useState<'my' | 'public'>('my');
  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string>('all');
  const [folders, setFolders] = useState<any[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [apps, setApps] = useState<StudioApp[]>([]);
  const [publicApps, setPublicApps] = useState<StudioApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState('');
  const [publicSort, setPublicSort] = useState<'popular' | 'updated' | 'forks' | 'submits'>('popular');

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState('');

  const [prompt, setPrompt] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateStage, setGenerateStage] = useState(0);
  const generateStages = useMemo(() => ([
    '讀取需求描述',
    '整理功能與介面',
    '生成 HTML / CSS / JS',
    '安全檢查與整理輸出'
  ]), []);

  const [previewKey, setPreviewKey] = useState(0);
  const [previewStopped, setPreviewStopped] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitTeacherId, setSubmitTeacherId] = useState<string>('');
  const [submitTeacherName, setSubmitTeacherName] = useState<string>('');
  const [showSubmitPicker, setShowSubmitPicker] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showForks, setShowForks] = useState(false);
  const [forks, setForks] = useState<any[]>([]);
  const [loadingForks, setLoadingForks] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [draftNotice, setDraftNotice] = useState<null | { key: string; savedAt: number }>(null);
  const [thumbHtmlByAppId, setThumbHtmlByAppId] = useState<Record<string, string>>({});
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleUnread, setConsoleUnread] = useState(0);
  const [consoleLines, setConsoleLines] = useState<Array<{ id: string; at: number; level: string; message: string }>>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxSubmissions, setInboxSubmissions] = useState<any[]>([]);
  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [loadingMySubmissions, setLoadingMySubmissions] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [reviewHtml, setReviewHtml] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'reviewed'>('pending');
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const templates = useMemo(() => ([
    {
      id: 'typing',
      title: '英文打字遊戲',
      description: '練習打字速度與準確度（WPM、正確率）',
      prompt: '做一個英文打字練習：隨機顯示英文單字，輸入後按 Enter 送出，顯示分數、正確率、WPM。',
      indexHtml: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Typing Game</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f6f7fb; margin:0; padding:24px; color:#1f2937}
  .card{max-width:760px;margin:0 auto;background:#fff;border:3px solid #5E4C40;border-radius:18px;box-shadow:0 10px 0 rgba(0,0,0,.12);padding:18px}
  h1{margin:0 0 10px;font-size:22px}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
  .pill{border:2px solid #e5e7eb;border-radius:999px;padding:8px 12px;font-weight:800;background:#fafafa}
  .word{font-size:40px;font-weight:900;letter-spacing:1px;margin:18px 0;color:#111827}
  input{width:100%;padding:14px 12px;border:2px solid #d1d5db;border-radius:14px;font-size:16px;font-weight:700}
  button{border:3px solid #5E4C40;background:#10b981;color:#fff;font-weight:900;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.15);cursor:pointer}
  button:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.15)}
  .small{font-size:12px;color:#6b7280;font-weight:700}
  .ok{color:#059669;font-weight:900}
  .bad{color:#dc2626;font-weight:900}
</style></head><body>
<div class="card">
  <h1>英文打字遊戲</h1>
  <div class="row">
    <div class="pill">題數：<span id="count">0</span></div>
    <div class="pill">正確：<span id="correct">0</span></div>
    <div class="pill">正確率：<span id="acc">0%</span></div>
    <div class="pill">WPM：<span id="wpm">0</span></div>
  </div>
  <div class="word" id="word">READY</div>
  <input id="inp" placeholder="輸入上面的英文單字，按 Enter…" autocomplete="off" />
  <div class="row">
    <button id="start">開始</button>
    <button id="reset" style="background:#60a5fa">重置</button>
  </div>
  <div class="small" id="msg">提示：輸入後按 Enter 送出。</div>
</div>
<script>
  const WORDS = ("apple banana orange school teacher student music science winter summer happy river mountain friend brave quick slow learn build create").split(/\\s+/);
  const $ = (id)=>document.getElementById(id);
  let startedAt = 0, total=0, correct=0, current="";
  function randWord(){ return WORDS[Math.floor(Math.random()*WORDS.length)] }
  function next(){ current = randWord(); $('word').textContent = current.toUpperCase(); $('inp').value=""; $('inp').focus(); }
  function update(){
    $('count').textContent = total;
    $('correct').textContent = correct;
    const acc = total? Math.round(correct/total*100):0;
    $('acc').textContent = acc+"%";
    const mins = startedAt? (Date.now()-startedAt)/60000 : 0;
    const wpm = mins>0 ? Math.round((correct*1.0)/mins) : 0;
    $('wpm').textContent = isFinite(wpm)? wpm:0;
  }
  function start(){
    if(!startedAt) startedAt = Date.now();
    $('msg').textContent = "開始了！";
    next();
  }
  $('start').onclick = start;
  $('reset').onclick = ()=>{ startedAt=0; total=0; correct=0; $('msg').textContent="已重置"; $('word').textContent="READY"; $('inp').value=""; update(); };
  $('inp').addEventListener('keydown',(e)=>{
    if(e.key!=='Enter') return;
    if(!current){ start(); return; }
    const ans = $('inp').value.trim().toLowerCase();
    total++;
    if(ans===current.toLowerCase()){ correct++; $('msg').innerHTML = '<span class="ok">正確！</span>'; }
    else { $('msg').innerHTML = '<span class="bad">錯誤</span>（答案：'+current+'）'; }
    update();
    next();
  });
  update();
</script></body></html>`
    },
    {
      id: 'timer',
      title: '計時器',
      description: '可設定秒數的倒數計時器',
      prompt: '做一個倒數計時器：可輸入秒數、開始/暫停/重置，時間到提示。',
      indexHtml: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Timer</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto; background:#f6f7fb; margin:0; padding:24px; color:#1f2937}
  .card{max-width:680px;margin:0 auto;background:#fff;border:3px solid #5E4C40;border-radius:18px;box-shadow:0 10px 0 rgba(0,0,0,.12);padding:18px}
  h1{margin:0 0 10px;font-size:22px}
  .time{font-size:56px;font-weight:900;margin:16px 0}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  input{width:180px;padding:12px;border:2px solid #d1d5db;border-radius:14px;font-weight:800}
  button{border:3px solid #5E4C40;background:#10b981;color:#fff;font-weight:900;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.15);cursor:pointer}
  button:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.15)}
  .small{font-size:12px;color:#6b7280;font-weight:700;margin-top:10px}
</style></head><body>
<div class="card">
  <h1>計時器</h1>
  <div class="row">
    <input id="sec" type="number" min="1" value="60" />
    <button id="set" style="background:#60a5fa">設定</button>
    <button id="start">開始</button>
    <button id="pause" style="background:#f59e0b">暫停</button>
    <button id="reset" style="background:#ef4444">重置</button>
  </div>
  <div class="time" id="time">01:00</div>
  <div class="small" id="msg">提示：先設定秒數再開始。</div>
</div>
<script>
  const $=(id)=>document.getElementById(id);
  let total=60, left=60, t=null;
  function fmt(s){ s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60); const r=s%60; return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); }
  function render(){ $('time').textContent=fmt(left); }
  function stop(){ if(t){ clearInterval(t); t=null; } }
  $('set').onclick=()=>{ stop(); total=Math.max(1,Number($('sec').value||60)); left=total; $('msg').textContent='已設定 '+total+' 秒'; render(); };
  $('start').onclick=()=>{ if(t) return; if(left<=0) left=total; $('msg').textContent='進行中…'; t=setInterval(()=>{ left--; render(); if(left<=0){ stop(); $('msg').textContent='時間到！'; try{navigator.vibrate&&navigator.vibrate(200);}catch(e){} } },1000); };
  $('pause').onclick=()=>{ stop(); $('msg').textContent='已暫停'; };
  $('reset').onclick=()=>{ stop(); left=total; $('msg').textContent='已重置'; render(); };
  render();
</script></body></html>`
    },
    {
      id: 'matching',
      title: '配對遊戲',
      description: '翻牌配對（可自訂題目）',
      prompt: '做一個翻牌配對遊戲：共有多張卡片，翻兩張若相同就配對成功，全部完成顯示用時。',
      indexHtml: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matching</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto; background:#f6f7fb; margin:0; padding:18px; color:#1f2937}
  .card{max-width:900px;margin:0 auto;background:#fff;border:3px solid #5E4C40;border-radius:18px;box-shadow:0 10px 0 rgba(0,0,0,.12);padding:14px}
  h1{margin:0 0 10px;font-size:22px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  button{border:3px solid #5E4C40;background:#10b981;color:#fff;font-weight:900;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.15);cursor:pointer}
  button:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.15)}
  .pill{border:2px solid #e5e7eb;border-radius:999px;padding:8px 12px;font-weight:800;background:#fafafa}
  .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
  .tile{height:88px;border:3px solid #5E4C40;border-radius:16px;background:#FEF7EC;color:#5E4C40;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;box-shadow:0 6px 0 rgba(0,0,0,.12)}
  .tile:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.12)}
  .down{background:#fff;border-color:#e5e7eb;color:#9ca3af;box-shadow:none}
  .done{background:#D1FAE5;border-color:#10b981;color:#065f46}
  @media (max-width:600px){ .grid{grid-template-columns:repeat(3,minmax(0,1fr));} .tile{height:76px} }
</style></head><body>
<div class="card">
  <h1>配對遊戲</h1>
  <div class="row">
    <div class="pill">已配對：<span id="done">0</span>/<span id="total">0</span></div>
    <div class="pill">用時：<span id="time">0</span>s</div>
    <button id="reset" style="background:#60a5fa">重新開始</button>
  </div>
  <div class="grid" id="grid"></div>
</div>
<script>
  const PAIRS = ['A','B','C','D','E','F'];
  const $=(id)=>document.getElementById(id);
  let deck=[], first=null, lock=false, done=0, startedAt=0, t=null;
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function render(){
    const g=$('grid'); g.innerHTML='';
    deck.forEach((c,idx)=>{
      const div=document.createElement('div');
      div.className='tile '+(c.state==='down'?'down':c.state==='done'?'done':'');
      div.textContent = c.state==='down' ? '？' : c.value;
      div.onclick=()=>flip(idx);
      g.appendChild(div);
    });
    $('done').textContent=done;
    $('total').textContent=PAIRS.length;
  }
  function tick(){ $('time').textContent = startedAt? Math.floor((Date.now()-startedAt)/1000):0; }
  function startTimer(){ if(startedAt) return; startedAt=Date.now(); t=setInterval(tick,250); }
  function stopTimer(){ if(t){ clearInterval(t); t=null; } }
  function flip(i){
    if(lock) return;
    const c=deck[i];
    if(c.state!=='down') return;
    startTimer();
    c.state='up';
    render();
    if(!first){ first=i; return; }
    const a=deck[first], b=deck[i];
    if(a.value===b.value){
      a.state=b.state='done';
      done++;
      first=null;
      render();
      if(done===PAIRS.length){ stopTimer(); alert('完成！用時 '+$('time').textContent+' 秒'); }
      return;
    }
    lock=true;
    setTimeout(()=>{ a.state='down'; b.state='down'; first=null; lock=false; render(); },650);
  }
  function reset(){
    stopTimer(); startedAt=0; done=0; first=null; lock=false;
    deck = shuffle(PAIRS.concat(PAIRS).map(v=>({value:v,state:'down'})));
    tick(); render();
  }
  $('reset').onclick=reset;
  reset();
</script></body></html>`
    },
    {
      id: 'quiz',
      title: '小測驗',
      description: '簡單多選題小測（本地題庫）',
      prompt: '做一個多選小測驗：每題四選一，選完立即顯示正確與否，最後統計分數。',
      indexHtml: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiz</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto; background:#f6f7fb; margin:0; padding:18px; color:#1f2937}
  .card{max-width:900px;margin:0 auto;background:#fff;border:3px solid #5E4C40;border-radius:18px;box-shadow:0 10px 0 rgba(0,0,0,.12);padding:14px}
  h1{margin:0 0 10px;font-size:22px}
  .pill{border:2px solid #e5e7eb;border-radius:999px;padding:8px 12px;font-weight:800;background:#fafafa;display:inline-block}
  .q{font-size:22px;font-weight:900;margin:14px 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .opt{border:3px solid #5E4C40;border-radius:16px;background:#FEF7EC;color:#5E4C40;font-weight:900;padding:14px;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.12)}
  .opt:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.12)}
  .ok{background:#D1FAE5;border-color:#10b981;color:#065f46}
  .bad{background:#FEE2E2;border-color:#ef4444;color:#991b1b}
  button{border:3px solid #5E4C40;background:#60a5fa;color:#fff;font-weight:900;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.15);cursor:pointer}
  button:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.15)}
  @media (max-width:600px){ .grid{grid-template-columns:1fr;} }
</style></head><body>
<div class="card">
  <h1>小測驗</h1>
  <div class="pill">題目：<span id="idx">1</span>/<span id="total">1</span> • 分數：<span id="score">0</span></div>
  <div class="q" id="q"></div>
  <div class="grid" id="opts"></div>
  <div style="height:12px"></div>
  <button id="next">下一題</button>
</div>
<script>
  const QUESTIONS = [
    {q:'1 + 1 = ?', opts:['1','2','3','4'], a:1},
    {q:'英文字母 A 的下一個是？', opts:['B','C','D','E'], a:0},
    {q:'水的英文是？', opts:['fire','water','wind','earth'], a:1}
  ];
  const $=(id)=>document.getElementById(id);
  let i=0, score=0, locked=false, picked=-1;
  $('total').textContent = QUESTIONS.length;
  function render(){
    const cur=QUESTIONS[i];
    $('idx').textContent = i+1;
    $('score').textContent = score;
    $('q').textContent = cur.q;
    const box=$('opts'); box.innerHTML='';
    cur.opts.forEach((t,idx)=>{
      const div=document.createElement('div');
      div.className='opt';
      div.textContent=t;
      div.onclick=()=>choose(idx);
      box.appendChild(div);
    });
    locked=false; picked=-1;
  }
  function choose(idx){
    if(locked) return;
    locked=true; picked=idx;
    const cur=QUESTIONS[i];
    const nodes=[...$('opts').children];
    nodes.forEach((n,k)=>{
      if(k===cur.a) n.classList.add('ok');
      if(k===idx && idx!==cur.a) n.classList.add('bad');
    });
    if(idx===cur.a) score++;
    $('score').textContent = score;
  }
  $('next').onclick=()=>{
    if(i<QUESTIONS.length-1){ i++; render(); }
    else alert('完成！你的分數：'+score+'/'+QUESTIONS.length);
  };
  render();
</script></body></html>`
    },
    {
      id: 'drawing',
      title: '畫板',
      description: '簡單畫圖工具（筆刷、顏色、清除）',
      prompt: '做一個簡單畫板：可選顏色、筆刷大小、清除、下載圖片。',
      indexHtml: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drawing</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto; background:#f6f7fb; margin:0; padding:18px; color:#1f2937}
  .card{max-width:860px;margin:0 auto;background:#fff;border:3px solid #5E4C40;border-radius:18px;box-shadow:0 10px 0 rgba(0,0,0,.12);padding:14px}
  h1{margin:0 0 10px;font-size:22px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  canvas{width:100%;height:420px;border:2px solid #e5e7eb;border-radius:16px;background:#fff}
  button{border:3px solid #5E4C40;background:#10b981;color:#fff;font-weight:900;border-radius:14px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.15);cursor:pointer}
  button:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.15)}
  input[type=range]{width:160px}
  .small{font-size:12px;color:#6b7280;font-weight:700}
</style></head><body>
<div class="card">
  <h1>畫板</h1>
  <div class="row">
    <label class="small">顏色 <input id="color" type="color" value="#111827"></label>
    <label class="small">粗幼 <input id="size" type="range" min="2" max="30" value="8"></label>
    <button id="clear" style="background:#ef4444">清除</button>
    <button id="download" style="background:#60a5fa">下載 PNG</button>
  </div>
  <div style="height:10px"></div>
  <canvas id="c"></canvas>
</div>
<script>
  const c=document.getElementById('c');
  const ctx=c.getContext('2d');
  function resize(){ const dpr=window.devicePixelRatio||1; const r=c.getBoundingClientRect(); c.width=Math.floor(r.width*dpr); c.height=Math.floor(r.height*dpr); ctx.scale(dpr,dpr); ctx.lineCap='round'; ctx.lineJoin='round'; }
  resize(); window.addEventListener('resize',()=>{ ctx.setTransform(1,0,0,1,0,0); resize(); });
  let down=false, last=null;
  function pos(e){ const r=c.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x,y}; }
  function draw(p){ if(!last) last=p; ctx.strokeStyle=document.getElementById('color').value; ctx.lineWidth=Number(document.getElementById('size').value||8); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; }
  const start=(e)=>{ down=true; last=pos(e); e.preventDefault(); };
  const move=(e)=>{ if(!down) return; draw(pos(e)); e.preventDefault(); };
  const end=()=>{ down=false; last=null; };
  c.addEventListener('mousedown',start); window.addEventListener('mousemove',move); window.addEventListener('mouseup',end);
  c.addEventListener('touchstart',start,{passive:false}); c.addEventListener('touchmove',move,{passive:false}); c.addEventListener('touchend',end);
  document.getElementById('clear').onclick=()=>{ ctx.clearRect(0,0,c.width,c.height); };
  document.getElementById('download').onclick=()=>{ const a=document.createElement('a'); a.download='drawing.png'; a.href=c.toDataURL('image/png'); a.click(); };
</script></body></html>`
    }
  ]), []);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);

  const selectedApp: StudioApp | null = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    return pool.find((a) => a.id === selectedAppId) || null;
  }, [apps, publicApps, selectedAppId, tab]);

  const canEditSelected = Boolean(selectedApp && (selectedApp.ownerId === user?.id || user?.role === 'admin'));

  const loadLists = async () => {
    try {
      setLoadingApps(true);
      setAppsError('');
      const [mine, pub, folderResp] = await Promise.all([
        authService.listAppStudioApps({ scope: 'my', includeStats: true, sort: 'updated' }),
        authService.listAppStudioApps({ scope: 'public', includeStats: true, sort: publicSort })
        , authService.listAppStudioFolders()
      ]);
      setApps(Array.isArray(mine.apps) ? mine.apps : []);
      setPublicApps(Array.isArray(pub.apps) ? pub.apps : []);
      setFolders(Array.isArray(folderResp.folders) ? folderResp.folders : []);
    } catch (e) {
      setAppsError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoadingApps(false);
    }
  };

  const loadAppVersions = async (appId: string) => {
    try {
      setLoadingVersion(true);
      setVersionError('');
      const resp = await authService.listAppStudioVersions(appId);
      const list = Array.isArray(resp.versions) ? resp.versions : [];
      setVersions(list);
      const first = list[0]?.id ? String(list[0].id) : null;
      setSelectedVersionId(first);
      if (first) {
        const v = await authService.getAppStudioVersion(appId, first);
        setGeneratedHtml(String(v.version?.indexHtml || ''));
        setGeneratedTitle(String(v.version?.title || ''));
        setPreviewKey((k) => k + 1);
      }
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoadingVersion(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab('my');
    setSearch('');
    setFolderId('all');
    setPublicSort('popular');
    setSelectedAppId(null);
    setVersions([]);
    setSelectedVersionId(null);
    setPrompt('');
    setGeneratedTitle('');
    setGeneratedHtml('');
    setGenerateError('');
    setSubmittedAt(null);
    setSubmitTeacherId('');
    setSubmitTeacherName('');
    setShowSubmitPicker(false);
    setGenerateStage(0);
    setPreviewStopped(false);
    setPreviewFullscreen(false);
    setDiffOpen(false);
    setDraftNotice(null);
    setThumbHtmlByAppId({});
    setConsoleOpen(false);
    setConsoleUnread(0);
    setConsoleLines([]);
    setShowInbox(false);
    setLoadingInbox(false);
    setInboxSubmissions([]);
    setShowMySubmissions(false);
    setLoadingMySubmissions(false);
    setMySubmissions([]);
    setReviewTarget(null);
    setReviewHtml('');
    setSavingReview(false);
    setShowTemplates(false);
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicSort]);

  const visibleApps = useMemo(() => {
    const pool = tab === 'public' ? publicApps : apps;
    const q = search.trim().toLowerCase();
    return pool.filter((a: any) => {
      if (tab === 'my' && folderId !== 'all') {
        const aFolder = String(a?.folderId || '');
        if (folderId === 'unfiled') {
          if (aFolder) return false;
        } else if (aFolder !== folderId) return false;
      }
      if (!q) return true;
      return String(a.title || '').toLowerCase().includes(q);
    });
  }, [apps, publicApps, search, tab]);

  // Load a few thumbnails for the current list (lightweight: small number, sandboxed iframes)
  useEffect(() => {
    if (!open) return;
    const pool = visibleApps.slice(0, 8);
    let canceled = false;

    const run = async () => {
      for (const a of pool) {
        const appId = String((a as any)?.id || '');
        const versionId = String((a as any)?.latestVersionId || '');
        if (!appId || !versionId) continue;
        if (thumbHtmlByAppId[appId]) continue;
        try {
          const resp = await authService.getAppStudioVersion(appId, versionId);
          const html = String(resp.version?.indexHtml || '');
          if (!html.trim()) continue;
          if (canceled) return;
          setThumbHtmlByAppId((prev) => (prev[appId] ? prev : { ...prev, [appId]: html }));
        } catch {
          // ignore
        }
      }
    };

    run();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, publicSort, folderId, search, visibleApps.length]);

  const draftKey = useMemo(() => {
    const uid = user?.id || 'anon';
    const appId = selectedAppId || 'new';
    return `lpedia_appstudio_draft_${uid}_${appId}`;
  }, [selectedAppId, user?.id]);

  // autosave draft
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const payload = {
        prompt,
        generatedTitle,
        generatedHtml,
        updatedAt: Date.now()
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [draftKey, generatedHtml, generatedTitle, open, prompt]);

  const tryRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed?.updatedAt || 0);
      if (!savedAt) return;
      setDraftNotice({ key: draftKey, savedAt });
    } catch {
      // ignore
    }
  };

  const openApp = async (appId: string) => {
    setSelectedAppId(appId);
    setVersions([]);
    setSelectedVersionId(null);
    setSubmittedAt(null);
    setPreviewStopped(false);
    await loadAppVersions(appId);
    tryRestoreDraft();
  };

  const createNewApp = async () => {
    const title = '新作品';
    const resp = await authService.createAppStudioApp({ title, visibility: 'private' });
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
    }
  };

  const generate = async () => {
    const p = String(prompt || '').trim();
    if (!p) {
      setGenerateError('請輸入你想製作的小程式描述');
      return;
    }
    try {
      setGenerating(true);
      setGenerateStage(0);
      setGenerateError('');
      const resp = await authService.generateAppStudio({ prompt: p });
      setGeneratedTitle(String(resp.title || '小程式'));
      setGeneratedHtml(String(resp.indexHtml || ''));
      setPreviewStopped(false);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!generating) return;
    setGenerateStage(0);
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(i + 1, generateStages.length - 1);
      setGenerateStage(i);
    }, 900);
    return () => window.clearInterval(t);
  }, [generating, generateStages.length, open]);

  const ensureEditableApp = async (): Promise<string | null> => {
    if (selectedAppId && canEditSelected) return selectedAppId;
    if (selectedAppId && !canEditSelected) {
      const resp = await authService.forkAppStudioApp(selectedAppId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
      const app = resp.app;
      if (app?.id) {
        await loadLists();
        setTab('my');
        await openApp(String(app.id));
        return String(app.id);
      }
      return null;
    }
    // no app yet
    const resp = await authService.createAppStudioApp({ title: '新作品', visibility: 'private' });
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
      return String(app.id);
    }
    return null;
  };

  const saveAsVersion = async () => {
    if (!generatedHtml.trim()) return;
    const appId = await ensureEditableApp();
    if (!appId) return;
    if (!generatedHtml.trim()) return;
    const title = String(generatedTitle || selectedApp?.title || '版本').trim();
    const resp = await authService.createAppStudioVersion(appId, {
      title,
      prompt: String(prompt || '').trim(),
      indexHtml: generatedHtml
    });
    const v = resp.version;
    await loadLists();
    await loadAppVersions(appId);
    if (v?.id) setSelectedVersionId(String(v.id));
  };

  const fork = async () => {
    if (!selectedAppId) return;
    const resp = await authService.forkAppStudioApp(selectedAppId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
    const app = resp.app;
    if (app?.id) {
      await loadLists();
      setTab('my');
      await openApp(String(app.id));
    }
  };

  const togglePublic = async () => {
    if (!selectedAppId || !selectedApp) return;
    if (!canEditSelected) return;
    const next = selectedApp.visibility === 'public' ? 'private' : 'public';
    await authService.updateAppStudioApp(selectedAppId, { visibility: next });
    await loadLists();
  };

  const moveToFolder = async (nextFolderId: string) => {
    if (!selectedAppId || !selectedApp) return;
    if (!canEditSelected) return;
    await authService.updateAppStudioApp(selectedAppId, { folderId: nextFolderId === 'unfiled' ? null : nextFolderId });
    await loadLists();
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      if (!generatedHtml.trim()) {
        alert('請先生成或選擇一個作品內容');
        return;
      }

      // Ensure submission is locked to a version snapshot:
      // - If current HTML differs from the selected version, create a new version and submit that versionId.
      // - If the selected app is not editable (public from others), fork first then create a version snapshot.
      let appId = selectedAppId;
      let willFork = false;

      if (!appId) {
        const created = await authService.createAppStudioApp({ title: String(generatedTitle || '新作品'), visibility: 'private' });
        appId = String(created.app?.id || '');
        if (!appId) throw new Error('建立作品失敗');
        setSelectedAppId(appId);
        setTab('my');
      } else if (user?.role === 'student' && !canEditSelected) {
        const forked = await authService.forkAppStudioApp(appId, selectedVersionId ? { versionId: selectedVersionId } : undefined);
        appId = String(forked.app?.id || '');
        if (!appId) throw new Error('Fork 失敗');
        willFork = true;
        setSelectedAppId(appId);
        setTab('my');
      }

      const currentSelectedVersion = versions.find((v) => String(v?.id) === String(selectedVersionId));
      const selectedMatches = Boolean(currentSelectedVersion && String(currentSelectedVersion.indexHtml || '') === String(generatedHtml || ''));
      let versionId = selectedVersionId;

      if (!versionId || !selectedMatches || willFork || appId !== selectedAppId) {
        const snapTitle = String(generatedTitle || selectedApp?.title || '版本').trim() || '版本';
        const createdV = await authService.createAppStudioVersion(appId, {
          title: snapTitle,
          prompt: String(prompt || '').trim(),
          indexHtml: String(generatedHtml || '')
        });
        versionId = String(createdV.version?.id || '');
        if (!versionId) throw new Error('建立版本失敗');
        setSelectedVersionId(versionId);
        // Refresh lists/versions best-effort
        try {
          await loadLists();
          await loadAppVersions(appId);
        } catch {
          // ignore
        }
      }

      const payload: any = { versionId };
      if (submitTeacherId) payload.teacherId = submitTeacherId;
      const resp = await authService.submitAppStudio(appId, payload);
      setSubmittedAt(String(resp.submission?.createdAt || new Date().toISOString()));
    } catch (e) {
      setSubmittedAt(null);
      alert(e instanceof Error ? e.message : '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitPicker = async () => {
    if (user?.role !== 'student') return;
    if (!selectedAppId) return;
    try {
      setLoadingTeachers(true);
      setSubmitTeacherId('');
      setSubmitTeacherName('');
      if (teachers.length === 0) {
        const resp = await authService.listTeachers();
        const list = Array.isArray(resp.users) ? resp.users : [];
        setTeachers(list);
      }
      setShowSubmitPicker(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '載入老師名單失敗');
    } finally {
      setLoadingTeachers(false);
    }
  };

  const openInbox = async () => {
    if (!isTeacher) return;
    try {
      setLoadingInbox(true);
      setShowInbox(true);
      const resp = await authService.listAppStudioInbox();
      setInboxSubmissions(Array.isArray(resp.submissions) ? resp.submissions : []);
    } catch (e) {
      alert(e instanceof Error ? e.message : '載入失敗');
      setShowInbox(false);
    } finally {
      setLoadingInbox(false);
    }
  };

  const openMySubmissions = async () => {
    if (user?.role !== 'student') return;
    try {
      setLoadingMySubmissions(true);
      setShowMySubmissions(true);
      const resp = await authService.listAppStudioMySubmissions();
      setMySubmissions(Array.isArray(resp.submissions) ? resp.submissions : []);
    } catch (e) {
      alert(e instanceof Error ? e.message : '載入失敗');
      setShowMySubmissions(false);
    } finally {
      setLoadingMySubmissions(false);
    }
  };

  const openReview = async (s: any) => {
    try {
      setReviewTarget(s);
      setReviewStatus(s?.status === 'reviewed' ? 'reviewed' : 'pending');
      setReviewRating(typeof s?.rating === 'number' ? Number(s.rating) : null);
      setReviewComment(typeof s?.comment === 'string' ? String(s.comment) : '');
      setReviewHtml('');
      const appId = String(s?.appId || s?.app?.id || '');
      const versionId = String(s?.versionId || '');
      if (appId && versionId) {
        const resp = await authService.getAppStudioVersion(appId, versionId);
        setReviewHtml(String(resp.version?.indexHtml || ''));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '載入版本失敗');
    }
  };

  const copyCode = async () => {
    const text = String(generatedHtml || '');
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const buildPreviewHtml = (html: string, opts?: { appId?: string; versionId?: string; submitEnabled?: boolean }) => {
    const appId = String(opts?.appId ?? selectedAppId ?? '');
    const versionId = String(opts?.versionId ?? selectedVersionId ?? '');
    const submitEnabled = typeof opts?.submitEnabled === 'boolean' ? opts.submitEnabled : true;
    const canSubmit = submitEnabled && Boolean(appId) && user?.role === 'student';
    const injector = `
<style>
  .lpedia-submit-btn{position:fixed;right:14px;bottom:14px;z-index:2147483647;border:3px solid #5E4C40;background:#10B981;color:#fff;font-weight:900;border-radius:16px;padding:10px 14px;box-shadow:0 6px 0 rgba(0,0,0,.2);cursor:pointer}
  .lpedia-submit-btn:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.2)}
</style>
<script>
  (function(){
    try{
      if(!${canSubmit ? 'true' : 'false'}) return;
      var btn=document.createElement('button');
      btn.className='lpedia-submit-btn';
      btn.type='button';
      btn.textContent='提交';
      btn.addEventListener('click',function(){
        try{ parent.postMessage({type:'LPEDIA_APP_SUBMIT', appId:${JSON.stringify(appId)}, versionId:${JSON.stringify(versionId)}}, '*'); }catch(e){}
      });
      document.addEventListener('DOMContentLoaded',function(){ document.body.appendChild(btn); });
      if(document.readyState==='interactive'||document.readyState==='complete'){ document.body.appendChild(btn); }
    }catch(e){}
  })();
</script>`;
    const consoleBridge = `
<script>
  (function(){
    try{
      function safeStr(v){
        try{
          if(typeof v==='string') return v;
          if(v && typeof v==='object') return JSON.stringify(v);
          return String(v);
        }catch(e){ try{return String(v);}catch(_){return '[unserializable]';} }
      }
      function send(level, parts){
        try{
          var msg = (parts||[]).map(safeStr).join(' ');
          if(msg && msg.length>3000) msg = msg.slice(0,3000)+'…';
          parent.postMessage({type:'LPEDIA_APP_CONSOLE', level: String(level||'log'), message: msg, at: Date.now()}, '*');
        }catch(e){}
      }
      ['log','info','warn','error'].forEach(function(k){
        var orig = console[k];
        console[k] = function(){
          try{ send(k, Array.prototype.slice.call(arguments)); }catch(e){}
          try{ return orig && orig.apply(console, arguments); }catch(e){}
        };
      });
      window.addEventListener('error', function(e){
        try{
          send('error', [e && e.message ? e.message : 'error', (e && e.filename ? e.filename : '') + ':' + (e && e.lineno ? e.lineno : '') + ':' + (e && e.colno ? e.colno : ''), e && e.error && e.error.stack ? e.error.stack : '']);
        }catch(_){}
      });
      window.addEventListener('unhandledrejection', function(e){
        try{
          var r = e && e.reason;
          send('error', ['unhandledrejection', r && r.message ? r.message : safeStr(r), r && r.stack ? r.stack : '']);
        }catch(_){}
      });
      send('info', ['preview ready']);
    }catch(e){}
  })();
</script>`;
    const raw = String(html || '');
    const hasConsoleBridge = raw.includes('LPEDIA_APP_CONSOLE');
    const hasSubmitInjector = raw.includes('lpedia-submit-btn');
    const consolePart = hasConsoleBridge ? '' : consoleBridge;
    const submitPart = (!submitEnabled || hasSubmitInjector) ? '' : injector;
    if (raw.includes('</body>')) return raw.replace('</body>', `${consolePart}${submitPart}</body>`);
    return `${raw}${consolePart}${submitPart}`;
  };

  // in-app submit bridge
  useEffect(() => {
    if (!open) return;
    const onMsg = (evt: MessageEvent) => {
      const srcWin = iframeRef.current?.contentWindow;
      const fullWin = fullscreenIframeRef.current?.contentWindow;
      if ((!srcWin && !fullWin) || (evt.source !== srcWin && evt.source !== fullWin)) return;
      const data: any = evt.data;
      if (!data || !data.type) return;
      if (data.type === 'LPEDIA_APP_SUBMIT') {
        if (!selectedAppId) return;
        openSubmitPicker();
        return;
      }
      if (data.type === 'LPEDIA_APP_CONSOLE') {
        const level = String(data.level || 'log');
        const message = String(data.message || '').trim();
        if (!message) return;
        const at = Number(data.at || Date.now());
        const id = `${at}-${Math.random().toString(16).slice(2)}`;
        setConsoleLines((prev) => {
          const next = [...prev, { id, at, level, message }];
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
        if (!consoleOpen) setConsoleUnread((n) => Math.min(99, n + 1));
        if (level === 'error') {
          setConsoleOpen(true);
          setConsoleUnread(0);
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAppId, selectedVersionId, submitting, user?.role, consoleOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-[98vw] h-[96vh] max-w-none max-h-none overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-5 border-b-4 border-brand-brown bg-[#E8F5E9] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown flex items-center justify-center">
              <Code2 className="w-6 h-6 text-brand-brown" />
            </div>
            <div>
              <div className="text-2xl font-black text-brand-brown">小程式工作坊</div>
              <div className="text-xs text-gray-600 font-bold">用 AI 製作可運行的小程式（支援 jsDelivr / unpkg 外部庫）</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-6 h-6 text-brand-brown" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex bg-gray-50">
          <aside className="w-80 border-r-2 border-gray-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setTab('my')}
                className={`flex-1 px-3 py-2 rounded-xl border-2 font-black ${tab === 'my' ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                我的
              </button>
              <button
                type="button"
                onClick={() => setTab('public')}
                className={`flex-1 px-3 py-2 rounded-xl border-2 font-black ${tab === 'public' ? 'bg-[#D2EFFF] border-brand-brown text-brand-brown' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                全站
              </button>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-black text-gray-600 mb-1">搜尋</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋作品..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl"
              />
            </div>

            {tab === 'my' && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-gray-600">資料夾</label>
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="text-xs font-black text-brand-brown underline"
                  >
                    新增
                  </button>
                </div>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                >
                  <option value="all">全部</option>
                  <option value="unfiled">未分類</option>
                  {folders.map((f) => (
                    <option key={String(f.id)} value={String(f.id)}>{String(f.name || '資料夾')}</option>
                  ))}
                </select>
              </div>
            )}
            {tab === 'public' && (
              <div className="mb-3">
                <label className="block text-xs font-black text-gray-600 mb-1">排序</label>
                <select
                  value={publicSort}
                  onChange={(e) => setPublicSort(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                >
                  <option value="popular">最熱門</option>
                  <option value="updated">最新</option>
                  <option value="forks">最多 Fork</option>
                  <option value="submits">最多提交</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <Button
                fullWidth
                className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                onClick={createNewApp}
              >
                <Plus className="w-4 h-4 mr-2" />
                新作品
              </Button>
            </div>

            {appsError && (
              <div className="mb-3 text-sm text-red-600 font-bold">{appsError}</div>
            )}
            {loadingApps ? (
              <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
              </div>
            ) : (
              <div className="space-y-2">
                {visibleApps.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openApp(a.id)}
                    className={`w-full text-left px-3 py-3 rounded-2xl border-2 font-black ${selectedAppId === a.id ? 'bg-[#FEF7EC] border-brand-brown' : 'bg-white border-gray-200 hover:border-brand-brown'}`}
                  >
                    {tab === 'public' && (
                      <div className="mb-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="h-20 overflow-hidden relative">
                          {thumbHtmlByAppId[String(a.id)] ? (
                            <div className="absolute inset-0 origin-top-left" style={{ transform: 'scale(0.25)' }}>
                              <iframe
                                title={`thumb-${a.id}`}
                                sandbox="allow-scripts"
                                className="w-[1200px] h-[600px] bg-white pointer-events-none"
                                srcDoc={thumbHtmlByAppId[String(a.id)]}
                              />
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                              預覽載入中…
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-brand-brown">{a.title || '作品'}</span>
                      {a.visibility === 'public' ? <Globe className="w-4 h-4 text-emerald-700" /> : <Folder className="w-4 h-4 text-gray-500" />}
                    </div>
                    {tab === 'public' && a.owner?.profile?.name && (
                      <div className="text-xs text-gray-500 font-bold mt-1">作者：{String(a.owner.profile.name)}</div>
                    )}
                    {a.stats && (
                      <div className="text-xs text-gray-500 font-bold mt-1">Fork {Number(a.stats.forks || 0)} • 提交 {Number(a.stats.submissions || 0)}</div>
                    )}
                    <div className="text-xs text-gray-500 font-bold mt-1">
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ''}
                    </div>
                  </button>
                ))}
                {visibleApps.length === 0 && (
                  <div className="text-sm text-gray-500 font-bold">沒有作品</div>
                )}
              </div>
            )}

            {selectedAppId && (
              <div className="mt-4 pt-4 border-t-2 border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-black text-gray-700">版本控制</div>
                  <div className="ml-auto text-[11px] text-gray-500 font-bold">
                    {versions.length ? `${versions.length} 個版本` : ''}
                  </div>
                </div>

                {draftNotice && (
                  <div className="text-sm text-brand-brown font-black bg-[#FEF7EC] border-2 border-brand-brown rounded-2xl p-3 mb-2">
                    發現草稿（{new Date(draftNotice.savedAt).toLocaleString()}）
	                    <div className="mt-2 flex gap-2">
	                      <Button
	                        className="flex-1 bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
	                        onClick={() => {
	                          try {
	                            const raw = localStorage.getItem(draftNotice.key);
	                            if (raw) {
                              const parsed = JSON.parse(raw);
                              setPrompt(String(parsed?.prompt || ''));
                              setGeneratedTitle(String(parsed?.generatedTitle || ''));
                              setGeneratedHtml(String(parsed?.generatedHtml || ''));
                              setPreviewStopped(false);
                              setPreviewKey((k) => k + 1);
                            }
                          } catch {
                            // ignore
                          } finally {
                            setDraftNotice(null);
                          }
                        }}
	                      >
	                        恢復
	                      </Button>
	                      <Button
	                        className="flex-1 bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
	                        onClick={() => setDraftNotice(null)}
	                      >
	                        忽略
	                      </Button>
	                    </div>
                  </div>
                )}

                {versionError && <div className="text-sm text-red-600 font-bold mb-2">{versionError}</div>}

                <label className="block text-xs font-black text-gray-600 mb-1">版本</label>
                <select
                  value={selectedVersionId || ''}
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!selectedAppId || !id) return;
                    setSelectedVersionId(id);
                    try {
                      setLoadingVersion(true);
                      const v = await authService.getAppStudioVersion(selectedAppId, id);
                      setGeneratedHtml(String(v.version?.indexHtml || ''));
                      setGeneratedTitle(String(v.version?.title || ''));
                      setPreviewStopped(false);
                      setPreviewKey((k) => k + 1);
                    } catch (err) {
                      setVersionError(err instanceof Error ? err.message : '載入失敗');
                    } finally {
                      setLoadingVersion(false);
                    }
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                  disabled={!selectedAppId || loadingVersion}
                >
                  <option value="">（未選擇）</option>
                  {versions.map((v) => (
                    <option key={String(v.id)} value={String(v.id)}>
                      {String(v.title || '版本')} • {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                    </option>
                  ))}
                </select>

                {loadingVersion && (
                  <div className="mt-2 text-sm text-gray-500 font-bold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 載入版本中...
                  </div>
                )}

                <div className="mt-2">
                  <Button
                    fullWidth
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={() => setDiffOpen(true)}
                    disabled={!selectedAppId || !selectedVersionId}
                  >
                    版本差異
                  </Button>
                </div>

                {tab === 'my' && canEditSelected && selectedAppId && (
                  <div className="mt-2">
                    <label className="block text-xs font-black text-gray-600 mb-1">放入資料夾</label>
                    <select
                      value={String(selectedApp?.folderId || 'unfiled')}
                      onChange={(e) => moveToFolder(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                    >
                      <option value="unfiled">未分類</option>
                      {folders.map((f) => (
                        <option key={String(f.id)} value={String(f.id)}>{String(f.name || '資料夾')}</option>
                      ))}
                    </select>
                  </div>
                )}

                {canEditSelected && selectedAppId && selectedVersionId && (
                  <div className="mt-2">
                    <Button
                      fullWidth
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId || !selectedVersionId) return;
                        const v = versions.find((x) => String(x.id) === String(selectedVersionId));
                        if (!v?.indexHtml) {
                          try {
                            const resp = await authService.getAppStudioVersion(selectedAppId, selectedVersionId);
                            v.indexHtml = resp.version?.indexHtml;
                          } catch {
                            // ignore
                          }
                        }
                        if (!confirm('回退會建立一個新版本並設為最新版本，確定？')) return;
                        try {
                          await authService.createAppStudioVersion(selectedAppId, {
                            title: `${String(v?.title || selectedApp?.title || '')}（回退）`,
                            prompt: 'rollback',
                            indexHtml: String(v?.indexHtml || generatedHtml || '')
                          });
                          await loadAppVersions(selectedAppId);
                          await loadLists();
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '回退失敗');
                        }
                      }}
                    >
                      回退到此版本
                    </Button>
                  </div>
                )}
              </div>
            )}
          </aside>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-4 border-b-2 border-gray-200 bg-white flex flex-wrap items-center gap-2">
              <div className="font-black text-brand-brown flex-1">
                {selectedApp ? selectedApp.title : '未選擇作品'}
              </div>
              {selectedApp && (
                <>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={() => setPreviewKey((k) => k + 1)}
                  >
                    重新執行
                  </Button>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={() => setPreviewStopped(true)}
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    停止
                  </Button>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={copyCode}
                    disabled={!generatedHtml.trim()}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    複製程式
                  </Button>
                  <Button
                    className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                    onClick={fork}
                    disabled={!selectedAppId}
                  >
                    Fork
                  </Button>
                  {isTeacher && canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        try {
                          setLoadingForks(true);
                          setShowForks(true);
                          const resp = await authService.listAppStudioForks(selectedAppId);
                          setForks(Array.isArray(resp.forks) ? resp.forks : []);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '載入失敗');
                        } finally {
                          setLoadingForks(false);
                        }
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      查看副本
                    </Button>
                  )}
                  {canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={togglePublic}
                    >
                      {selectedApp.visibility === 'public' ? '設為私人' : '設為公開'}
                    </Button>
                  )}
                  {isTeacher && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={openInbox}
                      disabled={loadingInbox}
                    >
                      作品箱
                    </Button>
                  )}
                  {user?.role === 'student' && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={openMySubmissions}
                      disabled={loadingMySubmissions}
                    >
                      我的提交
                    </Button>
                  )}
                  {user?.role === 'student' && (
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={openSubmitPicker}
                      disabled={submitting || !selectedAppId || loadingTeachers}
                    >
                      <Send className={`w-4 h-4 mr-2 ${submitting ? 'animate-pulse' : ''}`} />
                      提交
                    </Button>
                  )}
                  {isTeacher && canEditSelected && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        try {
                          setLoadingSubmissions(true);
                          setShowSubmissions(true);
                          const resp = await authService.listAppStudioSubmissions(selectedAppId);
                          setSubmissions(Array.isArray(resp.submissions) ? resp.submissions : []);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '載入失敗');
                        } finally {
                          setLoadingSubmissions(false);
                        }
                      }}
                    >
                      查看提交
                    </Button>
                  )}
                  {isTeacher && selectedApp && (selectedApp.visibility === 'public' || canEditSelected) && (
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-red-300 text-red-700"
                      onClick={async () => {
                        if (!selectedAppId) return;
                        const isOwner = selectedApp?.ownerId === user?.id;
                        const msg = isOwner
                          ? '確定要刪除這個作品？（版本與提交記錄會一併刪除）'
                          : '你正在刪除其他人已公開的作品（版本與提交記錄會一併刪除），確定？';
                        if (!confirm(msg)) return;
                        try {
                          await authService.deleteAppStudioApp(selectedAppId);
                          setSelectedAppId(null);
                          setVersions([]);
                          setSelectedVersionId(null);
                          setGeneratedHtml('');
                          setGeneratedTitle('');
                          setPrompt('');
                          setSubmittedAt(null);
                          await loadLists();
                        } catch (e) {
                          alert(e instanceof Error ? e.message : '刪除失敗');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除作品
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-4 p-4">
              <div className="flex-1 min-h-0 flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-3 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                  <div className="font-black text-gray-700">預覽</div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConsoleOpen((v) => !v);
                        setConsoleUnread(0);
                      }}
                      className={`h-9 px-3 rounded-full bg-white border-2 flex items-center gap-2 font-black text-sm ${consoleOpen ? 'border-brand-brown text-brand-brown' : 'border-gray-200 text-gray-600 hover:border-brand-brown'}`}
                      aria-label="控制台"
                      title="控制台"
                    >
                      <Terminal className="w-4 h-4" />
                      控制台{consoleUnread ? `（${consoleUnread}）` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFullscreen(true)}
                      disabled={!generatedHtml.trim()}
                      className={`w-9 h-9 rounded-full bg-white border-2 flex items-center justify-center ${generatedHtml.trim() ? 'border-brand-brown hover:bg-gray-100' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
                      aria-label="全螢幕"
                      title="全螢幕"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <div className="text-xs text-gray-500 font-bold hidden sm:block">iframe sandbox</div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 bg-black/5 flex">
                  <div className="flex-1 min-h-0">
                  {previewStopped ? (
                    <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                      已停止（按「重新執行」再次載入）
                    </div>
                  ) : generatedHtml.trim() ? (
                    <iframe
                      key={previewKey}
                      ref={iframeRef}
                      title="app-preview"
                      sandbox="allow-scripts"
                      className="w-full h-full bg-white"
                      srcDoc={buildPreviewHtml(generatedHtml)}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                      生成後會在這裡預覽
                    </div>
                  )}
                  </div>

                  {consoleOpen && (
                    <div className="w-[360px] border-l-2 border-gray-200 bg-white flex flex-col min-h-0">
                      <div className="p-2 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
                        <div className="font-black text-gray-700 text-sm">錯誤控制台</div>
                        <button
                          type="button"
                          onClick={() => setConsoleLines([])}
                          className="ml-auto text-xs font-black text-brand-brown underline"
                        >
                          清空
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 text-xs">
                        {consoleLines.length === 0 ? (
                          <div className="text-gray-500 font-bold p-2">沒有訊息</div>
                        ) : (
                          consoleLines.map((l) => (
                            <div
                              key={l.id}
                              className={`p-2 rounded-xl border ${l.level === 'error' ? 'border-red-300 bg-red-50 text-red-800' : l.level === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-800'}`}
                            >
                              <div className="font-black mb-1">
                                {l.level.toUpperCase()} • {new Date(l.at).toLocaleTimeString()}
                              </div>
                              <pre className="whitespace-pre-wrap break-words font-mono">{l.message}</pre>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[210px] min-h-[180px] max-h-[270px] flex flex-col bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-3 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                  <div className="font-black text-gray-700">需求描述</div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={() => setShowTemplates(true)}
                    >
                      模板
                    </Button>
                    <Button
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={generate}
                      disabled={generating}
                    >
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      生成
                    </Button>
                    <Button
                      className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                      onClick={saveAsVersion}
                      disabled={!generatedHtml.trim()}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {canEditSelected ? '儲存版本' : 'Fork 並儲存'}
                    </Button>
                  </div>
                </div>
                <div className="p-3 flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例如：做一個可以輸入英文單字、按下開始後每 5 秒顯示一個提示的練習小工具..."
                    className="w-full h-20 resize-none px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
                  />
                  {generating && (
                    <div className="text-sm text-gray-700 font-bold bg-[#F7FAFF] border-2 border-[#BBD7FF] rounded-2xl p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <div className="font-black text-blue-700">AI 生成中</div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-700">
                        {generateStages.map((s, idx) => (
                          <div key={s} className={idx === generateStage ? 'text-blue-700 font-black' : 'text-gray-600'}>
                            {idx + 1}. {s}{idx === generateStage ? '…' : ''}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-gray-500 font-bold">
                        提示：為安全原因，這裡只顯示生成進度，不展示模型內部推理細節。
                      </div>
                    </div>
                  )}
                  {generateError && <div className="text-sm text-red-600 font-bold">{generateError}</div>}
                  {submittedAt && (
                    <div className="text-sm text-emerald-700 font-black">
                      {submitTeacherName ? `已提交給 ${submitTeacherName}：` : '已提交：'}
                      {new Date(submittedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isTeacher && selectedAppId && (
              <div className="p-4 border-t-2 border-gray-200 bg-white">
                <div className="text-xs text-gray-500 font-bold">
                  提示：作品以「按提交」作完成記錄；公開作品可被全站 fork。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {creatingFolder && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border-4 border-brand-brown shadow-comic-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderPlus className="w-5 h-5 text-brand-brown" />
              <div className="text-xl font-black text-brand-brown">新增資料夾</div>
              <button
                type="button"
                onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="資料夾名稱"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
            />
            <div className="mt-4 flex gap-2">
              <Button
                fullWidth
                className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
              >
                取消
              </Button>
              <Button
                fullWidth
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={async () => {
                  const name = String(newFolderName || '').trim();
                  if (!name) return;
                  try {
                    await authService.createAppStudioFolder({ name });
                    setCreatingFolder(false);
                    setNewFolderName('');
                    await loadLists();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '新增失敗');
                  }
                }}
              >
                新增
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSubmissions && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">提交記錄</div>
              <button
                type="button"
                onClick={() => setShowSubmissions(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingSubmissions ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有提交</div>
              ) : (
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-black text-gray-700">學生</th>
                        <th className="text-left p-3 font-black text-gray-700">班別</th>
                        <th className="text-left p-3 font-black text-gray-700">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr key={String(s.id)} className="border-t border-gray-200">
                          <td className="p-3 font-bold text-gray-800">
                            {String(s.user?.profile?.name || s.user?.username || s.userId || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {String(s.user?.profile?.class || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForks && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#FEF7EC] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">作品副本（Fork）</div>
              <button
                type="button"
                onClick={() => setShowForks(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingForks ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : forks.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有副本</div>
              ) : (
                <div className="space-y-2">
                  {forks.map((f) => (
                    <div key={String(f.id)} className="bg-white border-2 border-gray-200 rounded-2xl p-3">
                      <div className="font-black text-brand-brown">{String(f.title || '')}</div>
                      <div className="text-xs text-gray-600 font-bold mt-1">
                        由 {String(f.owner?.profile?.name || f.owner?.username || f.ownerId)} 建立 • {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showInbox && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#FEF7EC] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">作品箱</div>
              <button
                type="button"
                onClick={() => setShowInbox(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingInbox ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : inboxSubmissions.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有提交</div>
              ) : (
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-black text-gray-700">狀態</th>
                        <th className="text-left p-3 font-black text-gray-700">學生</th>
                        <th className="text-left p-3 font-black text-gray-700">班別</th>
                        <th className="text-left p-3 font-black text-gray-700">作品</th>
                        <th className="text-left p-3 font-black text-gray-700">時間</th>
                        <th className="text-left p-3 font-black text-gray-700">評分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inboxSubmissions.map((s) => (
                        <tr
                          key={String(s.id)}
                          className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                          onClick={() => openReview(s)}
                        >
                          <td className="p-3 font-black">
                            {s.status === 'reviewed' ? <span className="text-emerald-700">已看過</span> : <span className="text-amber-700">待批改</span>}
                          </td>
                          <td className="p-3 font-bold text-gray-800">
                            {String(s.user?.profile?.name || s.user?.username || s.userId || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {String(s.user?.profile?.class || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {String(s.app?.title || '')}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                          </td>
                          <td className="p-3 font-bold text-gray-600">
                            {typeof s.rating === 'number' ? `${s.rating}/5` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t-2 border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">提示：點擊一列可查看作品並填寫評語與星等。</div>
            </div>
          </div>
        </div>
      )}

      {showMySubmissions && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">我的提交</div>
              <button
                type="button"
                onClick={() => setShowMySubmissions(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingMySubmissions ? (
                <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                </div>
              ) : mySubmissions.length === 0 ? (
                <div className="text-sm text-gray-500 font-bold">未有提交</div>
              ) : (
                <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-black text-gray-700">老師</th>
                        <th className="text-left p-3 font-black text-gray-700">作品</th>
                        <th className="text-left p-3 font-black text-gray-700">時間</th>
                        <th className="text-left p-3 font-black text-gray-700">狀態</th>
                        <th className="text-left p-3 font-black text-gray-700">評分</th>
                        <th className="text-left p-3 font-black text-gray-700">評語</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissions.map((s) => (
                        <tr
                          key={String(s.id)}
                          className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                          onClick={() => openReview(s)}
                        >
                          <td className="p-3 font-bold text-gray-800">{String(s.targetTeacher?.profile?.name || s.targetTeacher?.username || '')}</td>
                          <td className="p-3 font-bold text-gray-600">{String(s.app?.title || '')}</td>
                          <td className="p-3 font-bold text-gray-600">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</td>
                          <td className="p-3 font-black">
                            {s.status === 'reviewed' ? <span className="text-emerald-700">已看過</span> : <span className="text-amber-700">待批改</span>}
                          </td>
                          <td className="p-3 font-bold text-gray-600">{typeof s.rating === 'number' ? `${s.rating}/5` : '—'}</td>
                          <td className="p-3 font-bold text-gray-600">{String(s.comment || '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t-2 border-gray-200 bg-white">
              <div className="text-xs text-gray-500 font-bold">提示：點擊一列可預覽你提交的版本。</div>
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-[98vw] h-[92vh] max-w-none max-h-none overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#E8F5E9] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">提交檢視</div>
              <div className="ml-2 text-xs text-gray-600 font-bold">
                {String(reviewTarget?.user?.profile?.name || reviewTarget?.user?.username || '')}
                {reviewTarget?.user?.profile?.class ? ` • ${String(reviewTarget.user.profile.class)}` : ''}
                {reviewTarget?.app?.title ? ` • ${String(reviewTarget.app.title)}` : ''}
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-h-0 bg-black/5">
                {reviewHtml.trim() ? (
                  <iframe
                    title="submission-preview"
                    sandbox="allow-scripts"
                    className="w-full h-full bg-white"
                    srcDoc={buildPreviewHtml(reviewHtml, { appId: String(reviewTarget?.appId || reviewTarget?.app?.id || ''), versionId: String(reviewTarget?.versionId || ''), submitEnabled: false })}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                    載入中…
                  </div>
                )}
              </div>
              <div className="w-[420px] border-l-2 border-gray-200 bg-white flex flex-col min-h-0">
                <div className="p-4 border-b-2 border-gray-200 bg-gray-50 font-black text-gray-700">回饋</div>
                <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                  <div className="text-xs font-black text-gray-600 mb-1">狀態</div>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as any)}
                    disabled={!isTeacher}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
                  >
                    <option value="pending">待批改</option>
                    <option value="reviewed">已看過</option>
                  </select>

                  <div className="mt-3 text-xs font-black text-gray-600 mb-1">星等（1–5）</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!isTeacher}
                        onClick={() => setReviewRating(n)}
                        className={`flex-1 py-2 rounded-xl border-2 font-black ${reviewRating === n ? 'bg-[#FDEEAD] border-brand-brown text-brand-brown' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-brown'}`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!isTeacher}
                      onClick={() => setReviewRating(null)}
                      className="px-3 py-2 rounded-xl border-2 font-black bg-white border-gray-200 text-gray-700 hover:border-brand-brown"
                    >
                      清除
                    </button>
                  </div>

                  <div className="mt-3 text-xs font-black text-gray-600 mb-1">評語</div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    disabled={!isTeacher}
                    className="w-full h-28 resize-none px-3 py-2 border-2 border-gray-300 rounded-xl font-bold"
                    placeholder={isTeacher ? '輸入評語…' : '（老師尚未留下評語）'}
                  />

                  {isTeacher && (
                    <div className="mt-4">
                      <Button
                        fullWidth
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={async () => {
                          if (!reviewTarget) return;
                          try {
                            setSavingReview(true);
                            const resp = await authService.reviewAppStudioSubmission(String(reviewTarget.id), {
                              status: reviewStatus,
                              rating: reviewRating,
                              comment: reviewComment
                            });
                            const updated = resp.submission;
                            setInboxSubmissions((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? { ...x, ...updated } : x)));
                            setMySubmissions((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? { ...x, ...updated } : x)));
                            setReviewTarget((prev) => (prev ? { ...prev, ...updated } : prev));
                            alert('已儲存');
                          } catch (e) {
                            alert(e instanceof Error ? e.message : '儲存失敗');
                          } finally {
                            setSavingReview(false);
                          }
                        }}
                        disabled={savingReview}
                      >
                        儲存回饋
                      </Button>
                    </div>
                  )}
                  {!isTeacher && (
                    <div className="mt-4 text-xs text-gray-500 font-bold">
                      {reviewTarget?.status === 'reviewed' ? '老師已看過你的作品。' : '老師尚未批改。'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">模板庫</div>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="font-black text-brand-brown text-lg">{t.title}</div>
                    <div className="ml-auto">
                      <Button
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => {
                          setPrompt(String(t.prompt || ''));
                          setGeneratedTitle(String(t.title || '小程式'));
                          setGeneratedHtml(String(t.indexHtml || ''));
                          setGenerateError('');
                          setPreviewStopped(false);
                          setPreviewKey((k) => k + 1);
                          setShowTemplates(false);
                        }}
                      >
                        使用此模板
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 font-bold">{t.description}</div>
                </div>
              ))}
              <div className="text-xs text-gray-500 font-bold">
                提示：模板可直接預覽與儲存版本；也可以在需求描述中改寫後再用 AI 生成。
              </div>
            </div>
          </div>
        </div>
      )}

      {showSubmitPicker && user?.role === 'student' && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border-4 border-brand-brown shadow-comic-xl overflow-hidden">
            <div className="p-4 border-b-4 border-brand-brown bg-[#E8F5E9] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">選擇提交老師</div>
              <button
                type="button"
                onClick={() => setShowSubmitPicker(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-xs font-black text-gray-600 mb-1">提交給</label>
              <select
                value={submitTeacherId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSubmitTeacherId(id);
                  const t = teachers.find((x) => String(x?.id) === String(id));
                  setSubmitTeacherName(String(t?.profile?.name || t?.username || ''));
                }}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl bg-white font-bold"
              >
                <option value="">請選擇老師</option>
                {teachers.map((t) => (
                  <option key={String(t.id)} value={String(t.id)}>
                    {String(t.profile?.name || t.username || '')}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex gap-2">
                <Button
                  fullWidth
                  className="bg-white hover:bg-gray-50 border-2 border-brand-brown text-brand-brown"
                  onClick={() => setShowSubmitPicker(false)}
                >
                  取消
                </Button>
                <Button
                  fullWidth
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={async () => {
                    if (!submitTeacherId) {
                      alert('請先選擇老師');
                      return;
                    }
                    setShowSubmitPicker(false);
                    await submit();
                  }}
                  disabled={submitting}
                >
                  確認提交
                </Button>
              </div>
              <div className="mt-3 text-xs text-gray-500 font-bold">
                提示：提交後老師會看到你的提交記錄；你也可以先 fork 再修改。
              </div>
            </div>
          </div>
        </div>
      )}

      {diffOpen && selectedAppId && selectedVersionId && (
        <DiffModal
          onClose={() => setDiffOpen(false)}
          versions={versions}
          selectedVersionId={selectedVersionId}
          appId={selectedAppId}
        />
      )}

      {previewFullscreen && (
        <div className="fixed inset-0 z-[94] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white w-[98vw] h-[96vh] max-w-none max-h-none overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
            <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
              <div className="text-xl font-black text-brand-brown">預覽（全螢幕）</div>
              <button
                type="button"
                onClick={() => setPreviewFullscreen(false)}
                className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-brand-brown" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-black/5">
              {previewStopped ? (
                <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                  已停止（按「重新執行」再次載入）
                </div>
              ) : generatedHtml.trim() ? (
                <iframe
                  key={`full-${previewKey}`}
                  ref={fullscreenIframeRef}
                  title="app-preview-fullscreen"
                  sandbox="allow-scripts"
                  className="w-full h-full bg-white"
                  srcDoc={buildPreviewHtml(generatedHtml)}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                  生成後會在這裡預覽
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppStudioModal;

const computeDiffSummary = (a: string, b: string) => {
  const aLines = String(a || '').split('\n');
  const bLines = String(b || '').split('\n');
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  let added = 0;
  let removed = 0;
  for (const line of bSet) if (!aSet.has(line)) added++;
  for (const line of aSet) if (!bSet.has(line)) removed++;
  return { aLines: aLines.length, bLines: bLines.length, added, removed };
};

const DiffModal: React.FC<{
  onClose: () => void;
  versions: any[];
  selectedVersionId: string;
  appId: string;
}> = ({ onClose, versions, selectedVersionId, appId }) => {
  const idx = versions.findIndex((v) => String(v.id) === String(selectedVersionId));
  const cur = versions[idx] || null;
  const prev = idx >= 0 ? (versions[idx + 1] || null) : null;
  const [curHtml, setCurHtml] = useState<string>(String(cur?.indexHtml || ''));
  const [prevHtml, setPrevHtml] = useState<string>(String(prev?.indexHtml || ''));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (cur && !curHtml) {
          const resp = await authService.getAppStudioVersion(appId, String(cur.id));
          setCurHtml(String(resp.version?.indexHtml || ''));
        }
        if (prev && !prevHtml) {
          const resp = await authService.getAppStudioVersion(appId, String(prev.id));
          setPrevHtml(String(resp.version?.indexHtml || ''));
        }
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, selectedVersionId]);

  const summary = useMemo(() => computeDiffSummary(prevHtml, curHtml), [curHtml, prevHtml]);

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[85vh] overflow-hidden rounded-3xl border-4 border-brand-brown shadow-comic-xl flex flex-col">
        <div className="p-4 border-b-4 border-brand-brown bg-[#D2EFFF] flex items-center gap-2">
          <div className="text-xl font-black text-brand-brown">版本差異</div>
          <div className="ml-3 text-xs text-gray-600 font-bold">
            {loading ? '載入中…' : `行數 ${summary.aLines} → ${summary.bLines} • 新增行(粗略) ${summary.added} • 刪除行(粗略) ${summary.removed}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-9 h-9 rounded-full bg-white border-2 border-brand-brown hover:bg-gray-100 flex items-center justify-center"
            aria-label="關閉"
          >
            <X className="w-5 h-5 text-brand-brown" />
          </button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 overflow-y-auto">
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b-2 border-gray-200 bg-gray-50 font-black text-gray-700">上一版本</div>
            <pre className="flex-1 min-h-0 overflow-auto p-3 text-xs bg-white">{prevHtml || '（沒有上一版本）'}</pre>
          </div>
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b-2 border-gray-200 bg-gray-50 font-black text-gray-700">目前版本</div>
            <pre className="flex-1 min-h-0 overflow-auto p-3 text-xs bg-white">{curHtml || ''}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
