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

export const compareStudentsByStudentId = (a: any, b: any) => {
  const byId = compareStudentId(a?.profile?.studentId, b?.profile?.studentId);
  if (byId !== 0) return byId;
  const nameA = String(a?.profile?.name || a?.username || '').trim();
  const nameB = String(b?.profile?.name || b?.username || '').trim();
  return nameA.localeCompare(nameB, 'zh-Hant');
};

