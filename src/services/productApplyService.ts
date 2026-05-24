/** 管理员审批通过后的「可选产品」名录（按内置行业四级 path key）；演示存 localStorage；备案产品绑定固定单位 */

import { DEMO_APPROVAL_SEEDS } from './approvalService.ts';

const LS_APPROVED_V1 = 'productApprovedByIndustry.v1';
const LS_APPROVED_V2 = 'productApprovedByIndustry.v2';

/** industryKey -> 产品名 -> 定额计量单位（审批写入，填报时不可改） */
export type ApprovedProductsByIndustry = Record<string, Record<string, string>>;

function readApprovedRaw(): unknown {
  try {
    const v2 = localStorage.getItem(LS_APPROVED_V2);
    if (v2) return JSON.parse(v2);
    const v1 = localStorage.getItem(LS_APPROVED_V1);
    if (v1) return JSON.parse(v1);
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeApproved(raw: unknown): ApprovedProductsByIndustry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ApprovedProductsByIndustry = {};
  for (const [industryKey, val] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      /** v1：仅有产品名列表，迁移时默认吨（旧演示兼容） */
      out[industryKey] = Object.fromEntries(val.map((n) => [String(n).trim(), '吨']));
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const m: Record<string, string> = {};
      for (const [name, unit] of Object.entries(val as Record<string, unknown>)) {
        const u = typeof unit === 'string' ? unit.trim() : '';
        if (name.trim()) m[name.trim()] = u || '吨';
      }
      out[industryKey] = m;
    }
  }
  return out;
}

function writeApprovedV2(m: ApprovedProductsByIndustry) {
  localStorage.setItem(LS_APPROVED_V2, JSON.stringify(m));
  try {
    localStorage.removeItem(LS_APPROVED_V1);
  } catch {
    /* ignore */
  }
}

function readApproved(): ApprovedProductsByIndustry {
  const raw = readApprovedRaw();
  const normalized = normalizeApproved(raw);
  const needsMigrate =
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.values(raw as Record<string, unknown>).some((v) => Array.isArray(v));
  if (needsMigrate) {
    writeApprovedV2(normalized);
  }
  return normalized;
}

/** 某行业（四级 path join）下已通过备案、出现在下拉中的产品名 */
export function getApprovedProductNamesForIndustry(industryKey: string): string[] {
  const fromLs = readApproved()[industryKey];
  const set = new Set<string>(fromLs ? Object.keys(fromLs) : []);
  for (const r of DEMO_APPROVAL_SEEDS) {
    if (
      r.kind === 'product_new' &&
      r.status === 'approved' &&
      r.industryKey === industryKey &&
      r.productName
    ) {
      set.add(r.productName);
    }
  }
  return [...set];
}

/** 备案产品绑定的产品单位（无则 undefined；演示已通过记录与本机 localStorage 合并） */
export function getApprovedProductUnit(industryKey: string, productName: string): string | undefined {
  const m = readApproved()[industryKey];
  const fromLs = m?.[productName]?.trim();
  if (fromLs) return fromLs;
  const demo = DEMO_APPROVAL_SEEDS.find(
    (r) =>
      r.kind === 'product_new' &&
      r.status === 'approved' &&
      r.industryKey === industryKey &&
      r.productName === productName,
  );
  const u = demo?.productUnit?.trim();
  return u || undefined;
}

/** 审批通过后将产品纳入该行业可选列表，并锁定单位 */
export function addApprovedProductForIndustry(
  industryKey: string,
  productName: string,
  productUnit: string,
): void {
  const name = productName.trim();
  const unit = productUnit.trim() || '吨';
  if (!industryKey || !name) return;
  const m = readApproved();
  const prev = m[industryKey] ?? {};
  m[industryKey] = { ...prev, [name]: unit };
  writeApprovedV2(m);
}
