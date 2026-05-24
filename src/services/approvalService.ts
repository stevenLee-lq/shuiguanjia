/** 审批记录（演示：存 localStorage；正式环境对接接口） */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** 业务类型：后续可扩展计划申请、取水许可等 */
export type ApprovalKind = 'quota_benchmark' | 'plan_apply' | 'water_license' | 'product_new';

export interface ApprovalRecord {
  id: string;
  kind: ApprovalKind;
  title: string;
  status: ApprovalStatus;
  submittedAt: string;
  /** 列表摘要 */
  summary: string;
  /** 新增产品申请（kind=product_new）时携带，审批通过后写入可选名录 */
  industryKey?: string;
  productName?: string;
  /** 申报的产品产量计量单位，通过后与该备案产品绑定且不可再改 */
  productUnit?: string;
  purpose?: string;
  /** 驳回原因（status=rejected 时） */
  rejectReason?: string;
}

const LS_KEY = 'approvalRecords.v1';

export function loadApprovals(): ApprovalRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApprovalRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch {
    return [];
  }
}

function saveApprovals(list: ApprovalRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function addApprovalRecord(rec: ApprovalRecord): void {
  const list = loadApprovals();
  saveApprovals([rec, ...list]);
}

export function updateApprovalStatus(
  id: string,
  status: ApprovalStatus,
  extra?: { rejectReason?: string },
): boolean {
  const list = loadApprovals();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const prev = list[i]!;
  const next: ApprovalRecord = { ...prev, status };
  if (status === 'rejected' && extra?.rejectReason) {
    next.rejectReason = extra.rejectReason;
  }
  if (status !== 'rejected') {
    delete next.rejectReason;
  }
  list[i] = next;
  saveApprovals(list);
  return true;
}

/** 演示：新增产品已通过 / 已驳回（不占用户存储；仅在合并列表中出现） */
export const DEMO_APPROVAL_SEEDS: ApprovalRecord[] = [
  {
    id: 'demo_product_new_approved',
    kind: 'product_new',
    title: '新增产品申请',
    status: 'approved',
    submittedAt: '2026-03-10T09:00:00.000Z',
    summary: '行业：食品制造业 / 乳制品制造 / 发酵乳制品 / 发酵乳制品制造；产品：风味发酵乳',
    industryKey: 'food/dairy/fermented_cat/fermented',
    productName: '风味发酵乳',
    productUnit: '吨',
    purpose: '终端零售与餐饮渠道供货',
  },
  {
    id: 'demo_product_new_rejected',
    kind: 'product_new',
    title: '新增产品申请',
    status: 'rejected',
    submittedAt: '2026-03-12T16:20:00.000Z',
    summary: '行业：食品制造业 / 乳制品制造 / 发酵乳制品 / 发酵乳制品制造；产品：益生菌气泡乳饮',
    industryKey: 'food/dairy/fermented_cat/fermented',
    productName: '益生菌气泡乳饮',
    productUnit: '吨',
    purpose: '试产与渠道试销',
    rejectReason:
      '产品分类与统计口径暂无法与现有名录对应，请补充产品标准及工艺说明后重新提交。',
  },
];

/** 合并本机记录与演示种子（同 id 以本机为准） */
export function loadApprovalsWithDemos(): ApprovalRecord[] {
  const stored = loadApprovals();
  const byId = new Map<string, ApprovalRecord>();
  for (const r of stored) byId.set(r.id, r);
  for (const d of DEMO_APPROVAL_SEEDS) {
    if (!byId.has(d.id)) byId.set(d.id, d);
  }
  return Array.from(byId.values()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function countByStatus(list: ApprovalRecord[]) {
  return {
    pending: list.filter((x) => x.status === 'pending').length,
    approved: list.filter((x) => x.status === 'approved').length,
    rejected: list.filter((x) => x.status === 'rejected').length,
  };
}

/** 业务类型展示名（首页「全部审批」分类用） */
export function approvalKindLabel(kind: ApprovalKind): string {
  switch (kind) {
    case 'quota_benchmark':
      return '定额对标';
    case 'plan_apply':
      return '计划申请';
    case 'water_license':
      return '取水许可';
    case 'product_new':
      return '新增产品';
    default:
      return '其他';
  }
}
