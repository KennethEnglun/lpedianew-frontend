import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, Hand, Maximize2, RefreshCw, Save, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import Chart from 'chart.js/auto';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { compareStudentsByStudentId } from '../utils/studentSort';

type RoleMode = 'student' | 'teacher';

type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'mixed';
type MixedType = 'double-bar' | 'double-line' | 'line-bar';

type DataRow = {
  label: string;
  value1: string;
  value2: string;
  color: string;
};

export type ChartSpec = {
  chartType: ChartType;
  mixedType?: MixedType;
  title: string;
  xLabel: string;
  yLabel: string;
  yLabel2: string;
  autoScaleY: boolean;
  yMin: string;
  yMax: string;
  showLegend: boolean;
  showAnimation: boolean;
  showGrid: boolean;
  rows: DataRow[];
};

type ChartRecord = {
  id: string;
  title: string;
  folderId: string | null;
  folderSnapshot: any | null;
  chartSpec: ChartSpec;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mode: RoleMode;
};

const palette = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const ensureRows = (rows: DataRow[]) => {
  const normalized = (rows || []).map((r) => ({
    label: String(r?.label || ''),
    value1: String(r?.value1 ?? ''),
    value2: String(r?.value2 ?? ''),
    color: String(r?.color || '').trim() || '#3498db'
  }));
  return normalized.length > 0 ? normalized : [{ label: '項目1', value1: '10', value2: '', color: palette[0] }];
};

const sanitizeRows = (rows: DataRow[]) => {
  const cleaned = ensureRows(rows)
    .map((r) => ({
      label: String(r?.label || '').trim(),
      value1: String(r?.value1 ?? '').trim(),
      value2: String(r?.value2 ?? '').trim(),
      color: String(r?.color || '').trim() || '#3498db'
    }))
    .filter((r) => r.label);
  return cleaned.length > 0 ? cleaned : [{ label: '項目1', value1: '10', value2: '', color: palette[0] }];
};

const parseNumber = (s: string) => {
  const n = Number(String(s || '').trim());
  return Number.isFinite(n) ? n : null;
};

