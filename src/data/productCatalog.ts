/** 产品名录库：门类 → 大类 → 中类 → 小类（四级叶节点含产品列表，演示数据） */

export interface FineIndustry {
  value: string;
  label: string;
  /** 国标风格分段，如 C14411-发酵乳制品制造（用于展示 H62-餐饮业 同类路径） */
  gbSegment?: string;
  /** 是否为火电等特殊模板（需填报消耗水量等） */
  isThermalPower?: boolean;
  products: string[];
}

export interface SmallIndustry {
  value: string;
  label: string;
  gbSegment?: string;
  children: FineIndustry[];
}

export interface MidIndustry {
  value: string;
  label: string;
  gbSegment?: string;
  children: SmallIndustry[];
}

export interface MajorIndustry {
  value: string;
  label: string;
  gbSegment?: string;
  children: MidIndustry[];
}

/** 在指定名录树根列表中解析四级路径对应的叶节点（优先匹配靠前树根） */
export function findFineIndustryFromRoots(
  roots: MajorIndustry[],
  path: string[] | undefined,
): FineIndustry | undefined {
  if (!path || path.length !== 4) return undefined;
  const [majorVal, midVal, smallVal, fineVal] = path;
  const ma = roots.find((m) => m.value === majorVal);
  const mid = ma?.children.find((x) => x.value === midVal);
  const sm = mid?.children.find((x) => x.value === smallVal);
  return sm?.children.find((f) => f.value === fineVal);
}

/** 根据四级行业 value 查找细类叶节点配置（默认名录库） */
export function findFineIndustry(
  majorVal: string | undefined,
  midVal: string | undefined,
  smallVal: string | undefined,
  fineVal: string | undefined,
): FineIndustry | undefined {
  if (!majorVal || !midVal || !smallVal || !fineVal) return undefined;
  return findFineIndustryFromRoots(PRODUCT_CATALOG, [majorVal, midVal, smallVal, fineVal]);
}

/** 四级路径对应的展示文案；extraRoots 优先匹配（用户自定义行业类别） */
export function getIndustryPathLabels(path: string[] | undefined, extraRoots: MajorIndustry[] = []): string {
  if (!path?.length) return '';
  const [majorVal, midVal, smallVal, fineVal] = path;
  const searchRoots = extraRoots.length > 0 ? [...extraRoots, ...PRODUCT_CATALOG] : PRODUCT_CATALOG;
  for (const catalog of searchRoots) {
    if (catalog.value !== majorVal) continue;
    const mid = catalog.children.find((x) => x.value === midVal);
    const sm = mid?.children.find((x) => x.value === smallVal);
    const fi = fineVal ? sm?.children.find((x) => x.value === fineVal) : undefined;
    const parts = [catalog.label, mid?.label, sm?.label, fi?.label].filter(Boolean) as string[];
    if (parts.length >= path.length) return parts.slice(0, path.length).join(' / ');
  }
  return path.join(' / ');
}

/** 四级路径对应的国标风格展示串，如 C14-食品制造业/C144-乳制品制造/…（与名录 gbSegment 一致） */
export function getIndustryPathGbDisplay(path: string[] | undefined, extraRoots: MajorIndustry[] = []): string {
  if (!path?.length) return '';
  const segs = gbSegmentsAlongPath(path, extraRoots);
  return segs.filter(Boolean).join('/');
}

function gbSegmentsAlongPath(path: string[], extraRoots: MajorIndustry[]): string[] {
  if (!path.length) return [];
  const [majorVal, midVal, smallVal, fineVal] = path;
  const searchRoots = extraRoots.length > 0 ? [...extraRoots, ...PRODUCT_CATALOG] : PRODUCT_CATALOG;
  const catalog = searchRoots.find((m) => m.value === majorVal);
  if (!catalog) return [];
  const out: string[] = [segmentOrFallback(catalog.gbSegment, catalog.value, catalog.label)];
  if (path.length < 2) return out;
  const mid = catalog.children.find((x) => x.value === midVal);
  if (!mid) return out;
  out.push(segmentOrFallback(mid.gbSegment, mid.value, mid.label));
  if (path.length < 3) return out;
  const sm = mid.children.find((x) => x.value === smallVal);
  if (!sm) return out;
  out.push(segmentOrFallback(sm.gbSegment, sm.value, sm.label));
  if (path.length < 4) return out;
  const fi = sm.children.find((x) => x.value === fineVal);
  if (!fi) return out;
  out.push(segmentOrFallback(fi.gbSegment, fi.value, fi.label));
  return out;
}

