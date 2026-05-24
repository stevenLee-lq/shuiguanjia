/** @license SPDX-License-Identifier: Apache-2.0 */
/**
 * 定额对标 · 行业类别：底部弹层 + 逐级列表；展示国标风格分段（如 C14-食品制造业/D441-热电联产）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import { Check, ChevronRight, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getIndustryPathGbDisplay } from '../data/productCatalog.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type IndustryTreeNode = {
  value: string;
  label: string;
  /** 国标风格分段，如 C14-食品制造业 */
  gbSegment?: string;
  children?: IndustryTreeNode[];
};

const STEP_HINTS = ['选择门类', '选择大类', '选择中类', '选择小类'];

function nodeSegment(n: IndustryTreeNode): string {
  return (n.gbSegment?.trim() || `${n.value}-${n.label}`).trim();
}

function getChildrenAtPath(nodes: IndustryTreeNode[], path: string[]): IndustryTreeNode[] {
  let cur = nodes;
  for (const p of path) {
    const n = cur.find((x) => x.value === p);
    if (!n?.children?.length) return [];
    cur = n.children;
  }
  return cur;
}

function gbSegmentsForNav(nodes: IndustryTreeNode[], stack: string[]): string[] {
  const out: string[] = [];
  let cur = nodes;
  for (const p of stack) {
    const n = cur.find((x) => x.value === p);
    if (!n) break;
    out.push(nodeSegment(n));
    cur = n.children ?? [];
  }
  return out;
}

export type IndustryPathBottomPickerProps = {
  value?: string[];
  onChange?: (path: string[]) => void;
  options: IndustryTreeNode[];
  placeholder?: string;
  /** 为 true 时仅只读展示，不可打开选择 */
  readOnly?: boolean;
};

export function IndustryPathBottomPicker({
  value,
  onChange,
  options,
  placeholder = '逐级选择门类、大类、中类、小类',
  readOnly = false,
}: IndustryPathBottomPickerProps) {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setStack([]);
    }
  }, [open]);

  const gbPathLine = useMemo(() => getIndustryPathGbDisplay(value), [value]);

  const currentList = useMemo(() => getChildrenAtPath(options, stack), [options, stack]);

  const stepIndex = stack.length;
  const stepTitle = STEP_HINTS[Math.min(stepIndex, STEP_HINTS.length - 1)] ?? '请选择';

  const breadcrumbGbSegments = gbSegmentsForNav(options, stack);

  const handlePick = (node: IndustryTreeNode) => {
    if (!node.children?.length) {
      onChange?.([...stack, node.value]);
      setOpen(false);
      setStack([]);
      return;
    }
    setStack((s) => [...s, node.value]);
  };

  const goToBreadcrumbIndex = (idx: number) => {
    if (idx <= 0) {
      setStack([]);
      return;
    }
    setStack((s) => s.slice(0, idx));
  };

  const isLeafRowChecked = (node: IndustryTreeNode) => {
    if (node.children?.length) return false;
    if (!value || value.length !== 4) return false;
    const candidate = [...stack, node.value];
    return candidate.length === 4 && candidate.every((v, i) => v === value[i]);
  };

  const hasSelection = Boolean(gbPathLine);

  if (readOnly) {
    return (
      <div
        className={cn(
          'quota-industry-picker-trigger flex min-h-[40px] w-full max-w-full items-start rounded-lg border border-gray-200 bg-gray-50/95 px-3 py-2.5 text-left text-sm text-gray-800',
        )}
      >
        <span className="line-clamp-4 block w-full text-[12px] leading-snug break-all">
          {hasSelection ? gbPathLine : '—'}
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'quota-industry-picker-trigger flex min-h-[40px] w-full max-w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm',
          !hasSelection && 'text-gray-400',
          hasSelection && 'text-gray-900',
        )}
        >
        <span className="min-w-0 flex-1 pr-2 text-left">
          {hasSelection ? (
            <span className="line-clamp-3 block text-[12px] leading-snug text-blue-800">{gbPathLine}</span>
          ) : (
            <span className="line-clamp-2">{placeholder}</span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden />
      </button>

      <Drawer
        placement="bottom"
        height="82%"
        closable={false}
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        classNames={{ mask: '!bg-black/45' }}
        rootClassName="[&_.ant-drawer-content]:rounded-t-[14px]"
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-gray-100 px-4 py-3">
          <span className="text-center text-[15px] font-bold text-blue-600">请选择行业类别</span>
          <button
            type="button"
            className="absolute right-3 top-2.5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="关闭"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 border-b border-gray-100 bg-slate-50/95 px-3 py-3">
          <div className="flex gap-2">
            <div className="flex w-4 shrink-0 flex-col items-center pt-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              {breadcrumbGbSegments.length > 0 && (
                <span className="mt-0.5 min-h-[12px] w-px flex-1 bg-blue-200" />
              )}
              {breadcrumbGbSegments.map((_, i) => (
                <React.Fragment key={i}>
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                  {i < breadcrumbGbSegments.length - 1 && (
                    <span className="mt-0.5 min-h-[12px] w-px flex-1 bg-blue-200" />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => goToBreadcrumbIndex(0)}
              >
                <span className={cn('text-[13px]', stack.length === 0 ? 'font-bold text-blue-600' : 'text-gray-500')}>
                  请选择行业类别
                </span>
                <ChevronRight size={14} className="shrink-0 text-gray-300" />
              </button>
              {breadcrumbGbSegments.map((seg, idx) => {
                const isLast = idx === breadcrumbGbSegments.length - 1;
                return (
                  <button
                    key={`${seg}_${idx}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => goToBreadcrumbIndex(idx + 1)}
                  >
                    <span
                      className={cn(
                        'min-w-0 flex-1 break-all text-[13px] leading-snug',
                        isLast ? 'font-bold text-blue-600' : 'text-gray-800',
                      )}
                    >
                      {seg}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pb-2 pt-3">
          <div className="text-[12px] font-semibold text-gray-500">{stepTitle}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {currentList.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400">暂无下级分类</div>
          ) : (
            <ul className="space-y-0.5">
              {currentList.map((node) => {
                const leaf = !node.children?.length;
                const checked = leaf && isLeafRowChecked(node);
                const seg = nodeSegment(node);
                return (
                  <li key={node.value}>
                    <button
                      type="button"
                      onClick={() => handlePick(node)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-left active:bg-gray-50',
                        checked && 'bg-blue-50/90',
                      )}
                    >
                      <span className="min-w-0 flex-1 pr-2 text-left">
                        <span
                          className={cn(
                            'block break-all text-[14px] leading-snug',
                            checked ? 'font-semibold text-blue-700' : 'text-gray-900',
                          )}
                        >
                          {seg}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-500">{node.label}</span>
                      </span>
                      {leaf && checked ? (
                        <Check size={20} className="shrink-0 text-blue-600" strokeWidth={2.5} />
                      ) : (
                        <ChevronRight size={18} className="shrink-0 text-gray-300" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Drawer>
    </>
  );
}
