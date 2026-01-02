export const compareStudentId = (a: unknown, b: unknown) => {
  const idA = String(a ?? '').trim();
  const idB = String(b ?? '').trim();

  if (!idA && !idB) return 0;
  if (!idA) return 1;
  if (!idB) return -1;

  const isNumA = /^\d+$/.test(idA);
  const isNumB = /^\d+$/.test(idB);

  if (isNumA && isNumB) {
    const numA = Number(idA);
    const numB = Number(idB);
    if (numA !== numB) return numA - numB;
    return idA.localeCompare(idB, 'zh-Hant');
  }

  if (isNumA && !isNumB) return -1;
  if (!isNumA && isNumB) return 1;

  return idA.localeCompare(idB, 'zh-Hant');
};

type ParsedClassCode = {
  grade: number | null;
  section: string | null;
  raw: string;
};

export const parseClassCode = (value: unknown): ParsedClassCode => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return { grade: null, section: null, raw: '' };

  const normalized = raw.replace(/班/g, '').replace(/\s+/g, '');
  const match = normalized.match(/(\d+)([A-Z])/);
  if (match) return { grade: Number(match[1]), section: match[2], raw: normalized };

  const gradeOnly = normalized.match(/(\d+)/);
  if (gradeOnly) return { grade: Number(gradeOnly[1]), section: null, raw: normalized };

  return { grade: null, section: null, raw: normalized };
};

export const compareClassCode = (a: unknown, b: unknown) => {
  const classA = parseClassCode(a);
  const classB = parseClassCode(b);

  const gradeA = classA.grade;
  const gradeB = classB.grade;
  const hasGradeA = typeof gradeA === 'number' && Number.isFinite(gradeA);
  const hasGradeB = typeof gradeB === 'number' && Number.isFinite(gradeB);

  if (!hasGradeA && !hasGradeB) return classA.raw.localeCompare(classB.raw, 'zh-Hant');
  if (!hasGradeA) return 1;
  if (!hasGradeB) return -1;

  if (gradeA !== gradeB) return gradeA - gradeB;

  const sectionA = classA.section || '';
  const sectionB = classB.section || '';
  if (sectionA !== sectionB) return sectionA.localeCompare(sectionB, 'zh-Hant');

  return classA.raw.localeCompare(classB.raw, 'zh-Hant');
};

export const compareStudentsByStudentId = (a: any, b: any) => {
  const byId = compareStudentId(a?.profile?.studentId, b?.profile?.studentId);
  if (byId !== 0) return byId;
  const nameA = String(a?.profile?.name || a?.username || '').trim();
  const nameB = String(b?.profile?.name || b?.username || '').trim();
  return nameA.localeCompare(nameB, 'zh-Hant');
};

export const compareStudentsByGradeClassStudentId = (a: any, b: any) => {
  const byClass = compareClassCode(a?.profile?.class, b?.profile?.class);
  if (byClass !== 0) return byClass;

  const byId = compareStudentId(a?.profile?.studentId, b?.profile?.studentId);
  if (byId !== 0) return byId;

  const nameA = String(a?.profile?.name || a?.username || '').trim();
  const nameB = String(b?.profile?.name || b?.username || '').trim();
  return nameA.localeCompare(nameB, 'zh-Hant');
};

export const compareStudentMetaByGradeClassStudentId = (a: any, b: any) => {
  const byClass = compareClassCode(a?.studentClass, b?.studentClass);
  if (byClass !== 0) return byClass;
  const byId = compareStudentId(a?.studentStudentId, b?.studentStudentId);
  if (byId !== 0) return byId;
  const nameA = String(a?.studentName || a?.studentUsername || '').trim();
  const nameB = String(b?.studentName || b?.studentUsername || '').trim();
  return nameA.localeCompare(nameB, 'zh-Hant');
};