const alpha = (hex: string, a: number) => {
  const h = String(hex || '').trim().replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1)})`;
};

const buildChartConfig = (spec: ChartSpec) => {
  const rows = sanitizeRows(spec.rows);
  const labels = rows.map((r) => r.label);
  const values1 = rows.map((r) => parseNumber(r.value1) ?? 0);
  const values2 = rows.map((r) => parseNumber(r.value2) ?? 0);
  const colors = rows.map((r) => r.color || '#3498db');

  const hasAxes = spec.chartType === 'bar' || spec.chartType === 'line' || spec.chartType === 'mixed';
  const title = String(spec.title || '').trim();
  const xLabel = String(spec.xLabel || '').trim();
  const yLabel = String(spec.yLabel || '').trim();
  const yLabel2 = String(spec.yLabel2 || '').trim();

  const yMin = spec.autoScaleY ? undefined : (parseNumber(spec.yMin) ?? undefined);
  const yMax = spec.autoScaleY ? undefined : (parseNumber(spec.yMax) ?? undefined);

  const backgroundAndBorderPlugin: any = {
    id: 'lpSparkBackgroundBorder',
    beforeDraw(chart: any) {
      const ctx = chart?.ctx;
      if (!ctx) return;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
    afterDraw(chart: any) {
      const ctx = chart?.ctx;
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = '#E6D2B5';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, chart.width - 16, chart.height - 16);
      ctx.restore();
    }
  };

  const commonOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: 2,
    animation: spec.showAnimation ? undefined : false,
    plugins: {
      legend: { display: !!spec.showLegend },
      title: title
        ? { display: true, text: title, color: '#5E4C40', font: { size: 20, weight: '800' as any } }
        : { display: false }
    },
    layout: { padding: { top: title ? 10 : 0, left: 10, right: 10, bottom: 10 } }
  };

  const grid = spec.showGrid;
  const scales: any = hasAxes
    ? {
        x: {
          grid: { display: grid },
          title: xLabel ? { display: true, text: xLabel, color: '#5E4C40', font: { size: 14, weight: '800' as any } } : { display: false }
        },
        y: {
          grid: { display: grid },
          min: yMin,
          max: yMax,
          title: yLabel ? { display: true, text: yLabel, color: '#5E4C40', font: { size: 14, weight: '800' as any } } : { display: false }
        }
      }
    : undefined;

  if (spec.chartType === 'bar') {
    return {
      type: 'bar' as const,
      data: {
        labels,
        datasets: [
          {
            label: yLabel || '數值',
            data: values1,
            backgroundColor: colors.map((c) => alpha(c, 0.6)),
            borderColor: colors,
            borderWidth: 2
          }
        ]
      },
      options: { ...commonOptions, scales },
      plugins: [backgroundAndBorderPlugin]
    };
  }

  if (spec.chartType === 'line') {
    return {
      type: 'line' as const,
      data: {
        labels,
        datasets: [
          {
            label: yLabel || '數值',
            data: values1,
            borderColor: colors[0] || '#3498db',
            backgroundColor: alpha(colors[0] || '#3498db', 0.15),
            pointBackgroundColor: colors[0] || '#3498db',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            borderWidth: 3,
            tension: 0.25
          }
        ]
      },
      options: { ...commonOptions, scales },
      plugins: [backgroundAndBorderPlugin]
    };
  }

  if (spec.chartType === 'pie' || spec.chartType === 'doughnut' || spec.chartType === 'polarArea') {
    const t = spec.chartType;
    return {
      type: t as any,
      data: {
        labels,
        datasets: [
          {
            label: yLabel || '數值',
            data: values1,
            backgroundColor: colors.map((c) => alpha(c, 0.7)),
            borderColor: '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: commonOptions,
      plugins: [backgroundAndBorderPlugin]
    };
  }

  if (spec.chartType === 'radar') {
    const c = colors[0] || '#3498db';
    return {
      type: 'radar' as const,
      data: {
        labels,
        datasets: [
          {
            label: yLabel || '數值',
            data: values1,
            borderColor: c,
            backgroundColor: alpha(c, 0.2),
            pointBackgroundColor: c,
            borderWidth: 3
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          r: {
            grid: { display: grid },
            min: yMin,
            max: yMax,
            pointLabels: { color: '#5E4C40', font: { size: 12, weight: '800' as any } }
          }
        }
      },
      plugins: [backgroundAndBorderPlugin]
    };
  }

  // mixed
  const mixedType = spec.mixedType || 'line-bar';
  const ds1Color = colors[0] || '#3498db';
  const ds2Color = colors[1] || '#e74c3c';

  const ds1 = (() => {
    if (mixedType === 'double-line') {
      return {
        type: 'line' as const,
        label: yLabel || '數值1',
        data: values1,
        borderColor: ds1Color,
        backgroundColor: alpha(ds1Color, 0.15),
        borderWidth: 3,
        tension: 0.25
      };
    }
    // bar
    return {
      type: 'bar' as const,
      label: yLabel || '數值1',
      data: values1,
      backgroundColor: alpha(ds1Color, 0.6),
      borderColor: ds1Color,
      borderWidth: 2
    };
  })();

  const ds2 = (() => {
    if (mixedType === 'double-bar') {
      return {
        type: 'bar' as const,
        label: yLabel2 || '數值2',
        data: values2,
        backgroundColor: alpha(ds2Color, 0.6),
        borderColor: ds2Color,
        borderWidth: 2
      };
    }
    if (mixedType === 'double-line') {
      return {
        type: 'line' as const,
        label: yLabel2 || '數值2',
        data: values2,
        borderColor: ds2Color,
        backgroundColor: alpha(ds2Color, 0.15),
        borderWidth: 3,
        tension: 0.25
      };
    }
    // line-bar: second is line
    return {
      type: 'line' as const,
      label: yLabel2 || '數值2',
      data: values2,
      borderColor: ds2Color,
      backgroundColor: alpha(ds2Color, 0.15),
      borderWidth: 3,
      tension: 0.25
    };
  })();

  return {
    type: 'bar' as const,
    data: { labels, datasets: [ds1, ds2] },
    options: { ...commonOptions, scales },
    plugins: [backgroundAndBorderPlugin]
  };
};

const defaultSpec = (): ChartSpec => ({
  chartType: 'bar',
  mixedType: 'line-bar',
  title: '我的圖表',
  xLabel: '類別',
  yLabel: '數值',
  yLabel2: '數值2',
  autoScaleY: true,
  yMin: '',
  yMax: '',
  showLegend: true,
  showAnimation: true,
  showGrid: true,
  rows: [
    { label: '一月', value1: '120', value2: '80', color: palette[0] },
    { label: '二月', value1: '190', value2: '140', color: palette[1] },
    { label: '三月', value1: '300', value2: '250', color: palette[2] },
    { label: '四月', value1: '500', value2: '430', color: palette[3] },
    { label: '五月', value1: '200', value2: '160', color: palette[4] }
  ]
});

const getFolderPathText = (snapshot: any | null) => {
  const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
  const names = path.map((p: any) => String(p?.name || '').trim()).filter(Boolean);
  const tail = names.join(' / ');
  const grade = String(snapshot?.grade || '').trim();
  if (grade && tail) return `${grade}年級 / ${tail}`;
  if (grade) return `${grade}年級`;
  return tail;
};

export const ChartGeneratorModal: React.FC<Props> = ({ open, onClose, mode }) => {
  const { user } = useAuth();
  const isTeacher = mode === 'teacher';

  const [tab, setTab] = useState<'create' | 'library' | 'students'>(isTeacher ? 'create' : 'create');
  const [spec, setSpec] = useState<ChartSpec>(() => defaultSpec());
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenChartRef = useRef<any>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Zoom / pan for preview container (LP Spark style similar to mindmap)
  const [previewScale, setPreviewScale] = useState(1);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [previewDragging, setPreviewDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Student folders (class folders)
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState('');
  const [classFolders, setClassFolders] = useState<any[]>([]);
  const [saveStageId, setSaveStageId] = useState('');
  const [saveTopicId, setSaveTopicId] = useState('');
  const [saveSubfolderId, setSaveSubfolderId] = useState('');
  const [filterStageId, setFilterStageId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');

  // Teacher private folders (library folders)
  const teacherGradeOptions = useMemo(() => ['1', '2', '3', '4', '5', '6'], []);
  const [teacherSaveGrade, setTeacherSaveGrade] = useState('1');
  const [teacherFolders, setTeacherFolders] = useState<any[]>([]);
  const [teacherSaveFolderId, setTeacherSaveFolderId] = useState<string | null>(null);

  // Save / list
  const [saving, setSaving] = useState(false);
  const [myChartsLoading, setMyChartsLoading] = useState(false);
  const [myChartsError, setMyChartsError] = useState('');
  const [myCharts, setMyCharts] = useState<ChartRecord[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);

  // Teacher: student charts
  const [students, setStudents] = useState<any[]>([]);
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentChartsLoading, setStudentChartsLoading] = useState(false);
  const [studentChartsError, setStudentChartsError] = useState('');
  const [studentCharts, setStudentCharts] = useState<ChartRecord[]>([]);
  const [selectedStudentChartId, setSelectedStudentChartId] = useState<string | null>(null);

  const stageFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 1 && !f.archivedAt), [classFolders]);
  const topicFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 2 && !f.archivedAt && String(f.parentId || '') === String(saveStageId || '')), [classFolders, saveStageId]);
  const subFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 3 && !f.archivedAt && String(f.parentId || '') === String(saveTopicId || '')), [classFolders, saveTopicId]);
  const filterTopicFolders = useMemo(() => classFolders.filter((f: any) => f && Number(f.level) === 2 && !f.archivedAt && String(f.parentId || '') === String(filterStageId || '')), [classFolders, filterStageId]);

  const teacherFolderTree = useMemo(() => {
    const byParent = new Map<string | null, any[]>();
    for (const f of teacherFolders) {
      const pid = f?.parentId ? String(f.parentId) : null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(f);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => {
        const oa = Number.isFinite(a.order) ? a.order : 0;
        const ob = Number.isFinite(b.order) ? b.order : 0;
        if (oa !== ob) return oa - ob;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
    }
    const renderNode = (parentId: string | null, depth: number): any[] => {
      const list = byParent.get(parentId) || [];
      const out: any[] = [];
      for (const f of list) {
        out.push({ folder: f, depth });
        out.push(...renderNode(String(f.id), depth + 1));
      }
      return out;
    };
    return renderNode(null, 0);
  }, [teacherFolders]);

  const filteredMyCharts = useMemo(() => {
    if (isTeacher) return myCharts;
    if (!filterStageId && !filterTopicId) return myCharts;
    return (myCharts || []).filter((c) => {
      const path = Array.isArray(c?.folderSnapshot?.path) ? c.folderSnapshot.path : [];
      const stageOk = !filterStageId ? true : String(path[0]?.id || '') === String(filterStageId);
      const topicOk = !filterTopicId ? true : String(path[1]?.id || '') === String(filterTopicId);
      return stageOk && topicOk;
    });
  }, [filterStageId, filterTopicId, isTeacher, myCharts]);

  const displayedSpec: ChartSpec | null = useMemo(() => {
    if (tab === 'library') {
      const found = filteredMyCharts.find((c) => String(c.id) === String(selectedChartId || '')) || null;
      return found?.chartSpec || null;
    }
    if (tab === 'students') {
      const found = studentCharts.find((c) => String(c.id) === String(selectedStudentChartId || '')) || null;
      return found?.chartSpec || null;
    }
    return spec;
  }, [filteredMyCharts, selectedChartId, spec, studentCharts, selectedStudentChartId, tab]);

  const displayedMeta: ChartRecord | null = useMemo(() => {
    if (tab === 'library') return filteredMyCharts.find((c) => String(c.id) === String(selectedChartId || '')) || null;
    if (tab === 'students') return studentCharts.find((c) => String(c.id) === String(selectedStudentChartId || '')) || null;
    return null;
  }, [filteredMyCharts, selectedChartId, studentCharts, selectedStudentChartId, tab]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    (students || []).forEach((s: any) => {
      const c = String(s?.profile?.class || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [students]);

  const studentsInClass = useMemo(() => {
    if (!className) return [];
    return (students || []).filter((s: any) => String(s?.profile?.class || '').trim() === String(className || '').trim());
  }, [students, className]);

  const renderChart = (targetCanvas: HTMLCanvasElement | null, targetRef: React.MutableRefObject<any>, chartSpec: ChartSpec) => {
    if (!targetCanvas) return;
    try {
      if (targetRef.current) {
        targetRef.current.destroy?.();
        targetRef.current = null;
      }
      const cfg = buildChartConfig(chartSpec);
      targetRef.current = new (Chart as any)(targetCanvas.getContext('2d'), cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : '圖表渲染失敗');
    }
  };

  const handleGenerate = () => {
    setError('');
    renderChart(canvasRef.current, chartRef, spec);
    setGeneratedAt(Date.now());
    // reset preview transform so chart starts centered
    setPreviewScale(1);
    setPreviewOffset({ x: 0, y: 0 });
  };

  const downloadCanvasPng = async (canvas: HTMLCanvasElement, filenamePrefix: string) => {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 匯出失敗'))), 'image/png');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filenamePrefix}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await downloadCanvasPng(canvas, 'lp-chart');
  };

  const handleReset = () => {
    setError('');
    setSpec(defaultSpec());
    setGeneratedAt(null);
    if (chartRef.current) {
      chartRef.current.destroy?.();
      chartRef.current = null;
    }
  };

  const loadStudentFolders = async () => {
    setFoldersLoading(true);
    setFoldersError('');
    try {
      const resp = await authService.getMyClassFolders();
      const folders = Array.isArray(resp?.folders) ? resp.folders : [];
      setClassFolders(folders);
      if (!saveStageId) {
        const stages = folders.filter((f: any) => f && Number(f.level) === 1 && !f.archivedAt);
        if (stages.length > 0) setSaveStageId(String(stages[0].id));
      }
    } catch (e) {
      setClassFolders([]);
      setFoldersError(e instanceof Error ? e.message : '載入資料夾失敗');
    } finally {
      setFoldersLoading(false);
    }
  };

  const loadTeacherFolders = async (grade: string) => {
    setFoldersLoading(true);
    setFoldersError('');
    try {
      const g = String(grade || '').trim();
      if (!g) {
        setTeacherFolders([]);
        return;
      }
      const resp = await authService.listMyLibraryFolders(g);
      setTeacherFolders(Array.isArray(resp?.folders) ? resp.folders : []);
    } catch (e) {
      setTeacherFolders([]);
      setFoldersError(e instanceof Error ? e.message : '載入資料夾失敗');
    } finally {
      setFoldersLoading(false);
    }
  };

  const loadMyCharts = async () => {
    setMyChartsLoading(true);
    setMyChartsError('');
    try {
      const resp = await authService.listMyCharts();
      const list = Array.isArray(resp?.charts) ? resp.charts : [];
      setMyCharts(list);
      if (!selectedChartId && list.length > 0) setSelectedChartId(String(list[0].id));
    } catch (e) {
      setMyCharts([]);
      setSelectedChartId(null);
      setMyChartsError(e instanceof Error ? e.message : '載入圖表失敗');
    } finally {
      setMyChartsLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...(isTeacher ? { grade: teacherSaveGrade, folderId: teacherSaveFolderId } : { folderId: saveSubfolderId || saveTopicId || null }),
        title: String(spec.title || '').trim() || '我的圖表',
        chartSpec: { ...spec, rows: sanitizeRows(spec.rows) }
      };
      const resp = await authService.createMyChart(payload as any);
      const savedId = String(resp?.chart?.id || '');
      await loadMyCharts();
      if (savedId) setSelectedChartId(savedId);
      setTab('library');
      alert('已儲存圖表');
    } catch (e) {
      alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (chartId: string) => {
    if (!chartId) return;
    if (!confirm('確定要刪除此圖表嗎？此操作無法復原。')) return;
    try {
      await authService.deleteMyChart(chartId);
      const next = myCharts.filter((c) => String(c.id) !== String(chartId));
      setMyCharts(next);
      const nextFiltered = filteredMyCharts.filter((c) => String(c.id) !== String(chartId));
      setSelectedChartId(nextFiltered[0]?.id ? String(nextFiltered[0].id) : null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const loadRoster = async () => {
    try {
      const resp = await authService.getStudentRoster({ limit: 2000 });
      const list = (resp?.users || []).filter((u: any) => u && u.role === 'student').sort(compareStudentsByStudentId);
      setStudents(list);
      if (!className && list.length > 0) setClassName(String(list[0]?.profile?.class || '').trim());
    } catch {
      setStudents([]);
    }
  };

  const loadStudentCharts = async (sid: string) => {
    if (!sid) return;
    setStudentChartsLoading(true);
    setStudentChartsError('');
    try {
      const resp = await authService.listStudentCharts(String(sid));
      const list = Array.isArray(resp?.charts) ? resp.charts : [];
      setStudentCharts(list);
      setSelectedStudentChartId(list[0]?.id ? String(list[0].id) : null);
    } catch (e) {
      setStudentCharts([]);
      setSelectedStudentChartId(null);
      setStudentChartsError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setStudentChartsLoading(false);
    }
  };

  const folderTree = useMemo(() => {
    const getNameAt = (snapshot: any, idx: number) => {
      const path = Array.isArray(snapshot?.path) ? snapshot.path : [];
      return String(path[idx]?.name || '').trim();
    };

    const stageMap = new Map<string, any>();
    const stageOrder: string[] = [];

    const ensureStage = (name: string) => {
      const key = name || '未分類';
      if (!stageMap.has(key)) {
        stageMap.set(key, { name: key, topicMap: new Map<string, any>(), topicOrder: [] as string[] });
        stageOrder.push(key);
      }
      return stageMap.get(key);
    };
    const ensureTopic = (stage: any, name: string) => {
      const key = name || '未分類';
      if (!stage.topicMap.has(key)) {
        stage.topicMap.set(key, { name: key, subMap: new Map<string, any>(), subOrder: [] as string[], charts: [] as ChartRecord[] });
        stage.topicOrder.push(key);
      }
      return stage.topicMap.get(key);
    };
    const ensureSub = (topic: any, name: string) => {
      const key = name || '未分類';
      if (!topic.subMap.has(key)) {
        topic.subMap.set(key, { name: key, charts: [] as ChartRecord[] });
        topic.subOrder.push(key);
      }
      return topic.subMap.get(key);
    };

    (studentCharts || []).forEach((c) => {
      const stageName = getNameAt(c.folderSnapshot, 0);
      const topicName = getNameAt(c.folderSnapshot, 1);
      const subName = getNameAt(c.folderSnapshot, 2);
      const stage = ensureStage(stageName);
      const topic = ensureTopic(stage, topicName);
      const sub = ensureSub(topic, subName);
      sub.charts.push(c);
    });

    // stable ordering
    for (const s of stageOrder) {
      const stage = stageMap.get(s);
      stage?.topicOrder?.sort((a: string, b: string) => a.localeCompare(b, 'zh-Hant'));
      for (const t of stage?.topicOrder || []) {
        const topic = stage.topicMap.get(t);
        topic?.subOrder?.sort((a: string, b: string) => a.localeCompare(b, 'zh-Hant'));
        for (const sub of topic?.subOrder || []) {
          const leaf = topic.subMap.get(sub);
          leaf.charts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    }
    stageOrder.sort((a, b) => a.localeCompare(b, 'zh-Hant'));

    return { stageOrder, stageMap };
  }, [studentCharts]);

  useEffect(() => {
    if (!open) return;
    if (isTeacher) void loadTeacherFolders(teacherSaveGrade);
    else void loadStudentFolders();
    void loadMyCharts();
    if (isTeacher) void loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!isTeacher) return;
    setTeacherSaveFolderId(null);
    void loadTeacherFolders(teacherSaveGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isTeacher, teacherSaveGrade]);

  useEffect(() => {
    if (!open) return;
    if (!className) return;
    const list = (students || []).filter((s: any) => String(s?.profile?.class || '').trim() === String(className || '').trim());
    if (list.length > 0) setStudentId(String(list[0].id));
    else setStudentId('');
  }, [open, className, students]);

  useEffect(() => {
    if (!open) return;
    if (!studentId) return;
    void loadStudentCharts(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  useEffect(() => {
    if (tab !== 'library') return;
    if (filteredMyCharts.length === 0) {
      setSelectedChartId(null);
      return;
    }
    const exists = filteredMyCharts.some((c) => String(c.id) === String(selectedChartId || ''));
    if (!exists) setSelectedChartId(String(filteredMyCharts[0].id));
  }, [filteredMyCharts, selectedChartId, tab]);

  useEffect(() => {
    if (!open) return;
    if (!fullscreenOpen) return;
    const t = window.setTimeout(() => {
      if (!displayedSpec) return;
      renderChart(fullscreenCanvasRef.current, fullscreenChartRef, displayedSpec);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenOpen]);

  useEffect(() => {
    if (!open) return;
    // when switching tab to view existing chart, render once
    if (tab === 'library' || tab === 'students') {
      if (!displayedSpec) return;
      const t = window.setTimeout(() => renderChart(canvasRef.current, chartRef, displayedSpec), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, tab, selectedChartId, selectedStudentChartId, generatedAt, displayedSpec]);

  useEffect(() => {
    if (!open) return;
    return () => {
      chartRef.current?.destroy?.();
      chartRef.current = null;
      fullscreenChartRef.current?.destroy?.();
      fullscreenChartRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    setSaveTopicId('');
    setSaveSubfolderId('');
  }, [saveStageId]);
  useEffect(() => {
    setSaveSubfolderId('');
  }, [saveTopicId]);
  useEffect(() => {
    setFilterTopicId('');
  }, [filterStageId]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
        <div className="bg-brand-brown text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            <div>
              <div className="text-xl font-black">圖表生成器</div>
              <div className="text-sm text-white/80 font-bold">支援棒形圖、折線圖、圓餅圖等，並可儲存到資料夾。</div>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all" aria-label="關閉">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(92vh-84px)]">
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`px-4 py-2 rounded-2xl border-2 font-black ${tab === 'create' ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-[#E6D2B5]'}`}
            >
              新圖表
            </button>
            <button
              type="button"
              onClick={() => setTab('library')}
              className={`px-4 py-2 rounded-2xl border-2 font-black ${tab === 'library' ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-[#E6D2B5]'}`}
            >
              我的圖表
            </button>
            {isTeacher ? (
              <button
                type="button"
                onClick={() => setTab('students')}
                className={`px-4 py-2 rounded-2xl border-2 font-black ${tab === 'students' ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-[#E6D2B5]'}`}
              >
                學生圖表
              </button>
            ) : null}
          </div>

          {tab === 'students' ? (
            <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-black text-brand-brown text-lg">學生圖表</div>
                <button
                  type="button"
                  onClick={() => { void loadRoster(); if (studentId) void loadStudentCharts(studentId); }}
                  className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${studentChartsLoading ? 'animate-spin' : ''}`} />
                  重新載入
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-3">
                  <div className="bg-brand-cream rounded-2xl p-4 border-2 border-[#E6D2B5]">
                    <div className="text-sm font-black text-[#5E4C40] mb-2">選擇班別</div>
                    <select
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                    >
                      <option value="">（選擇班別）</option>
                      {classes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="text-sm font-black text-[#5E4C40] mt-3 mb-2">選擇學生</div>
                    <select
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                      disabled={!className}
                    >
                      <option value="">（選擇學生）</option>
                      {studentsInClass.map((s: any) => (
                        <option key={String(s.id)} value={String(s.id)}>{String(s?.profile?.name || s.username || s.id)}</option>
                      ))}
                    </select>
                  </div>

                    <div className="bg-white rounded-2xl p-4 border-2 border-[#E6D2B5] shadow-sm">
                    <div className="text-sm font-black text-[#5E4C40] mb-2">圖表列表（資料夾分層）</div>
                    {studentChartsError ? <div className="text-xs text-red-600 font-bold">{studentChartsError}</div> : null}
                    {studentChartsLoading ? (
                      <div className="text-gray-600 font-bold">載入中...</div>
                    ) : studentCharts.length === 0 ? (
                      <div className="text-gray-600 font-bold">此學生暫無圖表。</div>
                    ) : (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {folderTree.stageOrder.map((stageName: string) => {
                          const stage = folderTree.stageMap.get(stageName);
                          return (
                            <div key={stageName} className="border-2 border-gray-200 rounded-2xl p-3">
                              <div className="font-black text-[#2F2A26]">{stageName}</div>
                              <div className="mt-2 space-y-2">
                                {(stage?.topicOrder || []).map((topicName: string) => {
                                  const topic = stage.topicMap.get(topicName);
                                  return (
                                    <div key={`${stageName}-${topicName}`} className="border-2 border-gray-100 rounded-2xl p-2">
                                      <div className="text-sm font-black text-[#5E4C40]">{topicName}</div>
                                      <div className="mt-2 space-y-2">
                                        {(topic?.subOrder || []).map((subName: string) => {
                                          const leaf = topic.subMap.get(subName);
                                          const charts = Array.isArray(leaf?.charts) ? leaf.charts : [];
                                          return (
                                            <div key={`${stageName}-${topicName}-${subName}`}>
                                              <div className="text-xs font-black text-gray-600">{subName}</div>
                                              <div className="mt-1 space-y-1">
                                                {charts.slice(0, 50).map((c: ChartRecord) => {
                                                  const selected = String(c.id) === String(selectedStudentChartId || '');
                                                  return (
                                                    <button
                                                      key={c.id}
                                                      type="button"
                                                      onClick={() => setSelectedStudentChartId(String(c.id))}
                                                      className={`w-full text-left rounded-2xl border-2 p-2 transition-all ${
                                                        selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                                                      }`}
                                                    >
                                                      <div className="font-black text-[#2F2A26] text-sm">{c.title || '圖表'}</div>
                                                      <div className="text-[11px] text-gray-600 font-bold mt-0.5">
                                                        {c.createdAt ? new Date(c.createdAt).toLocaleString('zh-HK') : ''}
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  {displayedMeta ? (
                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-black text-brand-brown text-lg">{displayedMeta.title || '圖表'}</div>
                          <div className="text-sm text-gray-600 font-bold mt-1">
                            {getFolderPathText(displayedMeta.folderSnapshot) || '未分類'} ｜ {displayedMeta.createdAt ? new Date(displayedMeta.createdAt).toLocaleString('zh-HK') : ''}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFullscreenOpen(true)}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Maximize2 className="w-4 h-4" />
                            全螢幕
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload()}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            下載圖片
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="font-black text-brand-brown mb-2">圖表預覽</div>
                    <div className="bg-white rounded-2xl border-2 border-[#E6D2B5] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="text-sm text-gray-600 font-bold inline-flex items-center gap-2">
                          <Hand className="w-4 h-4" />
                          拖曳移動｜{Math.round(previewScale * 100)}%
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewScale((s) => clamp(s / 1.2, 0.5, 2.5))}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <ZoomOut className="w-4 h-4" />縮小
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewScale((s) => clamp(s * 1.2, 0.5, 2.5))}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <ZoomIn className="w-4 h-4" />放大
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPreviewScale(1); setPreviewOffset({ x: 0, y: 0 }); }}
                            className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                          >
                            置中
                          </button>
                        </div>
                      </div>

                      <div
                        className={`relative w-full h-[420px] overflow-hidden rounded-2xl border-2 border-gray-100 bg-white ${previewDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{ touchAction: 'none' }}
                        onPointerDown={(e) => {
                          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                          setPreviewDragging(true);
                          dragStartRef.current = { x: e.clientX, y: e.clientY, ox: previewOffset.x, oy: previewOffset.y };
                        }}
                        onPointerMove={(e) => {
                          const start = dragStartRef.current;
                          if (!start) return;
                          setPreviewOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
                        }}
                        onPointerUp={() => { setPreviewDragging(false); dragStartRef.current = null; }}
                        onPointerCancel={() => { setPreviewDragging(false); dragStartRef.current = null; }}
                      >
                        <div
                          className="absolute left-0 top-0 w-full h-full p-4 will-change-transform"
                          style={{ transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`, transformOrigin: '0 0' }}
                        >
                          <div className="w-full h-full">
                            <canvas ref={canvasRef} className="w-full h-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: controls / library */}
              <div className="lg:col-span-5 space-y-6">
                {tab === 'create' ? (
                  <>
                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="font-black text-brand-brown text-lg mb-3">圖表類型</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {([
                          ['bar', '棒形圖'],
                          ['line', '折線圖'],
                          ['pie', '圓餅圖'],
                          ['doughnut', '環狀圖'],
                          ['radar', '雷達圖'],
                          ['polarArea', '極區圖'],
                          ['mixed', '複合圖']
                        ] as Array<[ChartType, string]>).map(([t, label]) => {
                          const active = spec.chartType === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSpec((s) => ({ ...s, chartType: t }))}
                              className={`px-3 py-2 rounded-2xl border-2 font-black text-left transition-all ${
                                active ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {spec.chartType === 'mixed' ? (
                        <div className="mt-4 bg-brand-cream rounded-2xl p-4 border-2 border-[#E6D2B5]">
                          <div className="font-black text-[#5E4C40] mb-2">複合圖表設定</div>
                          <div className="space-y-2">
                            {([
                              ['double-bar', '雙棒形圖'],
                              ['double-line', '雙折線圖'],
                              ['line-bar', '折線 + 棒形']
                            ] as Array<[MixedType, string]>).map(([mt, label]) => (
                              <label key={mt} className="flex items-center gap-2 font-bold text-gray-700">
                                <input
                                  type="radio"
                                  name="mixed-type"
                                  value={mt}
                                  checked={(spec.mixedType || 'line-bar') === mt}
                                  onChange={() => setSpec((s) => ({ ...s, mixedType: mt }))}
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="font-black text-brand-brown text-lg mb-3">圖表設定</div>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-sm font-bold text-gray-700 mb-1">圖表標題</div>
                          <input
                            value={spec.title}
                            onChange={(e) => setSpec((s) => ({ ...s, title: e.target.value }))}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                            placeholder="例如：每月閱讀時間"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm font-bold text-gray-700 mb-1">橫向標籤（X軸）</div>
                            <input
                              value={spec.xLabel}
                              onChange={(e) => setSpec((s) => ({ ...s, xLabel: e.target.value }))}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="例如：月份"
                              disabled={!(spec.chartType === 'bar' || spec.chartType === 'line' || spec.chartType === 'mixed')}
                            />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-700 mb-1">縱向標籤（Y軸）</div>
                            <input
                              value={spec.yLabel}
                              onChange={(e) => setSpec((s) => ({ ...s, yLabel: e.target.value }))}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="例如：分鐘"
                            />
                          </div>
                        </div>
                        {spec.chartType === 'mixed' ? (
                          <div>
                            <div className="text-sm font-bold text-gray-700 mb-1">第二組數據標籤</div>
                            <input
                              value={spec.yLabel2}
                              onChange={(e) => setSpec((s) => ({ ...s, yLabel2: e.target.value }))}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="例如：第二班"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="font-black text-brand-brown text-lg mb-3">橫向標籤與數據</div>
                      <div className="space-y-2">
                        {ensureRows(spec.rows).map((r, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <input
                              value={r.label}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSpec((s) => {
                                  const rows = [...(s.rows || [])];
                                  rows[idx] = { ...(rows[idx] || r), label: v };
                                  return { ...s, rows };
                                });
                              }}
                              className="col-span-4 px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="標籤"
                            />
                            <input
                              value={r.value1}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSpec((s) => {
                                  const rows = [...(s.rows || [])];
                                  rows[idx] = { ...(rows[idx] || r), value1: v };
                                  return { ...s, rows };
                                });
                              }}
                              className="col-span-3 px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="數值1"
                              inputMode="decimal"
                            />
                            {spec.chartType === 'mixed' ? (
                              <input
                                value={r.value2}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSpec((s) => {
                                    const rows = [...(s.rows || [])];
                                    rows[idx] = { ...(rows[idx] || r), value2: v };
                                    return { ...s, rows };
                                  });
                                }}
                                className="col-span-3 px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                                placeholder="數值2"
                                inputMode="decimal"
                              />
                            ) : (
                              <div className="col-span-3" />
                            )}
                            <input
                              type="color"
                              value={r.color || '#3498db'}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSpec((s) => {
                                  const rows = [...(s.rows || [])];
                                  rows[idx] = { ...(rows[idx] || r), color: v };
                                  return { ...s, rows };
                                });
                              }}
                              className="col-span-1 h-10 w-10 p-0 border-2 border-gray-300 rounded-xl bg-white"
                              title="顏色"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSpec((s) => {
                                  const rows = (s.rows || []).slice();
                                  rows.splice(idx, 1);
                                  return { ...s, rows: rows.length > 0 ? rows : defaultSpec().rows };
                                });
                              }}
                              className="col-span-1 h-10 w-10 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-black hover:bg-gray-50"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                              onClick={() => {
                                setSpec((s) => ({
                                  ...s,
                                  rows: [...ensureRows(s.rows), { label: `項目${ensureRows(s.rows).length + 1}`, value1: '', value2: '', color: palette[(ensureRows(s.rows).length) % palette.length] }]
                                }));
                              }}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                        >
                          + 新增數據項
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="font-black text-brand-brown text-lg mb-3">Y軸數據範圍</div>
                      <label className="flex items-center gap-2 font-bold text-gray-700">
                        <input
                          type="checkbox"
                          checked={spec.autoScaleY}
                          onChange={(e) => setSpec((s) => ({ ...s, autoScaleY: e.target.checked }))}
                          disabled={!(spec.chartType === 'bar' || spec.chartType === 'line' || spec.chartType === 'mixed' || spec.chartType === 'radar')}
                        />
                        自動調節範圍
                      </label>
                      {!spec.autoScaleY ? (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm font-bold text-gray-700 mb-1">最小值</div>
                            <input
                              value={spec.yMin}
                              onChange={(e) => setSpec((s) => ({ ...s, yMin: e.target.value }))}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="例如：0"
                              inputMode="decimal"
                            />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-700 mb-1">最大值</div>
                            <input
                              value={spec.yMax}
                              onChange={(e) => setSpec((s) => ({ ...s, yMax: e.target.value }))}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
                              placeholder="例如：100"
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                      <div className="font-black text-brand-brown text-lg mb-3">樣式設定</div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 font-bold text-gray-700">
                          <input type="checkbox" checked={spec.showLegend} onChange={(e) => setSpec((s) => ({ ...s, showLegend: e.target.checked }))} />
                          顯示圖例
                        </label>
                        <label className="flex items-center gap-2 font-bold text-gray-700">
                          <input type="checkbox" checked={spec.showAnimation} onChange={(e) => setSpec((s) => ({ ...s, showAnimation: e.target.checked }))} />
                          啟用動畫
                        </label>
                        <label className="flex items-center gap-2 font-bold text-gray-700">
                          <input type="checkbox" checked={spec.showGrid} onChange={(e) => setSpec((s) => ({ ...s, showGrid: e.target.checked }))} />
                          顯示網格
                        </label>
                      </div>
                    </div>

                    {error ? (
                      <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 font-bold">
                        {error}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="bg-brand-blue hover:bg-brand-blue/90 text-brand-brown font-black inline-flex items-center gap-2"
                        onClick={handleGenerate}
                      >
                        <RefreshCw className="w-5 h-5" />
                        生成圖表
                      </Button>
                      <Button
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-black inline-flex items-center gap-2"
                        onClick={handleReset}
                      >
                        <Trash2 className="w-5 h-5" />
                        重設
                      </Button>
                    </div>

	                    <div className="mt-4 bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
	                      <div className="font-black text-brand-brown text-lg mb-3">儲存到資料夾</div>
	                      {isTeacher ? (
	                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
	                          <div>
	                            <div className="text-sm font-bold text-gray-700 mb-1">年級</div>
	                            <select
	                              value={teacherSaveGrade}
	                              onChange={(e) => setTeacherSaveGrade(e.target.value)}
	                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                              disabled={foldersLoading}
	                            >
	                              {teacherGradeOptions.map((g) => (
	                                <option key={g} value={g}>{g} 年級</option>
	                              ))}
	                            </select>
	                          </div>
	                          <div>
	                            <div className="text-sm font-bold text-gray-700 mb-1">教師私人資料夾（可選）</div>
	                            <select
	                              value={teacherSaveFolderId || ''}
	                              onChange={(e) => setTeacherSaveFolderId(e.target.value ? e.target.value : null)}
	                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown bg-white"
	                              disabled={foldersLoading}
	                            >
	                              <option value="">（未分類）</option>
	                              {teacherFolderTree.map((row) => (
	                                <option key={row.folder.id} value={String(row.folder.id)}>
	                                  {'　'.repeat(row.depth)}{String(row.folder.name || '')}
	                                </option>
	                              ))}
	                            </select>
	                            <div className="mt-2 text-xs text-gray-600 font-bold">
	                              此功能會儲存到你的「教師資料夾（私人）」。如需新增/管理資料夾，請到「教師資料夾」。
	                            </div>
	                          </div>
	                        </div>
	                      ) : (
	                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	                          <div>
	                            <div className="text-sm font-bold text-gray-700 mb-1">學段</div>
	                            <select
	                              value={saveStageId}
	                              onChange={(e) => setSaveStageId(e.target.value)}
	                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                              disabled={foldersLoading}
	                            >
	                              <option value="">（未分類）</option>
	                              {stageFolders.map((f: any) => (
	                                <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
	                              ))}
	                            </select>
	                          </div>
	                          <div>
	                            <div className="text-sm font-bold text-gray-700 mb-1">課題</div>
	                            <select
	                              value={saveTopicId}
	                              onChange={(e) => setSaveTopicId(e.target.value)}
	                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                              disabled={!saveStageId || foldersLoading}
	                            >
	                              <option value="">（不選）</option>
	                              {topicFolders.map((f: any) => (
	                                <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
	                              ))}
	                            </select>
	                            <div className="mt-2 text-xs text-gray-600 font-bold">需要新增課題資料夾請聯絡老師。</div>
	                          </div>
	                          <div>
	                            <div className="text-sm font-bold text-gray-700 mb-1">子資料夾（可選）</div>
	                            <select
	                              value={saveSubfolderId}
	                              onChange={(e) => setSaveSubfolderId(e.target.value)}
	                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                              disabled={!saveTopicId || foldersLoading}
	                            >
	                              <option value="">（不選）</option>
	                              {subFolders.map((f: any) => (
	                                <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
	                              ))}
	                            </select>
	                          </div>
	                        </div>
	                      )}
	                      {foldersError ? <div className="mt-2 text-xs text-red-600 font-bold">{foldersError}</div> : null}
	                      <div className="mt-3 flex gap-2">
	                        <button
	                          type="button"
                          onClick={() => void handleSave()}
                          className="w-full px-4 py-3 rounded-2xl bg-[#93C47D] border-4 border-brand-brown text-brand-brown font-black shadow-comic active:translate-y-1 active:shadow-none hover:bg-[#86b572] inline-flex items-center justify-center gap-2"
                          disabled={saving}
                        >
                          <Save className="w-5 h-5" />
                          {saving ? '儲存中...' : '儲存圖表'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-black text-brand-brown">我的圖表</div>
                      <button
                        type="button"
                        onClick={() => void loadMyCharts()}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${myChartsLoading ? 'animate-spin' : ''}`} />
                        重新載入
                      </button>
                    </div>

                    {myChartsError ? (
                      <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-3 font-bold">
                        {myChartsError}
                      </div>
                    ) : null}

	                    {!isTeacher ? (
	                      <>
	                        <div className="text-sm font-black text-[#5E4C40] mb-2">資料夾篩選</div>
	                        <div className="space-y-2">
	                          <select
	                            value={filterStageId}
	                            onChange={(e) => setFilterStageId(e.target.value)}
	                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                            disabled={foldersLoading}
	                          >
	                            <option value="">（選擇學段）</option>
	                            {stageFolders.map((f: any) => (
	                              <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
	                            ))}
	                          </select>
	                          <select
	                            value={filterTopicId}
	                            onChange={(e) => setFilterTopicId(e.target.value)}
	                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand-brown"
	                            disabled={!filterStageId || foldersLoading}
	                          >
	                            <option value="">（全部課題）</option>
	                            {filterTopicFolders.map((f: any) => (
	                              <option key={f.id} value={String(f.id)}>{String(f.name || '')}</option>
	                            ))}
	                          </select>
	                        </div>
	                      </>
	                    ) : (
	                      <div className="text-xs text-gray-600 font-bold">
	                        教師圖表會儲存在「教師資料夾（私人）」；如需依資料夾整理/管理，請到「教師資料夾」。
	                      </div>
	                    )}

                    <div className="mt-4">
                      <div className="text-sm font-black text-[#5E4C40] mb-2">圖表列表</div>
                      {myChartsLoading ? (
                        <div className="text-gray-600 font-bold">載入中...</div>
                      ) : filteredMyCharts.length === 0 ? (
                        <div className="text-gray-600 font-bold">{myCharts.length === 0 ? '暫無已儲存的圖表。' : '暫無符合篩選的圖表。'}</div>
                      ) : (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {filteredMyCharts.slice(0, 200).map((c) => {
                            const selected = String(c.id) === String(selectedChartId || '');
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedChartId(String(c.id))}
                                className={`w-full text-left rounded-2xl border-2 p-3 transition-all ${
                                  selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <div className="font-black text-[#2F2A26]">{c.title || '圖表'}</div>
                                <div className="text-xs text-gray-600 font-bold mt-1">
                                  {getFolderPathText(c.folderSnapshot) || '未分類'} ｜ {c.createdAt ? new Date(c.createdAt).toLocaleString('zh-HK') : ''}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: preview */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-brand-brown text-lg">{displayedSpec?.title || '圖表預覽'}</div>
                      {displayedMeta ? (
                        <div className="text-sm text-gray-600 font-bold mt-1">
                          {getFolderPathText(displayedMeta.folderSnapshot) || '未分類'} ｜ {displayedMeta.createdAt ? new Date(displayedMeta.createdAt).toLocaleString('zh-HK') : ''}
                          {tab === 'library' ? (
                            <>
                              <span className="ml-2">｜</span>
                              <button
                                type="button"
                                onClick={() => void handleDelete(String(displayedMeta.id))}
                                className="ml-2 underline text-red-600 hover:text-red-700"
                              >
                                刪除
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFullscreenOpen(true)}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                      >
                        <Maximize2 className="w-4 h-4" />
                        全螢幕
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載圖片
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-comic border-2 border-brand-brown/10">
                  <div className="font-black text-brand-brown mb-2">圖表</div>
                  <div className="bg-white rounded-2xl border-2 border-[#E6D2B5] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-sm text-gray-600 font-bold inline-flex items-center gap-2">
                        <Hand className="w-4 h-4" />
                        拖曳移動｜{Math.round(previewScale * 100)}%
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewScale((s) => clamp(s / 1.2, 0.5, 2.5))}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                        >
                          <ZoomOut className="w-4 h-4" />縮小
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewScale((s) => clamp(s * 1.2, 0.5, 2.5))}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 inline-flex items-center gap-2"
                        >
                          <ZoomIn className="w-4 h-4" />放大
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPreviewScale(1); setPreviewOffset({ x: 0, y: 0 }); }}
                          className="px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                        >
                          置中
                        </button>
                      </div>
                    </div>

                    <div
                      className={`relative w-full h-[520px] overflow-hidden rounded-2xl border-2 border-gray-100 bg-white ${previewDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => {
                        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                        setPreviewDragging(true);
                        dragStartRef.current = { x: e.clientX, y: e.clientY, ox: previewOffset.x, oy: previewOffset.y };
                      }}
                      onPointerMove={(e) => {
                        const start = dragStartRef.current;
                        if (!start) return;
                        setPreviewOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
                      }}
                      onPointerUp={() => { setPreviewDragging(false); dragStartRef.current = null; }}
                      onPointerCancel={() => { setPreviewDragging(false); dragStartRef.current = null; }}
                    >
                      <div
                        className="absolute left-0 top-0 w-full h-full p-4 will-change-transform"
                        style={{ transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`, transformOrigin: '0 0' }}
                      >
                        <div className="w-full h-full">
                          <canvas ref={canvasRef} className="w-full h-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {fullscreenOpen ? (
            <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full h-full max-w-[98vw] max-h-[96vh] overflow-hidden shadow-comic-xl border-4 border-brand-brown">
                <div className="bg-brand-brown text-white p-4 flex items-center justify-between">
                  <div className="font-black">{displayedSpec?.title || '圖表'}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const canvas = fullscreenCanvasRef.current;
                        if (!canvas) return;
                        void downloadCanvasPng(canvas, 'lp-chart');
                      }}
                      className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      下載圖片
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullscreenOpen(false);
                        fullscreenChartRef.current?.destroy?.();
                        fullscreenChartRef.current = null;
                      }}
                      className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
                      aria-label="關閉"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-white h-[calc(96vh-70px)]">
                  <div className="w-full h-full rounded-2xl border-2 border-[#E6D2B5] overflow-hidden">
                    <canvas ref={fullscreenCanvasRef} className="w-full h-full" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