function segmentOrFallback(gb: string | undefined, value: string, label: string): string {
  return gb?.trim() || `${value}-${label}`;
}

export const PRODUCT_CATALOG: MajorIndustry[] = [
  {
    value: 'food',
    label: '食品制造业',
    gbSegment: 'C14-食品制造业',
    children: [
      {
        value: 'dairy',
        label: '乳制品制造',
        gbSegment: 'C144-乳制品制造',
        children: [
          {
            value: 'fermented_cat',
            label: '发酵乳制品',
            gbSegment: 'C1441-发酵乳制品',
            children: [
              {
                value: 'fermented',
                label: '发酵乳制品制造',
                gbSegment: 'C14411-发酵乳制品制造',
                products: ['酸奶', '风味发酵乳', '巴氏杀菌乳'],
              },
            ],
          },
          {
            value: 'liquid_cat',
            label: '液体乳',
            gbSegment: 'C1442-液体乳',
            children: [
              {
                value: 'liquid',
                label: '液体乳制造',
                gbSegment: 'C14421-液体乳制造',
                products: ['灭菌乳', '调制乳'],
              },
            ],
          },
        ],
      },
      {
        value: 'beverage',
        label: '饮料制造',
        gbSegment: 'C152-饮料制造',
        children: [
          {
            value: 'bottled_cat',
            label: '瓶装饮用水',
            gbSegment: 'C1521-瓶装饮用水',
            children: [
              {
                value: 'bottled',
                label: '瓶装饮用水制造',
                gbSegment: 'C15211-瓶装饮用水制造',
                products: ['纯净水', '矿泉水'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    value: 'power',
    label: '电力、热力生产和供应业',
    gbSegment: 'D44-电力、热力生产和供应业',
    children: [
      {
        value: 'thermal',
        label: '热电联产',
        gbSegment: 'D441-热电联产',
        children: [
          {
            value: 'coal_group',
            label: '燃煤发电',
            gbSegment: 'D4411-燃煤发电',
            children: [
              {
                value: 'coal_fire',
                label: '燃煤发电',
                gbSegment: 'D44111-燃煤发电',
                isThermalPower: true,
                products: ['燃煤发电机组供电', '燃煤发电机组供热'],
              },
            ],
          },
        ],
      },
      {
        value: 'renew',
        label: '生物质发电',
        gbSegment: 'D442-生物质发电',
        children: [
          {
            value: 'bio_group',
            label: '生物质能利用',
            gbSegment: 'D4421-生物质能利用',
            children: [
              {
                value: 'bio_power',
                label: '生物质能发电',
                gbSegment: 'D44211-生物质能发电',
                products: ['生物质发电机组'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    value: 'chem',
    label: '化学原料和化学制品制造业',
    gbSegment: 'C26-化学原料和化学制品制造业',
    children: [
      {
        value: 'basic',
        label: '基础化学原料制造',
        gbSegment: 'C261-基础化学原料制造',
        children: [
          {
            value: 'acid_cat',
            label: '无机酸',
            gbSegment: 'C2611-无机酸',
            children: [
              {
                value: 'acid',
                label: '无机酸制造',
                gbSegment: 'C26111-无机酸制造',
                products: ['硫酸', '盐酸'],
              },
            ],
          },
        ],
      },
    ],
  },
];

/** 名录中单个产品（含四级行业路径，供定额查询等） */
export type CatalogProductEntry = {
  productName: string;
  pathLabels: string;
  pathValues: string[];
};

/** 扁平化全部定额产品库（演示名录） */
export function listAllCatalogProducts(): CatalogProductEntry[] {
  const out: CatalogProductEntry[] = [];
  for (const ma of PRODUCT_CATALOG) {
    for (const mid of ma.children) {
      for (const sm of mid.children) {
        for (const fi of sm.children) {
          const pathLabels = [ma.label, mid.label, sm.label, fi.label].join(' / ');
          const pathValues = [ma.value, mid.value, sm.value, fi.value];
          for (const p of fi.products) {
            out.push({ productName: p, pathLabels, pathValues });
          }
        }
      }
    }
  }
  return out;
}
