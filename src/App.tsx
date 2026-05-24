/** @license SPDX-License-Identifier: Apache-2.0 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  ConfigProvider,
  Button,
  Input,
  Form,
  Select,
  DatePicker,
  Upload,
  Modal,
  App as AntdApp,
  Checkbox,
  Divider,
  Card,
  Tag,
} from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home as HomeIcon, 
  Bell, 
  User as UserIcon, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Settings,
  Phone,
  Search,
  MessageSquare,
  Plus,
  Package,
  Droplets,
  FileBarChart,
  RefreshCw,
  Settings2,
  PenTool,
  ClipboardList,
  Factory,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  FileEdit,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart,
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { UserType, COMMON_SERVICES } from './types.ts';
import { loginResolveUserType } from './services/authService.ts';
import { PublicWaterSupplyLogo } from './components/icons/PublicWaterSupplyLogo.tsx';
import { IndustryPathBottomPicker, type IndustryTreeNode } from './components/IndustryPathBottomPicker.tsx';
import { askGemini } from './services/geminiService.ts';
import {
  PRODUCT_CATALOG,
  findFineIndustryFromRoots,
  getIndustryPathLabels,
  listAllCatalogProducts,
  type CatalogProductEntry,
  type MajorIndustry,
} from './data/productCatalog.ts';
import {
  loadApprovalsWithDemos,
  countByStatus,
  addApprovalRecord,
  approvalKindLabel,
  updateApprovalStatus,
  type ApprovalRecord,
} from './services/approvalService.ts';
import {
  addApprovedProductForIndustry,
  getApprovedProductNamesForIndustry,
  getApprovedProductUnit,
} from './services/productApplyService.ts';

dayjs.locale('zh-cn');

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LS_ENTERPRISE_COMPLETE = 'enterpriseProfileComplete';
/** 企业注册「主要产品及生产能力」原文，定额查询默认匹配本单位产品 */
const LS_ENTERPRISE_MAIN_PRODUCTS = 'enterpriseMainProducts';
/** 企业注册所选水源类型（与定额页辅助填报等联动；公共供水户必含自来水） */
const LS_ENTERPRISE_WATER_SOURCES = 'enterpriseWaterSourceTypes';
/** 企业注册「用水户名称」，定额对标基本情况自动带出 */
const LS_ENTERPRISE_USER_NAME = 'enterpriseUserName';

function getEnterpriseWaterSourceTypes(): string[] | null {
  try {
    const raw = localStorage.getItem(LS_ENTERPRISE_WATER_SOURCES);
    if (raw == null || raw === '') return null;
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as string[]) : null;
  } catch {
    return null;
  }
}

/** 是否展示定额中的该项水源填报：未存过企业水源（旧数据）时三项均展示 */
function showQuotaAuxiliaryWaterField(enterpriseKey: string): boolean {
  const t = getEnterpriseWaterSourceTypes();
  if (t == null || t.length === 0) return true;
  return t.includes(enterpriseKey);
}

function isEnterpriseRegComplete(): boolean {
  try {
    return localStorage.getItem(LS_ENTERPRISE_COMPLETE) === 'true';
  } catch {
    return false;
  }
}

// --- Components ---

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
    className="min-h-screen pb-20 bg-gray-50"
  >
    {children}
  </motion.div>
);

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { key: '/home', label: '首页', icon: HomeIcon },
    { key: '/messages', label: '消息', icon: Bell, badge: 1 },
    { key: '/profile', label: '我的', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-gray-50 flex items-center justify-around z-[100] pb-safe px-6">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            className={cn(
              "flex flex-col items-center justify-center space-y-1 relative transition-all duration-300 px-3 py-1.5 rounded-2xl",
              isActive ? "bg-blue-500/5" : ""
            )}
          >
            <div className="relative">
              <tab.icon 
                size={24} 
                className={isActive ? "text-blue-600" : "text-gray-400"} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-lg">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                 <motion.div 
                    layoutId="activeTab"
                    className="absolute -inset-2 bg-blue-500/10 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                 />
              )}
            </div>
            <span className={cn(
              "text-[10px] font-bold transition-colors",
              isActive ? "text-blue-600" : "text-gray-400"
            )}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

/** 子功能占位（现场抄表、换表等未接 API 的入口） */
const ServicePlaceholderPage = ({ title }: { title: string }) => {
  const navigate = useNavigate();
  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h2 className="flex-1 text-center font-bold text-lg">{title}</h2>
      </div>
      <div className="p-8 text-center text-gray-500 text-sm leading-relaxed">
        <p>{title}功能接入中，敬请期待。</p>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 仅公共供水户可访问部分页面；自备水用户跳转回「我的」 */
function WaterSavingOnlyRoute({ children }: { children: React.ReactNode }) {
  const ut = localStorage.getItem('userType') as UserType | null;
  if (ut !== 'WATER_SAVING') return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

/** 公共供水户未完成企业注册时，拦截业务子页（首页除外） */
function WaterSavingFeatureGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const ut = localStorage.getItem('userType') as UserType | null;
  if (ut !== 'WATER_SAVING') return <>{children}</>;
  if (isEnterpriseRegComplete()) return <>{children}</>;
  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10 shadow-sm">
        <button type="button" onClick={() => navigate(-1)} aria-label="返回">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">功能暂不可用</h2>
      </div>
      <div className="mx-auto max-w-md px-6 py-14 text-center">
        <p className="text-sm leading-relaxed text-gray-600 mb-8">
          请先完成「企业注册」并完善资料后，再使用计划申请、定额对标、查询、智能问答及其他业务模块。
        </p>
        <Button type="primary" size="large" className="w-full max-w-xs" onClick={() => navigate('/enterprise-reg')}>
          前往企业注册
        </Button>
      </div>
      <NavBar />
    </PageWrapper>
  );
}

const MORE_ENTRIES: { name: string; path: string; icon: typeof FileBarChart; desc: string }[] = [
  { name: '现场抄表', path: '/meter-reading', icon: FileBarChart, desc: '抄表数据上传与核对' },
  { name: '换表管理', path: '/meter-manage', icon: RefreshCw, desc: '换表登记与进度' },
  { name: '产品确认', path: '/product-confirm', icon: Package, desc: '产品信息维护' },
  { name: '产品申请', path: '/product-apply', icon: Plus, desc: '名录外产品新增申请' },
  { name: '定额对标', path: '/quota-investigate', icon: PenTool, desc: '定额产品与对标' },
  { name: '计划申请', path: '/plan-apply', icon: ClipboardList, desc: '用水计划申请' },
  { name: '计划调整', path: '/plan-adjust', icon: Settings2, desc: '计划变更调整' },
  { name: '用水总结', path: '/usage-summary', icon: Droplets, desc: '用水分析总结' },
];

/** 公共供水户首页/更多不展示现场抄表、换表；自备水户展示 */
const MORE_PATHS_ONLY_SELF = new Set(['/meter-reading', '/meter-manage']);
function getMoreEntriesForUserType(ut: UserType) {
  if (ut === 'WATER_SAVING') {
    return MORE_ENTRIES.filter((e) => !MORE_PATHS_ONLY_SELF.has(e.path));
  }
  return MORE_ENTRIES;
}

/** 首页公共供水户快捷入口项 */
type HomeQuickEntryItem = {
  path: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
};

const SAVING_PRIMARY_HOME_ENTRIES: HomeQuickEntryItem[] = [
  { path: '/plan-apply', name: '计划申请', desc: '用水计划申请', icon: ClipboardList, accent: 'bg-[#EFF6FF] text-blue-700' },
  { path: '/quota-investigate', name: '定额对标', desc: '定额产品与对标', icon: PenTool, accent: 'bg-[#ECFEFF] text-cyan-700' },
  { path: '/quota-query', name: '定额查询', desc: '标准与测算查询', icon: Search, accent: 'bg-[#F5F3FF] text-violet-700' },
  { path: '/smart-qa', name: '智能问答', desc: '用水数据问答', icon: MessageSquare, accent: 'bg-[#F0FDF4] text-emerald-700' },
];

function buildWaterSavingHomeCatalog(): HomeQuickEntryItem[] {
  const out: HomeQuickEntryItem[] = SAVING_PRIMARY_HOME_ENTRIES.map((x) => ({ ...x }));
  const seen = new Set(out.map((x) => x.path));
  const extraAccents = [
    'bg-amber-50 text-amber-800',
    'bg-slate-50 text-slate-700',
    'bg-orange-50 text-orange-700',
    'bg-indigo-50 text-indigo-700',
  ];
  let i = 0;
  for (const m of getMoreEntriesForUserType('WATER_SAVING')) {
    if (seen.has(m.path)) continue;
    seen.add(m.path);
    out.push({
      path: m.path,
      name: m.name,
      desc: m.desc,
      icon: m.icon,
      accent: extraAccents[i % extraAccents.length]!,
    });
    i++;
  }
  return out;
}

const LS_HOME_QUICK_ENTRY_PATHS = 'homeQuickEntryPaths.v1';
const DEFAULT_HOME_QUICK_PATHS: readonly string[] = [
  '/plan-apply',
  '/quota-investigate',
  '/quota-query',
  '/smart-qa',
];

function loadHomeQuickEntryPaths(): string[] | null {
  try {
    const raw = localStorage.getItem(LS_HOME_QUICK_ENTRY_PATHS);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function saveHomeQuickEntryPaths(paths: string[]) {
  localStorage.setItem(LS_HOME_QUICK_ENTRY_PATHS, JSON.stringify(paths));
}

function pickHomeQuickEntries(catalog: HomeQuickEntryItem[], saved: string[] | null): HomeQuickEntryItem[] {
  const map = new Map(catalog.map((e) => [e.path, e]));
  const ids = saved && saved.length > 0 ? saved : [...DEFAULT_HOME_QUICK_PATHS];
  const ordered = ids.map((p) => map.get(p)).filter((x): x is HomeQuickEntryItem => x != null);
  if (ordered.length === 0) {
    return [...DEFAULT_HOME_QUICK_PATHS].map((p) => map.get(p)).filter((x): x is HomeQuickEntryItem => x != null);
  }
  return ordered;
}

/** 仅自备水可访问的抄表类占位页，公共供水户访问时回首页 */
function SelfProvidedServiceRoute({ title }: { title: string }) {
  const ut = localStorage.getItem('userType') as UserType | null;
  if (ut === 'WATER_SAVING') return <Navigate to="/home" replace />;
  return <ServicePlaceholderPage title={title} />;
}

const MorePage = () => {
  const navigate = useNavigate();
  const userType = localStorage.getItem('userType') as UserType;
  const moreList = getMoreEntriesForUserType(userType);
  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h2 className="flex-1 text-center font-bold text-lg">更多功能</h2>
      </div>
      <div className="p-4 space-y-3 pb-24">
        {moreList.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className="w-full bg-white rounded-[10px] p-4 shadow-sm border border-gray-100 flex items-center text-left active:bg-gray-50"
          >
            <div className="w-11 h-11 rounded-[10px] bg-blue-50 flex items-center justify-center text-blue-600 mr-3">
              <item.icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 公共供水户：勾选首页快捷入口展示项（本机存储） */
const QuickEntryCustomizePage = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const userType = localStorage.getItem('userType') as UserType | null;

  const catalog = useMemo(() => buildWaterSavingHomeCatalog(), []);

  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => {
    const s = loadHomeQuickEntryPaths();
    if (s && s.length > 0) return [...s];
    return [...DEFAULT_HOME_QUICK_PATHS];
  });

  useEffect(() => {
    const s = loadHomeQuickEntryPaths();
    if (s && s.length > 0) setSelectedPaths([...s]);
    else setSelectedPaths([...DEFAULT_HOME_QUICK_PATHS]);
  }, [location.key]);

  if (userType !== 'WATER_SAVING') {
    return <Navigate to="/home" replace />;
  }

  const togglePath = (path: string, checked: boolean) => {
    if (!checked) {
      if (selectedPaths.length <= 1) {
        message.warning('请至少保留一个快捷入口');
        return;
      }
      setSelectedPaths((prev) => prev.filter((p) => p !== path));
      return;
    }
    setSelectedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
  };

  const handleSave = () => {
    if (selectedPaths.length === 0) {
      message.warning('请至少保留一个快捷入口');
      return;
    }
    saveHomeQuickEntryPaths(selectedPaths);
    message.success('已保存到首页');
    navigate(-1);
  };

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)} aria-label="返回">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">快捷入口</h2>
      </div>
      <div className="p-5 pb-28">
        <p className="mb-4 text-xs leading-relaxed text-gray-500">
          勾选需要显示在首页「快捷入口」的模块（至少一项），保存后立即生效。
        </p>
        <div className="space-y-2">
          {catalog.map((item) => {
            const checked = selectedPaths.includes(item.path);
            return (
              <div
                key={item.path}
                className="flex items-center gap-3 rounded-[10px] border border-gray-100 bg-white p-3 shadow-sm"
              >
                <Checkbox checked={checked} onChange={(e) => togglePath(item.path, e.target.checked)} />
                <div className={cn('inline-flex shrink-0 rounded-[10px] p-2', item.accent)}>
                  <item.icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900">{item.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <Button type="primary" block className="mt-6 h-12 font-bold" onClick={handleSave}>
          保存到首页
        </Button>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

// --- Pages ---

const LoginPage = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    try {
      const userType = await loginResolveUserType(values.username, values.password);
      localStorage.setItem('userType', userType);
      localStorage.removeItem('tempUserType');
      localStorage.setItem('isLoggedIn', 'true');
      message.success('登录成功');
      navigate('/home');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const loginLabel = 'text-sm font-semibold text-gray-800';
  const loginField =
    'h-12 rounded-xl border border-gray-200 bg-gray-50 text-sm font-normal text-gray-900 placeholder:text-gray-400 px-4 hover:border-gray-300 focus:border-blue-500';
  const LoginLab = ({ children }: { children: React.ReactNode }) => <span className={loginLabel}>{children}</span>;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white px-6 py-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-md flex-1">
        <header className="mb-10">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-gray-900">系统登录</h1>
          <p className="mt-2 text-sm font-normal leading-relaxed text-gray-500">
            请输入管理端已开户的账号；系统将自动识别公共供水户或自备水身份。
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
            演示账号：公共供水户 <span className="font-mono text-slate-800">test_user</span> /{' '}
            <span className="font-mono">123456</span>；自备水{' '}
            <span className="font-mono text-slate-800">admin_water</span> / <span className="font-mono">12345</span>
            （登录后首页与可点模块不同）
          </p>
        </header>

        <Form layout="vertical" onFinish={onFinish} className="flex flex-col gap-5">
          <Form.Item name="username" label={<LoginLab>账号</LoginLab>} rules={[{ required: true, message: '请输入账号' }]}>
            <Input size="large" placeholder="请输入账号" className={loginField} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label={<LoginLab>密码</LoginLab>} rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" placeholder="请输入密码" className={loginField} autoComplete="current-password" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            className="mt-2 h-12 w-full rounded-xl border-none bg-blue-600 text-base font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-500"
          >
            <span className="flex items-center justify-center gap-2">
              进入系统
              <ChevronRight size={18} strokeWidth={2.5} />
            </span>
          </Button>
        </Form>
      </div>
    </div>
  );
};

/** 首页自备水柱状图：本年 1～12 月各月演示值，按自然月截取至当月 */
const HOME_MONTH_BAR_TEMPLATE: readonly { v1: number; v2: number; v3: number }[] = [
  { v1: 1100, v2: 500, v3: 200 },
  { v1: 750, v2: 450, v3: 150 },
  { v1: 1300, v2: 600, v3: 500 },
  { v1: 650, v2: 400, v3: 100 },
  { v1: 650, v2: 500, v3: 100 },
  { v1: 950, v2: 300, v3: 400 },
  { v1: 750, v2: 450, v3: 150 },
  { v1: 850, v2: 500, v3: 200 },
  { v1: 1400, v2: 600, v3: 550 },
  { v1: 600, v2: 300, v3: 100 },
  { v1: 850, v2: 500, v3: 150 },
  { v1: 1150, v2: 700, v3: 650 },
];

/** 统计看板内图表：数据点多时总宽度大于视口，配合 overflow-x 横向滑动 */
function scrollableChartInnerWidthPx(dataPointCount: number, perPointPx = 52) {
  return Math.max(320, dataPointCount * perPointPx);
}

const HomePage = () => {
  const { message } = AntdApp.useApp();
  const userType = localStorage.getItem('userType') as UserType;
  const navigate = useNavigate();
  const location = useLocation();
  const locked = userType === 'WATER_SAVING' && !isEnterpriseRegComplete();

  /** 与审批记录页一致合并演示数据，便于首页统计展示已通过/已驳回示例 */
  const approvalList = useMemo(() => loadApprovalsWithDemos(), [location.key]);
  const approvalCounts = useMemo(() => countByStatus(approvalList), [approvalList]);

  const [enterpriseTipOpen, setEnterpriseTipOpen] = useState(() => {
    try {
      const ut = localStorage.getItem('userType') as UserType | null;
      return (
        ut === 'WATER_SAVING' &&
        !isEnterpriseRegComplete() &&
        sessionStorage.getItem('enterpriseWelcomeShown') !== '1'
      );
    } catch {
      return false;
    }
  });

  const dismissEnterpriseTip = () => {
    sessionStorage.setItem('enterpriseWelcomeShown', '1');
    setEnterpriseTipOpen(false);
  };

  const handleSavingNav = (path: string) => {
    // 未建档时允许计划申请、快捷入口自定义、我的申请；其余业务页需先完成企业注册
    const basePath = path.split('?')[0] ?? path;
    if (locked && basePath !== '/plan-apply' && basePath !== '/quick-entry-customize' && basePath !== '/my-applications') {
      message.warning('请先完成企业注册');
      return;
    }
    navigate(path);
  };

  const [waterTypeTab, setWaterTypeTab] = useState<'surface' | 'under' | 'tap'>('surface');
  /** 统计看板：用水 / 定额；定额时间范围；水量按月或按年 */
  const [statBoardTab, setStatBoardTab] = useState<'quota' | 'water'>('water');
  const [quotaTimeRange, setQuotaTimeRange] = useState<'3y' | '5y' | 'all'>('3y');
  const [waterStatGranularity, setWaterStatGranularity] = useState<'month' | 'year'>('month');

  const statsData = [
    { name: '年计划水量', value: '1,200,000', color: 'text-blue-500', bg: 'bg-blue-50/80', unit: '立方米' },
    { name: '一至三季度水量', value: '900,000', color: 'text-purple-500', bg: 'bg-purple-50/80', unit: '立方米' },
    { name: '年累计用水量', value: '900,000', color: 'text-green-500', bg: 'bg-green-50/80', unit: '立方米' },
  ];

  const ymdTick = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${t.getMonth()}` as const;
  })();
  const waterBarChartYtd = useMemo(() => {
    const t = new Date();
    const upTo = t.getMonth() + 1;
    return Array.from({ length: upTo }, (_, i) => {
      const row = HOME_MONTH_BAR_TEMPLATE[i] ?? HOME_MONTH_BAR_TEMPLATE[HOME_MONTH_BAR_TEMPLATE.length - 1]!;
      return { name: `${i + 1}月`, ...row };
    });
  }, [ymdTick]);

  /** 定额：各产品单独年度序列（演示数据，「所有年份」约 10 年点，可横向滑动查看） */
  const quotaSeriesByProduct = useMemo(() => {
    type Row = { name: string; 单耗: number; 标准值: number; 先进值: number; 领跑值: number };
    const benchmarksAll = [
      { name: '2015', 标准值: 2.4, 先进值: 1.85, 领跑值: 1.5 },
      { name: '2016', 标准值: 2.35, 先进值: 1.8, 领跑值: 1.46 },
      { name: '2017', 标准值: 2.3, 先进值: 1.75, 领跑值: 1.42 },
      { name: '2018', 标准值: 2.2, 先进值: 1.68, 领跑值: 1.35 },
      { name: '2019', 标准值: 2.15, 先进值: 1.64, 领跑值: 1.32 },
      { name: '2020', 标准值: 2.1, 先进值: 1.6, 领跑值: 1.28 },
      { name: '2021', 标准值: 2.05, 先进值: 1.58, 领跑值: 1.25 },
      { name: '2022', 标准值: 2.0, 先进值: 1.55, 领跑值: 1.22 },
      { name: '2023', 标准值: 2.0, 先进值: 1.52, 领跑值: 1.2 },
      { name: '2024', 标准值: 1.95, 先进值: 1.48, 领跑值: 1.15 },
    ];
    const merge = (单耗列: number[]): Row[] =>
      benchmarksAll.map((b, i) => ({
        name: b.name,
        单耗: 单耗列[i]!,
        标准值: b.标准值,
        先进值: b.先进值,
        领跑值: b.领跑值,
      }));
    const products: { label: string; 单耗列: number[] }[] = [
      {
        label: '发电上网',
        单耗列: [2.3, 2.22, 2.15, 2.12, 2.08, 2.02, 1.95, 1.9, 1.88, 1.79],
      },
      {
        label: '冷却循环',
        单耗列: [2.1, 2.05, 1.99, 1.97, 1.95, 1.9, 1.82, 1.78, 1.72, 1.68],
      },
      {
        label: '辅助生产',
        单耗列: [1.92, 1.86, 1.82, 1.8, 1.78, 1.74, 1.68, 1.64, 1.58, 1.52],
      },
    ];
    const full = products.map((p) => ({
      productLabel: p.label,
      data: merge(p.单耗列),
    }));
    if (quotaTimeRange === '3y') {
      return full.map((item) => ({ ...item, data: item.data.slice(-3) }));
    }
    if (quotaTimeRange === '5y') {
      return full.map((item) => ({ ...item, data: item.data.slice(-5) }));
    }
    return full;
  }, [quotaTimeRange]);

  const waterVolumeByMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const rows: { name: string; 用水量: number }[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      rows.push({
        name: `${m}月`,
        用水量: Math.round(75000 + m * 2000 + (m % 3) * 900 + (y % 4) * 200),
      });
    }
    return rows;
  }, [ymdTick]);

  const waterVolumeByYear = useMemo(() => {
    const end = new Date().getFullYear();
    /** 近 10 个自然年（可横向滑动） */
    const start = end - 9;
    const rows: { name: string; 用水量: number }[] = [];
    for (let y = start; y <= end; y++) {
      const i = y - start;
      rows.push({
        name: `${y}年`,
        用水量: Math.round(920000 + i * 45000 + (i % 2) * 12000),
      });
    }
    return rows;
  }, []);

  const waterSavingCatalog = useMemo(() => buildWaterSavingHomeCatalog(), []);
  const homeQuickDisplayed = useMemo(
    () => pickHomeQuickEntries(waterSavingCatalog, loadHomeQuickEntryPaths()),
    [waterSavingCatalog, location.key],
  );

  const sharedHeaderBanner = (
    <>
      <div className="relative overflow-hidden rounded-b-[20px] bg-[#0047AB] px-6 pb-12 pt-9 shadow-lg shadow-blue-900/20">
        <div className="absolute top-0 right-0 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl -mr-16 -mt-12" />
        <div className="relative z-10 mb-4">
          {/* 用水户名称：左上角；右上角铃铛已移除 */}
          <div className="flex items-start justify-start">
            <h3 className="max-w-full truncate text-left text-lg font-bold tracking-tight text-white">
              连云港协鑫生物质发电有限公司
            </h3>
          </div>
        </div>
        <div className="relative z-10 mt-5 transition-transform active:scale-[0.99]">
          <div
            className="relative h-36 overflow-hidden rounded-[12px] border border-white/20 shadow-xl shadow-black/25 ring-1 ring-white/10"
            role="img"
            aria-label="山水湖泊横幅配图"
          >
            <img
              src="/images/home-banner-landscape.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              decoding="async"
              draggable={false}
            />
            {/* 轻遮罩：保证左上角文案可读，同时尽量露出山水 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" aria-hidden />
            {/* 横幅图左上角：系统 Logo + 名称（替代原「水管家管理平台」与副标题） */}
            <div className="absolute left-3 top-3 z-10 flex min-w-0 max-w-[calc(100%-1.5rem)] items-center gap-2.5 pr-2 sm:left-4 sm:top-4">
              {userType === 'WATER_SAVING' ? (
                <>
                  <span
                    className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-900/55 via-emerald-900/45 to-cyan-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-teal-200/35 backdrop-blur-[2px] sm:h-[52px] sm:w-[52px]"
                    title="城镇公共供水管网入户类业务"
                  >
                    <PublicWaterSupplyLogo size={34} />
                  </span>
                  <span className="min-w-0 truncate rounded-lg bg-black/30 px-2.5 py-1 text-left text-sm font-bold leading-tight tracking-wide text-cyan-50 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] ring-1 ring-white/15 sm:text-base">
                    公共供水系统
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-900/55 via-emerald-900/45 to-cyan-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-teal-200/35 backdrop-blur-[2px] sm:h-[52px] sm:w-[52px]"
                    title="取水许可范围内自建取水与计量类业务"
                  >
                    <Factory size={30} className="text-emerald-100" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 truncate rounded-lg bg-black/30 px-2.5 py-1 text-left text-sm font-bold leading-tight tracking-wide text-emerald-50 backdrop-blur-[2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] ring-1 ring-white/15 sm:text-base">
                    自备水系统
                  </span>
                </>
              )}
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-1.5">
              <span className="w-4 h-1 rounded-full bg-white" />
              <span className="w-1.5 h-1 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (userType === 'WATER_SAVING') {
    return (
      <PageWrapper>
        {sharedHeaderBanner}
        <div className="px-5 -mt-10 relative z-20 space-y-4">
          {locked && (
            <div className="rounded-[12px] border-2 border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/80 px-4 py-4 shadow-md shadow-amber-900/10 ring-1 ring-amber-200/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="min-w-0 text-sm leading-relaxed text-amber-950">
                  <span className="mr-1 inline-flex shrink-0 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    提示
                  </span>
                  请先完成「企业注册」，通过后方可使用计划申请、定额对标、查询、智能问答等模块。
                </p>
                <Button
                  type="primary"
                  size="middle"
                  className="h-10 shrink-0 border-none px-5 font-bold shadow-lg shadow-blue-600/25 !bg-blue-600 hover:!bg-blue-500"
                  onClick={() => navigate('/enterprise-reg')}
                >
                  去填写企业注册
                </Button>
              </div>
            </div>
          )}
          <section className="bg-white rounded-[10px] p-3 shadow-sm shadow-blue-900/5">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
                <h4 className="text-[15px] font-bold text-gray-900">快捷入口</h4>
              </div>
              <button
                type="button"
                onClick={() => handleSavingNav('/quick-entry-customize')}
                className="shrink-0 text-xs font-bold text-blue-600 flex items-center"
              >
                查看更多
                <ChevronRight size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {homeQuickDisplayed.map((item) => (
                <motion.button
                  key={item.path}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSavingNav(item.path)}
                  className="rounded-[10px] border border-gray-100 p-2.5 text-left bg-white shadow-sm active:opacity-95"
                >
                  <div className={cn('mb-1.5 inline-flex rounded-[8px] p-1.5', item.accent)}>
                    <item.icon size={18} />
                  </div>
                  <div className="text-[13px] font-bold leading-snug text-gray-900">{item.name}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-snug">{item.desc}</div>
                </motion.button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-[10px] p-3 shadow-sm shadow-blue-900/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-4 bg-blue-600 rounded-full" />
                <h4 className="text-[15px] font-bold text-gray-900">审批记录</h4>
              </div>
              <button
                type="button"
                onClick={() => handleSavingNav('/my-applications?mode=all')}
                className="text-xs font-bold text-blue-600 flex items-center"
              >
                全部记录
                <ChevronRight size={14} className="ml-0.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-[10px] border border-amber-100 bg-amber-50/80 px-1.5 py-2 text-center">
                <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Clock size={14} />
                </div>
                <div className="text-[9px] font-bold text-gray-500">待审批</div>
                <div className="text-base font-black leading-tight text-amber-700">{approvalCounts.pending}</div>
              </div>
              <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/80 px-1.5 py-2 text-center">
                <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={14} />
                </div>
                <div className="text-[9px] font-bold text-gray-500">已通过</div>
                <div className="text-base font-black leading-tight text-emerald-700">{approvalCounts.approved}</div>
              </div>
              <div className="rounded-[10px] border border-rose-100 bg-rose-50/80 px-1.5 py-2 text-center">
                <div className="mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <XCircle size={14} />
                </div>
                <div className="text-[9px] font-bold text-gray-500">已驳回</div>
                <div className="text-base font-black leading-tight text-rose-700">{approvalCounts.rejected}</div>
              </div>
            </div>
          </section>

          <section className="relative mb-10 overflow-hidden rounded-[10px] bg-white shadow-sm shadow-blue-900/5">
            {locked && (
              <div className="pointer-events-auto absolute inset-0 z-[5] flex items-center justify-center rounded-[10px] bg-white/55 backdrop-blur-[1px]">
                <span className="px-4 text-center text-xs font-medium text-gray-500">完成企业注册后展示统计看板</span>
              </div>
            )}
            <div className="px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-4 w-1 shrink-0 rounded-full bg-blue-600" />
                <h4 className="text-base font-black text-gray-900">统计看板</h4>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-gray-500">
                切换下方标签页查看用水汇总或定额对标。
              </p>

              <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setStatBoardTab('water')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-[12px] font-bold transition-colors',
                    statBoardTab === 'water' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                  )}
                >
                  用水统计
                </button>
                <button
                  type="button"
                  onClick={() => setStatBoardTab('quota')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-[12px] font-bold transition-colors',
                    statBoardTab === 'quota' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                  )}
                >
                  定额统计
                </button>
              </div>

              {statBoardTab === 'water' && (
                <div>
                  <div className="mb-2 ml-1 text-[10px] font-bold text-gray-400">汇总指标（立方米）</div>
                  <div className="mb-3 grid grid-cols-3 gap-2.5">
                    {statsData.map((stat, idx) => (
                      <div key={idx} className={cn('relative overflow-hidden rounded-[10px] border border-white p-3', stat.bg)}>
                        <div className="mb-2 text-[10px] font-bold text-gray-400">{stat.name}</div>
                        <div className="flex items-baseline space-x-1">
                          <span className={cn('text-lg font-black tracking-tight', stat.color)}>{stat.value}</span>
                          <span className="text-[10px] font-medium text-gray-400">{stat.unit}</span>
                        </div>
                        <div className={cn('absolute -bottom-2 -right-2 opacity-5', stat.color)}>
                          <Droplets size={44} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-gray-500">
                      {waterStatGranularity === 'month' ? '单位：立方米' : '各年度累计用水（立方米）'}
                    </span>
                    <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setWaterStatGranularity('month')}
                        className={cn(
                          'rounded-md px-3 py-1 text-[11px] font-bold transition-colors',
                          waterStatGranularity === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                        )}
                      >
                        按月
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaterStatGranularity('year')}
                        className={cn(
                          'rounded-md px-3 py-1 text-[11px] font-bold transition-colors',
                          waterStatGranularity === 'year' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                        )}
                      >
                        按年
                      </button>
                    </div>
                  </div>
                  <div
                    className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
                    style={{ touchAction: 'pan-x' }}
                  >
                    <div
                      className="h-40 shrink-0"
                      style={{ width: scrollableChartInnerWidthPx(waterStatGranularity === 'month' ? waterVolumeByMonth.length : waterVolumeByYear.length) }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        {waterStatGranularity === 'month' ? (
                          <BarChart data={waterVolumeByMonth} margin={{ left: 0, right: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                              dy={8}
                              interval={0}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} width={36} />
                            <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                            <Bar dataKey="用水量" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
                          </BarChart>
                        ) : (
                          <LineChart data={waterVolumeByYear} margin={{ left: 0, right: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 600 }}
                              dy={8}
                              interval={0}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} width={36} />
                            <Tooltip cursor={{ stroke: '#93c5fd' }} />
                            <Line
                              type="monotone"
                              dataKey="用水量"
                              stroke="#2563eb"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {statBoardTab === 'quota' && (
                <div>
                  <div className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2.5 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50/95 to-sky-50/40 px-3 py-2.5 shadow-sm shadow-slate-900/[0.03]">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span className="h-3 w-3 rounded-md bg-gradient-to-b from-sky-300 to-sky-700 shadow-sm" aria-hidden />
                      单耗
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span className="h-0 w-5 rounded-full border-t-[2.5px] border-[#9333ea]" aria-hidden />
                      领跑值
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span className="h-0 w-5 rounded-full border-t-[2.5px] border-[#059669]" aria-hidden />
                      先进值
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span className="h-0 w-5 rounded-full border-t-[2.5px] border-[#ea580c]" aria-hidden />
                      通用值
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="shrink-0 text-[10px] font-bold text-gray-400">统计区间</span>
                    <div className="flex min-w-0 flex-1 justify-end rounded-lg bg-gray-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuotaTimeRange('3y')}
                        className={cn(
                          'flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:flex-none sm:px-3',
                          quotaTimeRange === '3y' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                        )}
                      >
                        近3年
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuotaTimeRange('5y')}
                        className={cn(
                          'flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:flex-none sm:px-3',
                          quotaTimeRange === '5y' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                        )}
                      >
                        近5年
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuotaTimeRange('all')}
                        className={cn(
                          'flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors sm:flex-none sm:px-3',
                          quotaTimeRange === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
                        )}
                      >
                        所有年份
                      </button>
                    </div>
                  </div>

                  <div className="mb-1 text-[10px] font-bold text-gray-500">各产品单耗与对标线（m³/单位）</div>
                  <div className="space-y-3">
                    {quotaSeriesByProduct.map(({ productLabel, data }, idx) => (
                      <div
                        key={productLabel}
                        className="rounded-2xl border border-slate-100/90 bg-gradient-to-br from-slate-50/95 via-white to-sky-50/40 p-3 shadow-sm shadow-slate-900/[0.04] ring-1 ring-white/80"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-1 w-1 rounded-full bg-sky-500" aria-hidden />
                          <span className="text-[13px] font-bold tracking-tight text-slate-800">{productLabel}</span>
                        </div>
                        <div
                          className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]"
                          style={{ touchAction: 'pan-x' }}
                        >
                          <div
                            className="h-[200px] shrink-0"
                            style={{ width: scrollableChartInnerWidthPx(data.length, 50) }}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
                              <defs>
                                <linearGradient id={`quotaBar-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#7dd3fc" />
                                  <stop offset="45%" stopColor="#38bdf8" />
                                  <stop offset="100%" stopColor="#0369a1" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e2e8f0" strokeOpacity={0.85} />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                                dy={10}
                                interval={0}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                width={40}
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))}
                              />
                              <Tooltip
                                isAnimationActive={false}
                                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: 'none',
                                  boxShadow: '0 12px 40px -14px rgba(15, 23, 42, 0.35)',
                                  padding: '10px 14px',
                                }}
                                labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12, marginBottom: 6 }}
                                itemSorter={(item) => quotaTooltipItemRank(item)}
                                formatter={(value: number | string, name: string) =>
                                  [typeof value === 'number' ? Number(value).toFixed(2) : value, name]
                                }
                              />
                              <Bar
                                dataKey="单耗"
                                fill={`url(#quotaBar-${idx})`}
                                radius={[10, 10, 4, 4]}
                                barSize={Math.min(26, Math.max(8, 320 / Math.max(data.length, 1)))}
                                maxBarSize={32}
                                isAnimationActive
                              />
                              <Line
                                type="monotone"
                                dataKey="领跑值"
                                stroke="#9333ea"
                                strokeWidth={2.25}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                dot={{ r: 4, fill: '#fff', stroke: '#9333ea', strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                              />
                              <Line
                                type="monotone"
                                dataKey="先进值"
                                stroke="#059669"
                                strokeWidth={2.25}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                dot={{ r: 4, fill: '#fff', stroke: '#059669', strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                              />
                              <Line
                                type="monotone"
                                name="通用值"
                                dataKey="标准值"
                                stroke="#ea580c"
                                strokeWidth={2.25}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                dot={{ r: 4, fill: '#fff', stroke: '#ea580c', strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                                isAnimationActive
                              />
                            </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
        <Modal
          title="温馨提示"
          open={enterpriseTipOpen}
          onOk={dismissEnterpriseTip}
          onCancel={dismissEnterpriseTip}
          okText="我知道了"
          cancelButtonProps={{ style: { display: 'none' } }}
        >
          <p className="text-sm leading-relaxed text-gray-600">
            您已成功登录。请先点击首页上方提示中的「去填写」完成<strong className="text-gray-900">企业注册</strong>
            ，企业资料完善后方可使用计划申请、定额对标等模块。
          </p>
        </Modal>
        <NavBar />
      </PageWrapper>
    );
  }

  /* 自备水用户首页：沿用抄表与大屏统计 + 12 个月柱状图 */
  const selfServices = COMMON_SERVICES;

  return (
    <PageWrapper>
      {sharedHeaderBanner}
      <div className="px-5 -mt-10 relative z-20 space-y-6">
        <section className="bg-white rounded-[10px] p-6 shadow-sm shadow-blue-900/5">
          <div className="flex items-center space-x-2 mb-5">
            <div className="w-1 h-4 bg-blue-600 rounded-full" />
            <h4 className="text-base font-bold text-gray-900">管理服务</h4>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/meter-reading')}
              className="bg-[#F0F7FF] p-5 rounded-[10px] border border-blue-50 relative group overflow-hidden"
            >
              <div className="relative z-10">
                <h5 className="text-[#1E4D9C] font-bold text-lg mb-0.5">现场抄表</h5>
                <p className="text-[#5B89D4] text-[10px] font-bold tracking-wider mb-2">现场抄表</p>
                <p className="text-[#9DB8E6] text-[10px]">快速抄表, 数据实时上传</p>
              </div>
              <div className="absolute -right-1 bottom-6 text-[#3B82F6] opacity-10 group-hover:scale-110 transition-transform">
                <FileBarChart size={70} strokeWidth={1} />
              </div>
              <div className="absolute right-5 bottom-8 bg-white p-2 rounded-[10px] shadow-md shadow-blue-200/50">
                <div className="bg-blue-100 p-1.5 rounded-[10px] text-blue-600">
                  <FileBarChart size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/meter-manage')}
              className="bg-[#EAFAFF] p-5 rounded-[10px] border border-blue-50 relative group overflow-hidden"
            >
              <div className="relative z-10">
                <h5 className="text-[#187D94] font-bold text-lg mb-0.5">换表管理</h5>
                <p className="text-[#4CAABF] text-[10px] font-bold tracking-wider mb-2">换表管理</p>
                <p className="text-[#89C6D4] text-[10px]">换表登记, 进度跟踪管理</p>
              </div>
              <div className="absolute -right-1 bottom-6 text-[#06B6D4] opacity-10 group-hover:scale-110 transition-transform">
                <RefreshCw size={70} strokeWidth={1} />
              </div>
              <div className="absolute right-5 bottom-8 bg-white p-2 rounded-[10px] shadow-md shadow-cyan-200/50">
                <div className="bg-cyan-100 p-1.5 rounded-[10px] text-cyan-600">
                  <RefreshCw size={24} />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {selfServices.slice(2).map((item) => (
              <motion.div
                key={item.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-[10px] bg-blue-100/50 flex items-center justify-center text-blue-600 mb-2 shadow-sm">
                  <item.icon size={26} strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-gray-800 mb-0.5 text-center">{item.name}</span>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-[10px] p-6 shadow-sm shadow-blue-900/5 mb-24">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-2">
              <h4 className="text-lg font-black text-gray-900">水量统计</h4>
              <button type="button" className="text-gray-300"><Settings2 size={16} /></button>
            </div>
            <div className="flex bg-[#F4F6F8] p-1 rounded-[10px]">
              {(['surface', 'under', 'tap'] as const).map((key, i) => {
                const label = ['地表水', '地下水', '自来水'][i];
                const active = waterTypeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWaterTypeTab(key)}
                    className={cn(
                      'px-4 py-1.5 text-[11px] font-bold rounded-[10px] transition-all',
                      active ? 'bg-white text-[#3B82F6] shadow-sm shadow-black/5' : 'text-gray-400',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4 ml-1 text-[10px] font-bold text-gray-400">单位：立方米</div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {statsData.map((stat, idx) => (
              <div key={idx} className={cn('p-4 rounded-[10px] border border-white relative overflow-hidden', stat.bg)}>
                <div className="text-[10px] font-bold text-gray-400 mb-3">{stat.name}</div>
                <div className="flex items-baseline space-x-1">
                  <span className={cn('text-lg font-black tracking-tight', stat.color)}>{stat.value}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{stat.unit}</span>
                </div>
                <div className={cn('absolute -right-2 -bottom-2 opacity-5', stat.color)}>
                  <Droplets size={44} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 w-full">
            <div className="mb-3 flex flex-wrap items-start justify-start gap-x-4 gap-y-2 ml-1">
              <div className="flex items-center space-x-1.5"><span className="w-2 h-2 rounded bg-blue-500" /><span className="text-[10px] font-bold text-gray-400">年计划水量</span></div>
              <div className="flex items-center space-x-1.5"><span className="w-2.5 h-1 rounded bg-purple-400" /><span className="text-[10px] font-bold text-gray-400">一至三季度水量</span></div>
              <div className="flex items-center space-x-1.5"><span className="w-2 h-2 rounded bg-green-500" /><span className="text-[10px] font-bold text-gray-400">年累计用水量</span></div>
            </div>
            <p className="mb-1 text-center text-[9px] text-gray-400">← 可左右滑动查看各月 →</p>
            <div
              className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]"
              style={{ touchAction: 'pan-x' }}
            >
              <div
                className="h-56 shrink-0"
                style={{ width: scrollableChartInnerWidthPx(waterBarChartYtd.length, 46) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterBarChartYtd} margin={{ left: 2, right: 4 }}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                      dy={10}
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} width={36} />
                    <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                    <Bar dataKey="v1" fill="#3B82F6" radius={[4, 4, 4, 4]} maxBarSize={14} />
                    <Bar dataKey="v2" fill="#A855F7" radius={[4, 4, 4, 4]} maxBarSize={14} />
                    <Bar dataKey="v3" fill="#10B981" radius={[4, 4, 4, 4]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      </div>
      <NavBar />
    </PageWrapper>
  );
};


/** 自备水户：水源类型（可多选） */
const ENTERPRISE_WATER_SOURCE_SELF: { label: string; value: string }[] = [
  { label: '地下水', value: 'ground' },
  { label: '地表水', value: 'surface' },
  { label: '自来水', value: 'tap' },
  { label: '非常规水', value: 'unconventional' },
  { label: '其他外购水', value: 'purchased_other' },
];

/**
 * 公共供水户：非常规水、其他外购水可选；自来水必选项（默认勾选、不可取消）
 * value「tap」由 {@link PublicSupplyWaterSourceField} 固定合入
 */
const ENTERPRISE_WATER_SOURCE_PUBLIC_OPTIONAL: { label: string; value: string }[] = [
  { label: '非常规水', value: 'unconventional' },
  { label: '其他外购水', value: 'purchased_other' },
];

/** 公共供水：必含自来水 */
const PUBLIC_SUPPLY_LOCKED_TAP = 'tap' as const;

type WaterSourceFieldProps = {
  value?: string[];
  onChange?: (v: string[]) => void;
};

/**
 * 公共供水户水源：自来水已选且不可取消，其余可勾选
 */
function PublicSupplyWaterSourceField({ value, onChange }: WaterSourceFieldProps) {
  const withTap = useMemo(() => {
    const a = value ?? [];
    if (a.includes(PUBLIC_SUPPLY_LOCKED_TAP)) return a;
    return [PUBLIC_SUPPLY_LOCKED_TAP, ...a];
  }, [value]);

  const setOptional = (key: string, checked: boolean) => {
    const s = new Set(withTap);
    s.add(PUBLIC_SUPPLY_LOCKED_TAP);
    if (checked) s.add(key);
    else if (key !== PUBLIC_SUPPLY_LOCKED_TAP) s.delete(key);
    onChange?.(Array.from(s));
  };

  return (
    <div className="flex flex-col gap-2">
      <Checkbox checked disabled>
        自来水
      </Checkbox>
      {ENTERPRISE_WATER_SOURCE_PUBLIC_OPTIONAL.map((opt) => (
        <Checkbox
          key={opt.value}
          checked={withTap.includes(opt.value)}
          onChange={(e) => setOptional(opt.value, e.target.checked)}
        >
          {opt.label}
        </Checkbox>
      ))}
    </div>
  );
}

/** 水源 value → 展示名（定额对标） */
function waterSourceValueToLabel(value: string): string {
  const row = [...ENTERPRISE_WATER_SOURCE_SELF, ...ENTERPRISE_WATER_SOURCE_PUBLIC_OPTIONAL].find(
    (x) => x.value === value,
  );
  return row?.label ?? value;
}

/** 企业注册已选水源；无记录时按户类给演示默认 */
function getRegisteredWaterSourceKeysForQuota(quotaUsesPublicSupply: boolean): string[] {
  const t = getEnterpriseWaterSourceTypes();
  if (t != null && t.length > 0) return t;
  return quotaUsesPublicSupply ? [PUBLIC_SUPPLY_LOCKED_TAP] : ['surface', 'ground', 'tap'];
}

/** 去年参考用水总量（演示数，可编辑） */
function buildLastYearDemoWaterTotals(sourceKeys: string[]): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  sourceKeys.forEach((k, i) => {
    const salt = k.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    out[k] = Math.round(120000 + i * 28000 + (salt % 17000));
  });
  return out;
}

/** 定额对标：在源于企业注册的水源列表上补充「非常规水」（未注册时亦展示） */
function ensureUnconventionalWaterIncluded(keys: string[]): string[] {
  if (keys.includes('unconventional')) return keys;
  return [...keys, 'unconventional'];
}

/** 演示自动带出（对接接口后改为接口默认值）；法人代表默认仅自备水演示带出，公共供水户不预填 */
const DEMO_ENTERPRISE_DEFAULTS = {
  userName: '连云港协鑫生物质发电有限公司',
  creditCode: '91320700123456789X',
  legalRepSelfDemo: '王某',
};

/** 定额对标等页展示：已注册则读本地，否则演示默认名 */
function getEnterpriseUserName(): string {
  try {
    const s = localStorage.getItem(LS_ENTERPRISE_USER_NAME)?.trim();
    if (s) return s;
  } catch {
    /* ignore */
  }
  return DEMO_ENTERPRISE_DEFAULTS.userName;
}

const EnterpriseRegPage = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const entryPreset = useMemo(() => {
    const t = (localStorage.getItem('userType') as UserType | null) ?? 'WATER_SAVING';
    return t === 'SELF_PROVIDED'
      ? { value: 'self_owned' as const, label: '自备水' }
      : { value: 'public_supply' as const, label: '公共供水' };
  }, []);

  const ut = (localStorage.getItem('userType') as UserType | null) ?? 'WATER_SAVING';
  const isSelfProvided = ut === 'SELF_PROVIDED';

  const initialValues = useMemo(
    () => ({
      withdrawalUserType: entryPreset.value,
      userName: getEnterpriseUserName(),
      creditCode: DEMO_ENTERPRISE_DEFAULTS.creditCode,
      /** 公共供水户：法人代表不预填；自备水演示可带出默认值 */
      legalRep: isSelfProvided ? DEMO_ENTERPRISE_DEFAULTS.legalRepSelfDemo : undefined,
      /** 公共供水户：默认已选自来水（与界面锁定一致） */
      waterSourceTypes: isSelfProvided ? ([] as string[]) : [PUBLIC_SUPPLY_LOCKED_TAP],
    }),
    [entryPreset.value, isSelfProvided],
  );

  const onFinish = (values: Record<string, unknown>) => {
    try {
      const raw = Array.isArray(values.waterSourceTypes) ? (values.waterSourceTypes as string[]) : [];
      const types = !isSelfProvided
        ? Array.from(new Set([...raw, PUBLIC_SUPPLY_LOCKED_TAP]))
        : raw;
      localStorage.setItem(LS_ENTERPRISE_WATER_SOURCES, JSON.stringify(types));
    } catch {
      localStorage.removeItem(LS_ENTERPRISE_WATER_SOURCES);
    }
    const mp = values.mainProductsCapacity;
    if (typeof mp === 'string' && mp.trim()) {
      localStorage.setItem(LS_ENTERPRISE_MAIN_PRODUCTS, mp.trim());
    } else {
      localStorage.removeItem(LS_ENTERPRISE_MAIN_PRODUCTS);
    }
    const un = values.userName;
    if (typeof un === 'string' && un.trim()) {
      localStorage.setItem(LS_ENTERPRISE_USER_NAME, un.trim());
    } else {
      localStorage.removeItem(LS_ENTERPRISE_USER_NAME);
    }
    localStorage.setItem(LS_ENTERPRISE_COMPLETE, 'true');
    message.success('注册信息已提交');
    navigate('/home');
  };

  const requiredRule = [{ required: true, message: '此项为必填' }];

  /** 选填长文本：不展示字数，仅在校验时若超过 500 字再报错 */
  const max500TextRule = {
    validator: async (_: unknown, v: unknown) => {
      const s = typeof v === 'string' ? v : v == null ? '' : String(v);
      if (s.length > 500) {
        return Promise.reject(new Error('内容不得超过 500 字'));
      }
      return Promise.resolve();
    },
  };

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h2 className="flex-1 text-center font-bold text-lg">企业注册</h2>
      </div>
      <div className="p-5 pb-28">
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initialValues}>
          <Form.Item
            label="用水户名称"
            name="userName"
            rules={requiredRule}
          >
            <Input placeholder="请输入用水户名称" maxLength={120} />
          </Form.Item>

          <Form.Item label="单位性质" name="orgNature" rules={requiredRule}>
            <Select
              placeholder="请选择单位性质"
              options={[
                { value: 'state_owned', label: '国有企业' },
                { value: 'private_enterprise', label: '民营企业' },
                { value: 'public_institution', label: '事业单位' },
                { value: 'government_org', label: '机关单位' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Form.Item>

          <Form.Item label="取用水户类型" name="withdrawalUserType" rules={requiredRule}>
            <Select disabled options={[{ value: entryPreset.value, label: entryPreset.label }]} />
          </Form.Item>

          <Form.Item
            label="水源类型（可多选）"
            name="waterSourceTypes"
            rules={[
              {
                validator: async (_, v) => {
                  const arr = Array.isArray(v) ? (v as string[]) : [];
                  if (!isSelfProvided) {
                    if (!arr.includes(PUBLIC_SUPPLY_LOCKED_TAP)) {
                      return Promise.reject(new Error('请至少选择一种水源类型'));
                    }
                    return Promise.resolve();
                  }
                  if (arr.length === 0) {
                    return Promise.reject(new Error('请至少选择一种水源类型'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
            extra={
              <p className="text-[11px] leading-relaxed text-amber-800/95">
                提示：勾选自动带入定额对标及计划申请内容，请仔细核对信息。
              </p>
            }
          >
            {isSelfProvided ? (
              <Checkbox.Group options={ENTERPRISE_WATER_SOURCE_SELF} className="flex flex-col gap-2" />
            ) : (
              <PublicSupplyWaterSourceField />
            )}
          </Form.Item>

          <Form.Item
            label="法人代表"
            name="legalRep"
            rules={requiredRule}
            extra={
              ut === 'WATER_SAVING' ? null : (
                <span className="text-[11px] text-gray-400">演示账号可带出示例，可自行修改</span>
              )
            }
          >
            <Input placeholder="请输入法人代表姓名" />
          </Form.Item>

          <Form.Item
            label="统一社会信用代码"
            name="creditCode"
            rules={requiredRule}
          >
            <Input placeholder="18 位统一社会信用代码" maxLength={18} />
          </Form.Item>

          <Form.Item label="成立时间" name="establishedAt" rules={requiredRule}>
            <DatePicker className="w-full" placeholder="请选择成立日期" />
          </Form.Item>

          <Form.Item label="注册地址" name="regAddress" rules={requiredRule}>
            <Input placeholder="请输入注册地址" maxLength={50} showCount />
          </Form.Item>

          <Divider plain className="!my-6">
            以下为选填
          </Divider>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="经度" name="longitude">
              <Input placeholder="选填" />
            </Form.Item>
            <Form.Item label="纬度" name="latitude">
              <Input placeholder="选填" />
            </Form.Item>
          </div>

          <Form.Item label="经营范围" name="businessScope" rules={[max500TextRule]}>
            <Input.TextArea placeholder="请输入经营范围" rows={4} />
          </Form.Item>

          {isSelfProvided ? (
            <>
              <Form.Item
                label="取水项目立项批复"
                name="waterIntakeProjectApproval"
                rules={[max500TextRule]}
              >
                <Input.TextArea placeholder="请输入取水项目立项批复" rows={4} />
              </Form.Item>

              <Form.Item
                label="取水项目变化情况"
                name="waterIntakeProjectChange"
                rules={[max500TextRule]}
              >
                <Input.TextArea placeholder="请输入取水项目变化情况" rows={4} />
              </Form.Item>
            </>
          ) : null}

          <Form.Item
            label="主要产品及生产能力"
            name="mainProductsCapacity"
            rules={[max500TextRule]}
          >
            <Input.TextArea placeholder="请输入主要产品及生产能力" rows={4} />
          </Form.Item>

          <Form.Item
            label="单位全称变化情况"
            name="nameChangeHistory"
            rules={[max500TextRule]}
          >
            <Input.TextArea
              placeholder="如有更名、分立合并等请说明；无请填「无」或留空"
              rows={4}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" className="w-full h-12 mt-4">
            提交注册
          </Button>
        </Form>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 定额对标：工艺附件仅存演示元数据（文件名等），便于写入 localStorage */
type QuotaProcessAttachmentRef = {
  uid: string;
  name: string;
};

/** 定额对标单产品行（用水量公式字段） */
type QuotaProductLine = {
  yieldAmount?: number;
  /** 产品产量单位 */
  productUnit?: string;
  volPublic?: number;
  volSelf?: number;
  volUnconventional?: number;
  volPurchased?: number;
  volExport?: number;
  consumeWater?: number;
  /** 产品工艺文字说明 */
  processDescription?: string;
  /** 工艺相关附件（演示本地选择，不落真实上传） */
  processAttachments?: QuotaProcessAttachmentRef[];
};

/** 定额对标：与企业注册水源联动；enterpriseKey 对应 ENTERPRISE_WATER_SOURCE_* 的 value */
const QUOTA_AUX_WATER_FIELDS: {
  enterpriseKey: string;
  title: string;
  volKey: keyof Pick<QuotaProductLine, 'volUnconventional' | 'volPurchased' | 'volExport'>;
}[] = [
  { enterpriseKey: 'unconventional', title: '非常规水', volKey: 'volUnconventional' },
  { enterpriseKey: 'purchased_other', title: '其他外购水', volKey: 'volPurchased' },
  { enterpriseKey: 'export', title: '外供水', volKey: 'volExport' },
];

/** 产品单位（定额对标填报，下拉选项） */
const QUOTA_PRODUCT_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: '吨', label: '吨' },
  { value: '千克', label: '千克' },
  { value: '件', label: '件' },
  { value: '台', label: '台' },
  { value: '万kWh', label: '万kWh' },
  { value: '万m³', label: '万m³' },
  { value: '升', label: '升' },
  { value: '万元', label: '万元' },
  { value: '平方米', label: '平方米' },
  { value: '标准箱', label: '标准箱' },
];

function productWaterVolume(line: QuotaProductLine): number {
  const a = Number(line.volSelf) || 0;
  const b = Number(line.volPublic) || 0;
  const c = Number(line.volUnconventional) || 0;
  const d = Number(line.volPurchased) || 0;
  const e = Number(line.volExport) || 0;
  return a + b + c + d - e;
}

/** 产量输入框后缀：备案单位优先，否则已存或默认「吨」 */
function quotaYieldDisplayUnit(line: QuotaProductLine, lockedUnit: string | undefined): string {
  return lockedUnit ?? (line.productUnit?.trim() || '吨');
}

/** 一组：内置行业 + 多产品填报（一户可添加多组） */
type IndustryBlock = {
  id: string;
  industryPath?: string[];
  selectedProducts: string[];
  productLines: Record<string, QuotaProductLine>;
};

const genBlockId = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const mapCatalogToCascader = (ma: MajorIndustry) => ({
  value: ma.value,
  label: ma.label,
  gbSegment: ma.gbSegment,
  children: ma.children.map((mid) => ({
    value: mid.value,
    label: mid.label,
    gbSegment: mid.gbSegment,
    children: mid.children.map((sm) => ({
      value: sm.value,
      label: sm.label,
      gbSegment: sm.gbSegment,
      children: sm.children.map((fine) => ({
        value: fine.value,
        label: fine.label,
        gbSegment: fine.gbSegment,
      })),
    })),
  })),
});

const BUILT_IN_CASCADER_OPTIONS: IndustryTreeNode[] = PRODUCT_CATALOG.map(mapCatalogToCascader);

function buildQuotaProductSelectOptions(block: IndustryBlock): { value: string; label: string }[] {
  const path = block.industryPath;
  if (!path || path.length !== 4) return [];
  const leaf = findFineIndustryFromRoots(PRODUCT_CATALOG, path);
  const industryKey = path.join('/');
  const catalog = leaf?.products ?? [];
  const approved = getApprovedProductNamesForIndustry(industryKey);
  const opts = catalog.map((p) => ({ value: p, label: p }));
  approved.forEach((name) => {
    if (!catalog.includes(name)) opts.push({ value: name, label: `${name}（已备案）` });
  });
  return opts;
}

/** 定额图 Tooltip 与图例统一顺序 */
const QUOTA_CHART_TOOLTIP_ITEM_ORDER = ['单耗', '领跑值', '先进值', '通用值'] as const;

/** Recharts 3：itemSorter 为单参迭代器（sortBy），非 (a,b) 比较器 */
function quotaTooltipItemRank(p: { name?: string; dataKey?: string | number } | null | undefined) {
  if (p == null) return 999;
  const label = (p.name ?? p.dataKey ?? '') as string;
  const i = (QUOTA_CHART_TOOLTIP_ITEM_ORDER as readonly string[]).indexOf(String(label));
  return i === -1 ? 999 : i;
}

const LS_QUOTA_2025_SURVEY_SNAPSHOT = 'quotaSurvey.2025.snapshot.v1';

const DEMO_2025_QUOTA_BLOCKS_PUBLIC: IndustryBlock[] = [
  {
    id: 'demo_2025_1',
    industryPath: ['food', 'dairy', 'fermented_cat', 'fermented'],
    selectedProducts: ['酸奶', '风味发酵乳'],
    productLines: {
      酸奶: { yieldAmount: 1250, productUnit: '吨', volPublic: 3820, volUnconventional: 117 },
      风味发酵乳: { yieldAmount: 890, productUnit: '吨', volPublic: 2650, volUnconventional: 0 },
    },
  },
];

const DEMO_2025_QUOTA_BLOCKS_SELF: IndustryBlock[] = [
  {
    id: 'demo_2025_1',
    industryPath: ['food', 'dairy', 'fermented_cat', 'fermented'],
    selectedProducts: ['酸奶', '风味发酵乳'],
    productLines: {
      酸奶: { yieldAmount: 1250, productUnit: '吨', volSelf: 3720, volUnconventional: 217 },
      风味发酵乳: { yieldAmount: 890, productUnit: '吨', volSelf: 2500, volUnconventional: 0 },
    },
  },
];

function getDefault2025QuotaBlocks(ut: UserType): IndustryBlock[] {
  return ut === 'SELF_PROVIDED' ? DEMO_2025_QUOTA_BLOCKS_SELF : DEMO_2025_QUOTA_BLOCKS_PUBLIC;
}

type QuotaSurveySnapshotFile =
  | IndustryBlock[]
  | { industryBlocks: IndustryBlock[]; waterTotalsBySource?: Record<string, number> };

function parseQuotaSurveySnapshot(
  raw: string | null,
  ut: UserType,
): { industryBlocks: IndustryBlock[]; waterTotalsBySource?: Record<string, number> } {
  if (!raw) {
    return { industryBlocks: getDefault2025QuotaBlocks(ut) };
  }
  try {
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p) && p.length) {
      return { industryBlocks: p as IndustryBlock[] };
    }
    const o = p as QuotaSurveySnapshotFile;
    if (o && typeof o === 'object' && !Array.isArray(o) && Array.isArray((o as { industryBlocks?: unknown }).industryBlocks)) {
      const industryBlocks = (o as { industryBlocks: IndustryBlock[] }).industryBlocks;
      const waterTotalsBySource = (o as { waterTotalsBySource?: Record<string, number> }).waterTotalsBySource;
      return { industryBlocks, waterTotalsBySource };
    }
  } catch {
    /* ignore */
  }
  return { industryBlocks: getDefault2025QuotaBlocks(ut) };
}

function loadQuota2025SurveySnapshot(ut: UserType): IndustryBlock[] {
  const raw = localStorage.getItem(LS_QUOTA_2025_SURVEY_SNAPSHOT);
  return parseQuotaSurveySnapshot(raw, ut).industryBlocks;
}

function loadQuota2025SurveyWaterTotals(ut: UserType): Record<string, number> | undefined {
  const raw = localStorage.getItem(LS_QUOTA_2025_SURVEY_SNAPSHOT);
  return parseQuotaSurveySnapshot(raw, ut).waterTotalsBySource;
}

type QuotaInvestigateFormViewProps = {
  readOnly?: boolean;
  surveyTitleLine: string;
  /** 已提交时展示在标题下，如 提交时间：2025-06-11 14:05:21 */
  submittedAtLine: string | null;
  industryBlocks: IndustryBlock[];
  quotaUsesPublicSupply: boolean;
  updateBlockIndustry: (blockId: string, path: string[] | undefined) => void;
  addIndustryBlock: () => void;
  removeBlock: (blockId: string) => void;
  patchLine: (blockId: string, prodName: string, patch: Partial<QuotaProductLine>) => void;
  onProductsChange: (blockId: string, names: string[]) => void;
  buildProductOptions: (block: IndustryBlock) => { value: string; label: string }[];
  openNewProductModal: (blockId: string) => void;
  /** 备案产品锁定计量单位（行业四级 path key + 产品名） */
  resolveApprovedProductUnit?: (industryKey: string, productName: string) => string | undefined;
  /** 用水户名称（源于企业注册，自动带出） */
  waterUserDisplayName: string;
  /** 企业注册对应的各水源类型（与基本情况展示一致） */
  registeredWaterSourceKeys: string[];
  /** 各水源类型用水总量（本年度，默认带出去年参考） */
  waterTotalsBySource: Record<string, number | undefined>;
  onPatchWaterTotal?: (sourceKey: string, value: number | undefined) => void;
  /** 已展开「查看定额对标内容」；详情只读固定为 true */
  quotaBenchmarkRevealed: boolean;
  onRevealQuotaBenchmark?: () => void;
  showSelfProvidedPlanHint: boolean;
  onSubmit: () => void;
};

function QuotaInvestigateFormView({
  readOnly = false,
  surveyTitleLine,
  submittedAtLine,
  industryBlocks,
  quotaUsesPublicSupply,
  updateBlockIndustry,
  addIndustryBlock,
  removeBlock,
  patchLine,
  onProductsChange,
  buildProductOptions,
  openNewProductModal,
  resolveApprovedProductUnit,
  waterUserDisplayName,
  registeredWaterSourceKeys,
  waterTotalsBySource,
  onPatchWaterTotal,
  quotaBenchmarkRevealed,
  onRevealQuotaBenchmark,
  showSelfProvidedPlanHint,
  onSubmit,
}: QuotaInvestigateFormViewProps) {
  const showBenchmarkPanels = readOnly || quotaBenchmarkRevealed;

  return (
    <>
      <p className="mb-1 text-center text-sm font-medium text-gray-800">{surveyTitleLine}</p>
      {submittedAtLine ? (
        <p className="mb-2 text-center text-xs text-gray-500">{submittedAtLine}</p>
      ) : null}
      {readOnly ? (
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-center text-xs text-slate-700">以下为已提交信息，仅可查看</p>
      ) : null}

      <div className="mb-4 rounded-[10px] border border-blue-100 bg-white p-4 shadow-sm shadow-blue-900/[0.04]">
        <div className="mb-3 text-sm font-bold text-gray-900">一、基本情况</div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">用水户名称</div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-900">{waterUserDisplayName}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">用水户类型</div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-gray-900">
              {quotaUsesPublicSupply ? '公共供水户' : '自备水户'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">水源类型（源于企业注册数据）</div>
            <div className="flex flex-wrap gap-2">
              {registeredWaterSourceKeys.length ? (
                registeredWaterSourceKeys.map((k) => (
                  <span
                    key={k}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    {waterSourceValueToLabel(k)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">未读取到注册水源，请先在「企业注册」中勾选水源类型</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-gray-800">行业与产品</p>

      {industryBlocks.map((block, bi) => (
        <div key={block.id} className="mb-4 min-w-0 overflow-hidden rounded-[10px] border bg-white">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2.5">
            <span className="font-medium text-gray-900">行业 {bi + 1}</span>
            {!readOnly && industryBlocks.length > 1 ? (
              <button
                type="button"
                className="text-xs font-bold text-red-500"
                onClick={() => removeBlock(block.id)}
              >
                删除该行业
              </button>
            ) : null}
          </div>
          <div className="space-y-4 p-4">
            <div className="min-w-0">
              <div className="mb-1.5 text-sm font-medium text-gray-900">行业类别（门类 / 大类 / 中类 / 小类）</div>
              <IndustryPathBottomPicker
                value={block.industryPath}
                onChange={readOnly ? () => undefined : (path) => updateBlockIndustry(block.id, path)}
                options={BUILT_IN_CASCADER_OPTIONS}
                readOnly={readOnly}
                placeholder="逐级选择门类、大类、中类、小类"
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-gray-900">产品名称（可多选）</div>
              <Select
                mode="multiple"
                disabled={readOnly || block.industryPath?.length !== 4}
                value={block.selectedProducts}
                onChange={readOnly ? () => undefined : (v) => onProductsChange(block.id, v)}
                options={buildProductOptions(block)}
                allowClear={!readOnly}
                virtual={false}
                size="large"
                placeholder={block.industryPath?.length === 4 ? '请选择一种或多种产品' : '请先完成本行业四级类别'}
                popupMatchSelectWidth
                classNames={{ popup: { root: 'rounded-xl' } }}
                className="w-full"
              />
              {!readOnly ? (
                <>
                  <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
                    <span className="font-semibold">提示：</span>
                    若下拉中无所需产品，请先点击「申请新增产品」，管理员审批通过后即可在本行业产品中选择。
                  </div>
                  <Button type="link" className="h-auto p-0" onClick={() => openNewProductModal(block.id)}>
                    <Plus size={14} className="mr-1 inline" />
                    申请新增产品
                  </Button>
                </>
              ) : null}
            </div>

            {block.selectedProducts.map((prodName, pi) => {
              const line = block.productLines[prodName] ?? {};
              const industryKeyStr = block.industryPath?.join('/') ?? '';
              const lockedUnit =
                industryKeyStr && resolveApprovedProductUnit
                  ? resolveApprovedProductUnit(industryKeyStr, prodName)
                  : undefined;
              const isThermal =
                block.industryPath?.length === 4
                  ? !!findFineIndustryFromRoots(PRODUCT_CATALOG, block.industryPath)?.isThermalPower
                  : false;
              const pu = quotaYieldDisplayUnit(line, lockedUnit);

              return (
                <Card
                  key={`${block.id}_${prodName}`}
                  size="small"
                  className="!rounded-[10px] !border-gray-100 !shadow-none"
                  title={
                    <span className="text-sm font-bold text-gray-900">
                      产品{pi + 1}：{prodName}
                    </span>
                  }
                >
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="mb-1 text-xs font-medium text-gray-700">
                        产品产量 <span className="text-red-500">*</span>
                        {lockedUnit ? (
                          <span className="font-normal text-[11px] text-gray-400">（单位以备案为准）</span>
                        ) : null}
                      </div>
                      <Input
                        type="number"
                        readOnly={readOnly}
                        disabled={readOnly}
                        min={0}
                        step={0.01}
                        suffix={pu}
                        placeholder="0"
                        className={readOnly ? 'bg-gray-50' : undefined}
                        value={line.yieldAmount ?? ''}
                        onChange={
                          readOnly
                            ? undefined
                            : (e) => {
                                const v = e.target.value;
                                const unitVal = lockedUnit ?? (line.productUnit?.trim() || '吨');
                                patchLine(block.id, prodName, {
                                  yieldAmount: v === '' ? undefined : Number(v),
                                  productUnit: lockedUnit ?? unitVal,
                                });
                              }
                        }
                      />
                    </div>

                    {quotaUsesPublicSupply ? (
                      <>
                        <div>
                          <div className="mb-1 text-xs font-medium text-gray-700">
                            自来水 <span className="text-red-500">*</span>
                          </div>
                          <Input
                            type="number"
                            readOnly={readOnly}
                            disabled={readOnly}
                            min={0}
                            suffix="m³"
                            placeholder="0"
                            className={readOnly ? 'bg-gray-50' : undefined}
                            value={line.volPublic ?? ''}
                            onChange={
                              readOnly
                                ? undefined
                                : (e) => {
                                    const v = e.target.value;
                                    patchLine(block.id, prodName, {
                                      volPublic: v === '' ? undefined : Number(v),
                                    });
                                  }
                            }
                          />
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium text-gray-700">
                            非常规水 <span className="text-red-500">*</span>
                          </div>
                          <Input
                            type="number"
                            readOnly={readOnly}
                            disabled={readOnly}
                            min={0}
                            suffix="m³"
                            placeholder="0"
                            className={readOnly ? 'bg-gray-50' : undefined}
                            value={line.volUnconventional ?? ''}
                            onChange={
                              readOnly
                                ? undefined
                                : (e) => {
                                    const v = e.target.value;
                                    patchLine(block.id, prodName, {
                                      volUnconventional: v === '' ? undefined : Number(v),
                                    });
                                  }
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="mb-1 text-xs font-medium text-gray-700">
                            取水量 <span className="text-red-500">*</span>
                          </div>
                          <Input
                            type="number"
                            readOnly={readOnly}
                            disabled={readOnly}
                            min={0}
                            suffix="m³"
                            placeholder="0"
                            className={readOnly ? 'bg-gray-50' : undefined}
                            value={line.volSelf ?? ''}
                            onChange={
                              readOnly
                                ? undefined
                                : (e) => {
                                    const v = e.target.value;
                                    patchLine(block.id, prodName, {
                                      volSelf: v === '' ? undefined : Number(v),
                                    });
                                  }
                            }
                          />
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium text-gray-700">
                            非常规水 <span className="text-red-500">*</span>
                          </div>
                          <Input
                            type="number"
                            readOnly={readOnly}
                            disabled={readOnly}
                            min={0}
                            suffix="m³"
                            placeholder="0"
                            className={readOnly ? 'bg-gray-50' : undefined}
                            value={line.volUnconventional ?? ''}
                            onChange={
                              readOnly
                                ? undefined
                                : (e) => {
                                    const v = e.target.value;
                                    patchLine(block.id, prodName, {
                                      volUnconventional: v === '' ? undefined : Number(v),
                                    });
                                  }
                            }
                          />
                        </div>
                      </>
                    )}

                    {isThermal ? (
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-700">
                          消耗用水量 <span className="text-red-500">*</span>
                          <span className="font-normal text-gray-400">（火电等行业）</span>
                        </div>
                        <Input
                          type="number"
                          readOnly={readOnly}
                          disabled={readOnly}
                          min={0}
                          placeholder="循环冷却等"
                          className={readOnly ? 'bg-gray-50' : undefined}
                          value={line.consumeWater ?? ''}
                          onChange={
                            readOnly
                              ? undefined
                              : (e) => {
                                  const v = e.target.value;
                                  patchLine(block.id, prodName, {
                                    consumeWater: v === '' ? undefined : Number(v),
                                  });
                                }
                          }
                        />
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-2 text-xs font-medium text-gray-700">产品工艺</div>
                      <div className="space-y-3">
                        <div>
                          {readOnly ? (
                            <div className="min-h-[72px] rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                              {line.processDescription?.trim() ? line.processDescription : '—'}
                            </div>
                          ) : (
                            <Input.TextArea
                              rows={3}
                              placeholder="请填写主要产品工艺流程、用水环节等说明"
                              value={line.processDescription ?? ''}
                              onChange={(e) =>
                                patchLine(block.id, prodName, {
                                  processDescription: e.target.value || undefined,
                                })
                              }
                            />
                          )}
                        </div>
                        <div>
                          {readOnly ? (
                            line.processAttachments?.length ? (
                              <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                                {line.processAttachments.map((f) => (
                                  <li key={f.uid}>{f.name}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )
                          ) : (
                            <Upload
                              beforeUpload={() => false}
                              maxCount={8}
                              multiple
                              fileList={(line.processAttachments ?? []).map((f) => ({
                                uid: f.uid,
                                name: f.name,
                                status: 'done' as const,
                              }))}
                              onChange={(info) =>
                                patchLine(block.id, prodName, {
                                  processAttachments: info.fileList.map((f) => ({
                                    uid: String(f.uid),
                                    name: f.name ?? '未命名文件',
                                  })),
                                })
                              }
                            >
                              <Button icon={<Plus />}>上传附件</Button>
                            </Upload>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {!readOnly ? (
        <Button type="dashed" block className="mb-4 h-11 font-bold" onClick={addIndustryBlock}>
          <Plus size={16} className="mr-1 inline" />
          添加行业
        </Button>
      ) : null}

      {!readOnly && !quotaBenchmarkRevealed ? (
        <Button
          type="primary"
          block
          className="mb-4 h-11 font-bold"
          onClick={() => onRevealQuotaBenchmark?.()}
        >
          查看定额对标内容
        </Button>
      ) : null}

      {showBenchmarkPanels ? (
        <>
          <div className="mb-4 rounded-[10px] border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-bold text-gray-900">定额对标 · 分水源类型合计</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {registeredWaterSourceKeys.map((key) => (
                <div key={key}>
                  <div className="mb-1 text-xs font-medium text-gray-700">{waterSourceValueToLabel(key)}</div>
                  <Input
                    type="number"
                    readOnly={readOnly}
                    disabled={readOnly}
                    min={0}
                    suffix="m³"
                    placeholder="0"
                    className={readOnly ? 'bg-gray-50' : undefined}
                    value={waterTotalsBySource[key] ?? ''}
                    onChange={
                      readOnly || !onPatchWaterTotal
                        ? undefined
                        : (e) => {
                            const v = e.target.value;
                            onPatchWaterTotal(key, v === '' ? undefined : Number(v));
                          }
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-[10px] border border-sky-100 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-bold text-gray-900">定额对标 · 产品产量与水量合计</div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[300px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
                    <th className="px-3 py-2 font-semibold">产品名称</th>
                    <th className="px-3 py-2 font-semibold">产量（t）</th>
                    <th className="px-3 py-2 font-semibold">水量（m³）</th>
                    <th className="px-3 py-2 font-semibold">产品单耗（m³/t）</th>
                  </tr>
                </thead>
                <tbody>
                  {industryBlocks.flatMap((block) =>
                    block.selectedProducts.map((prodName) => {
                      const line = block.productLines[prodName] ?? {};
                      const vt = productWaterVolume(line);
                      const y = Number(line.yieldAmount) || 0;
                      const ik = block.industryPath?.join('/') ?? '';
                      const lu = ik && resolveApprovedProductUnit ? resolveApprovedProductUnit(ik, prodName) : undefined;
                      const pun = quotaYieldDisplayUnit(line, lu);
                      const ui = y > 0 ? vt / y : null;
                      return (
                        <tr key={`${block.id}_${prodName}`} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{prodName}</td>
                          <td className="px-3 py-2.5 text-gray-800">
                            {y ? `${y.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pun}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-gray-800">
                            {vt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-gray-800">
                            {ui != null ? `${ui.toFixed(4)} m³/${pun}` : '—'}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {showSelfProvidedPlanHint && (
        <div className="mb-4 rounded-[10px] border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          <span className="font-semibold">提示：</span>
          自备水已填水量将按规则带入计划用书模块（演示）。
        </div>
      )}

      {!readOnly ? (
        <Button type="primary" className="mt-2 h-12 w-full" onClick={onSubmit}>
          确认提交
        </Button>
      ) : null}
    </>
  );
}

/** 定额对标：年度调查列表（入口），样式对齐计划申请类列表 */
const QuotaBenchmarkListPage = () => {
  const navigate = useNavigate();
  return (
    <PageWrapper>
      <div className="sticky top-0 z-10 flex items-center bg-blue-600 px-3 py-3.5 text-white shadow-sm">
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-1.5 active:bg-white/10" aria-label="返回">
          <ChevronLeft className="text-white" size={22} strokeWidth={2.2} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold">定额对标</h1>
        <span className="inline-block w-9" aria-hidden />
      </div>
      <div className="min-h-0 space-y-3 bg-[#F3F4F6] p-4 pb-28">
        <button
          type="button"
          onClick={() => navigate('/quota-investigate/survey')}
          className="w-full rounded-[10px] bg-white p-4 text-left shadow-sm active:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[16px] font-bold leading-snug text-gray-900">2026年定额对标</span>
            <span className="shrink-0 rounded-md bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white">
              待完成
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate('/quota-investigate/detail')}
          className="w-full rounded-[10px] bg-white p-4 text-left shadow-sm active:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[16px] font-bold leading-snug text-gray-900">2025年定额对标</span>
            <span className="shrink-0 rounded-md bg-emerald-500 px-2.5 py-0.5 text-xs font-medium text-white">已完成</span>
          </div>
          <div className="mt-3 text-[13px] leading-relaxed text-gray-600">提交时间：2025-06-11 14:05:21</div>
        </button>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 已提交的定额对标：与填报页同结构，只读；演示数据可来自本机 localStorage 或默认样例 */
const QuotaInvestigateDetailPage = () => {
  const navigate = useNavigate();
  const quotaUserType = (localStorage.getItem('userType') as UserType) ?? 'WATER_SAVING';
  const quotaUsesPublicSupply = quotaUserType !== 'SELF_PROVIDED';
  const [industryBlocks] = useState<IndustryBlock[]>(() => loadQuota2025SurveySnapshot(quotaUserType));

  const registeredWaterSourceKeys = useMemo(
    () => ensureUnconventionalWaterIncluded(getRegisteredWaterSourceKeysForQuota(quotaUsesPublicSupply)),
    [quotaUsesPublicSupply],
  );

  const [waterTotalsBySource] = useState<Record<string, number | undefined>>(() => {
    const saved = loadQuota2025SurveyWaterTotals(quotaUserType);
    if (saved && Object.keys(saved).length > 0) {
      return { ...saved };
    }
    return buildLastYearDemoWaterTotals(
      ensureUnconventionalWaterIncluded(getRegisteredWaterSourceKeysForQuota(quotaUsesPublicSupply)),
    );
  });

  const noop = useCallback(() => {}, []);
  const noop1 = useCallback((_: string) => {}, []);
  const noop1p = useCallback((_: string, __: string[] | undefined) => {}, []);
  const noop2p = useCallback((_: string, __: string[]) => {}, []);
  const noop3 = useCallback((_: string, __: string, ___: Partial<QuotaProductLine>) => {}, []);

  const showSelfProvidedPlanHint =
    quotaUserType === 'SELF_PROVIDED' &&
    industryBlocks.some((block) =>
      block.selectedProducts.some((p) => {
        const line = block.productLines[p];
        return line && Number(line.yieldAmount) > 0 && (Number(line.volSelf) || 0) > 0;
      }),
    );

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate('/quota-investigate')} aria-label="返回">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">定额对标</h2>
      </div>
      <div className="p-5 pb-28">
        <QuotaInvestigateFormView
          readOnly
          surveyTitleLine="2025年定额对标"
          submittedAtLine="提交时间：2025-06-11 14:05:21"
          industryBlocks={industryBlocks}
          quotaUsesPublicSupply={quotaUsesPublicSupply}
          waterUserDisplayName={getEnterpriseUserName()}
          updateBlockIndustry={noop1p}
          addIndustryBlock={noop}
          removeBlock={noop1}
          patchLine={noop3}
          onProductsChange={noop2p}
          buildProductOptions={buildQuotaProductSelectOptions}
          openNewProductModal={noop1}
          resolveApprovedProductUnit={getApprovedProductUnit}
          registeredWaterSourceKeys={registeredWaterSourceKeys}
          waterTotalsBySource={waterTotalsBySource}
          quotaBenchmarkRevealed
          showSelfProvidedPlanHint={showSelfProvidedPlanHint}
          onSubmit={noop}
        />
      </div>
      <NavBar />
    </PageWrapper>
  );
};

const QuotaInvestigatePage = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const quotaUserType = localStorage.getItem('userType') as UserType;
  /** 公共供水户→自来水；自备水→取水量 */
  const quotaUsesPublicSupply = quotaUserType !== 'SELF_PROVIDED';

  const registeredWaterSourceKeys = useMemo(
    () => ensureUnconventionalWaterIncluded(getRegisteredWaterSourceKeysForQuota(quotaUsesPublicSupply)),
    [quotaUsesPublicSupply],
  );

  const [industryBlocks, setIndustryBlocks] = useState<IndustryBlock[]>(() => [
    { id: genBlockId(), selectedProducts: [], productLines: {} },
  ]);

  const [waterTotalsBySource, setWaterTotalsBySource] = useState<Record<string, number | undefined>>(() =>
    buildLastYearDemoWaterTotals(
      ensureUnconventionalWaterIncluded(getRegisteredWaterSourceKeysForQuota(quotaUserType !== 'SELF_PROVIDED')),
    ),
  );

  const patchWaterTotal = useCallback((sourceKey: string, value: number | undefined) => {
    setWaterTotalsBySource((prev) => ({ ...prev, [sourceKey]: value }));
  }, []);

  const [quotaBenchmarkRevealed, setQuotaBenchmarkRevealed] = useState(false);

  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState<string | undefined>(undefined);
  const [newProductPurpose, setNewProductPurpose] = useState('');
  const [productApplyTargetBlockId, setProductApplyTargetBlockId] = useState<string | null>(null);

  const updateBlockIndustry = (blockId: string, path: string[] | undefined) => {
    setIndustryBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, industryPath: path, selectedProducts: [], productLines: {} } : b,
      ),
    );
  };

  const addIndustryBlock = () => {
    setIndustryBlocks((prev) => [...prev, { id: genBlockId(), selectedProducts: [], productLines: {} }]);
  };

  const removeBlock = (blockId: string) => {
    setIndustryBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== blockId)));
  };

  const patchLine = (blockId: string, prodName: string, patch: Partial<QuotaProductLine>) => {
    setIndustryBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              productLines: {
                ...b.productLines,
                [prodName]: { ...b.productLines[prodName], ...patch },
              },
            },
      ),
    );
  };

  const onProductsChange = (blockId: string, names: string[]) => {
    setIndustryBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const industryKey = b.industryPath?.join('/') ?? '';
        const nextLines: Record<string, QuotaProductLine> = {};
        names.forEach((n) => {
          const fixed = industryKey ? getApprovedProductUnit(industryKey, n) : undefined;
          const prev = b.productLines[n] ?? {};
          const unit = fixed ?? (prev.productUnit?.trim() || '吨');
          nextLines[n] = { ...prev, productUnit: unit };
        });
        return { ...b, selectedProducts: names, productLines: nextLines };
      }),
    );
  };

  const showSelfProvidedPlanHint =
    quotaUserType === 'SELF_PROVIDED' &&
    industryBlocks.some((block) =>
      block.selectedProducts.some((p) => {
        const line = block.productLines[p];
        return (
          line &&
          Number(line.yieldAmount) > 0 &&
          (Number(line.volSelf) || 0) > 0
        );
      }),
    );

  const handleSubmit = () => {
    if (!quotaBenchmarkRevealed) {
      message.warning('请先点击「查看定额对标内容」，核对水源类型与产品维度后再提交');
      return;
    }
    for (const block of industryBlocks) {
      if (!block.industryPath || block.industryPath.length !== 4) {
        message.warning('请为每一行业从内置名录中选择完整的「门类 / 大类 / 中类 / 小类」，或删除多余行业分组');
        return;
      }
      if (!block.selectedProducts.length) {
        message.warning(`行业「${getIndustryPathLabels(block.industryPath) || '未命名'}」请至少选择一个产品`);
        return;
      }
      const leaf = findFineIndustryFromRoots(PRODUCT_CATALOG, block.industryPath);
      const thermal = !!leaf?.isThermalPower;
      for (const p of block.selectedProducts) {
        const line = block.productLines[p];
        if (line == null || line.yieldAmount === undefined || line.yieldAmount === null) {
          message.warning(`请填写产品「${p}」的产品产量`);
          return;
        }
        if (quotaUsesPublicSupply) {
          if (line.volPublic === undefined || line.volPublic === null) {
            message.warning(`请填写产品「${p}」的自来水`);
            return;
          }
          if (line.volUnconventional === undefined || line.volUnconventional === null) {
            message.warning(`请填写产品「${p}」的非常规水（无则填 0）`);
            return;
          }
        } else {
          if (line.volSelf === undefined || line.volSelf === null) {
            message.warning(`请填写产品「${p}」的取水量`);
            return;
          }
          if (line.volUnconventional === undefined || line.volUnconventional === null) {
            message.warning(`请填写产品「${p}」的非常规水（无则填 0）`);
            return;
          }
        }
        if (thermal && (line.consumeWater === undefined || line.consumeWater === null)) {
          message.warning(`请填写产品「${p}」的消耗用水量（火电等行业必填）`);
          return;
        }
      }
    }
    const summary = industryBlocks
      .map((b) => `${getIndustryPathLabels(b.industryPath)}：${b.selectedProducts.join('、')}`)
      .join('； ');
    try {
      const wt = Object.fromEntries(
        Object.entries(waterTotalsBySource).filter(
          ([, v]) => v !== undefined && v !== null && !Number.isNaN(Number(v)),
        ),
      ) as Record<string, number>;
      localStorage.setItem(
        LS_QUOTA_2025_SURVEY_SNAPSHOT,
        JSON.stringify({ industryBlocks, waterTotalsBySource: wt }),
      );
    } catch {
      /* ignore */
    }
    addApprovalRecord({
      id: `quota_${Date.now()}`,
      kind: 'quota_benchmark',
      title: '定额对标申请',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      summary,
    });
    message.success('已提交成功，定额对标申请已进入审批流程（主管部门审批中）');
    navigate('/quota-investigate');
  };

  const openNewProductModal = (blockId: string) => {
    const block = industryBlocks.find((b) => b.id === blockId);
    if (!block?.industryPath || block.industryPath.length !== 4) {
      message.warning('请先在当前行业从内置名录中选择完整的四级行业类别');
      return;
    }
    setProductApplyTargetBlockId(blockId);
    setNewProductOpen(true);
  };

  const handleAddProductApply = () => {
    const name = newProductName.trim();
    const purpose = newProductPurpose.trim();
    const unit = newProductUnit?.trim();
    if (!name) {
      message.warning('请输入产品名称');
      return;
    }
    if (!unit) {
      message.warning('请选择产品单位');
      return;
    }
    if (!purpose) {
      message.warning('请填写产品用途');
      return;
    }
    const block = industryBlocks.find((b) => b.id === productApplyTargetBlockId);
    const path = block?.industryPath;
    if (!path || path.length !== 4) {
      message.warning('行业类别不完整');
      return;
    }
    const industryKey = path.join('/');
    const id = `pa_${Date.now()}`;
    addApprovalRecord({
      id,
      kind: 'product_new',
      title: '新增产品申请',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      summary: `${getIndustryPathLabels(path)} · 申请产品：${name} · 产品单位：${unit}`,
      industryKey,
      productName: name,
      productUnit: unit,
      purpose,
    });
    setNewProductOpen(false);
    setNewProductName('');
    setNewProductUnit(undefined);
    setNewProductPurpose('');
    setProductApplyTargetBlockId(null);
    message.success('申请已提交；审批通过后产品单位将固定，并可在本产品列表中选择该产品');
  };

  const closeNewProductModal = () => {
    setNewProductOpen(false);
    setNewProductName('');
    setNewProductUnit(undefined);
    setNewProductPurpose('');
    setProductApplyTargetBlockId(null);
  };

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate('/quota-investigate')} aria-label="返回">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">定额对标</h2>
      </div>
      <div className="p-5 pb-28">
        <QuotaInvestigateFormView
          surveyTitleLine="2026年定额对标"
          submittedAtLine={null}
          industryBlocks={industryBlocks}
          quotaUsesPublicSupply={quotaUsesPublicSupply}
          waterUserDisplayName={getEnterpriseUserName()}
          updateBlockIndustry={updateBlockIndustry}
          addIndustryBlock={addIndustryBlock}
          removeBlock={removeBlock}
          patchLine={patchLine}
          onProductsChange={onProductsChange}
          buildProductOptions={buildQuotaProductSelectOptions}
          openNewProductModal={openNewProductModal}
          resolveApprovedProductUnit={getApprovedProductUnit}
          registeredWaterSourceKeys={registeredWaterSourceKeys}
          waterTotalsBySource={waterTotalsBySource}
          onPatchWaterTotal={patchWaterTotal}
          quotaBenchmarkRevealed={quotaBenchmarkRevealed}
          onRevealQuotaBenchmark={() => setQuotaBenchmarkRevealed(true)}
          showSelfProvidedPlanHint={showSelfProvidedPlanHint}
          onSubmit={handleSubmit}
        />
      </div>

      <Modal
        title="申请新增产品"
        open={newProductOpen}
        onOk={handleAddProductApply}
        onCancel={closeNewProductModal}
        okText="提交申请"
        cancelText="取消"
        destroyOnClose
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">当前行业类别（内置名录）</div>
            <div className="rounded-[10px] border border-gray-100 bg-gray-50 px-3 py-2 text-sm leading-snug text-gray-800">
              {(() => {
                const path = industryBlocks.find((b) => b.id === productApplyTargetBlockId)?.industryPath;
                return getIndustryPathLabels(path) || '—';
              })()}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-800">产品名称 *</div>
            <Input
              placeholder="请输入产品名称"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-800">产品单位 *</div>
            <p className="mb-2 text-[11px] leading-relaxed text-gray-500">
              审批通过后该单位将备案锁定，填报定额时不可修改。
            </p>
            <Select
              placeholder="请选择产品单位"
              value={newProductUnit}
              allowClear
              virtual={false}
              size="large"
              options={QUOTA_PRODUCT_UNIT_OPTIONS}
              popupMatchSelectWidth
              classNames={{ popup: { root: 'rounded-xl' } }}
              className="w-full"
              onChange={(v) => setNewProductUnit(v)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-800">产品用途 *</div>
            <Input.TextArea
              placeholder="请说明产品用途（如销售、自用、中间品等）"
              rows={3}
              value={newProductPurpose}
              onChange={(e) => setNewProductPurpose(e.target.value)}
            />
          </div>
        </div>
      </Modal>
      <NavBar />
    </PageWrapper>
  );
};

/** 审批记录列表（公共供水户）：与本机演示数据同步 */
const ApprovalCenterPage = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [listVersion, setListVersion] = useState(0);
  const list = useMemo(() => loadApprovalsWithDemos(), [location.key, listVersion]);
  const [detail, setDetail] = useState<ApprovalRecord | null>(null);

  useEffect(() => {
    const fid = (location.state as { focusId?: string } | null)?.focusId;
    if (!fid) return;
    const hit = loadApprovalsWithDemos().find((x) => x.id === fid);
    if (hit) setDetail(hit);
  }, [location.state, location.key]);

  const statusMeta = (s: ApprovalRecord['status']) => {
    if (s === 'pending') return { text: '审批中', color: 'gold' as const };
    if (s === 'approved') return { text: '已通过', color: 'green' as const };
    return { text: '已驳回', color: 'red' as const };
  };

  return (
    <PageWrapper>
      <div className="sticky top-0 z-10 flex items-center border-b bg-white p-4 shadow-sm">
        <button type="button" onClick={() => navigate(-1)} aria-label="返回">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold">审批记录</h2>
      </div>
      <div className="space-y-4 p-5 pb-28">
        {list.length === 0 ? (
          <div className="rounded-[10px] border border-gray-100 bg-gray-50 py-14 text-center text-sm text-gray-400">
            暂无审批记录
          </div>
        ) : (
          list.map((r) => {
            const sm = statusMeta(r.status);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDetail(r)}
                className="w-full rounded-[10px] border border-gray-100 bg-white p-4 text-left shadow-sm shadow-blue-900/[0.03] transition-colors active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900">{r.title}</span>
                      <Tag color={sm.color} className="!m-0">
                        {sm.text}
                      </Tag>
                    </div>
                    <p className="mt-1 text-[10px] font-medium text-gray-400">{approvalKindLabel(r.kind)}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-600">{r.summary}</p>
                    {r.status === 'rejected' && r.rejectReason && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-relaxed text-rose-900">
                        <span className="font-semibold">驳回理由：</span>
                        {r.rejectReason}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-gray-400">
                      提交时间：{dayjs(r.submittedAt).format('YYYY-MM-DD HH:mm')}
                    </p>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-gray-300" />
                </div>
              </button>
            );
          })
        )}
      </div>

      <Modal
        title="审批详情"
        open={detail !== null}
        onCancel={() => setDetail(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {detail?.kind === 'product_new' && detail.status === 'pending' && detail.industryKey && detail.productName && (
              <Button
                type="primary"
                className="!bg-emerald-600 hover:!bg-emerald-500"
                onClick={() => {
                  addApprovedProductForIndustry(
                    detail.industryKey!,
                    detail.productName!,
                    detail.productUnit?.trim() || '吨',
                  );
                  updateApprovalStatus(detail.id, 'approved');
                  message.success('已备案：用户可在该行业产品下拉中选择该产品');
                  setDetail(null);
                  setListVersion((v) => v + 1);
                }}
              >
                模拟审批通过（管理员演示）
              </Button>
            )}
            <Button type="primary" onClick={() => setDetail(null)}>
              我知道了
            </Button>
          </div>
        }
        destroyOnClose
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-gray-400">业务类型</span>
              <div className="font-medium text-gray-900">{approvalKindLabel(detail.kind)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">标题</span>
              <div className="font-medium text-gray-900">{detail.title}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">状态</span>
              <div className="mt-1">
                <Tag color={statusMeta(detail.status).color}>{statusMeta(detail.status).text}</Tag>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-400">摘要</span>
              <p className="mt-1 leading-relaxed text-gray-700">{detail.summary}</p>
            </div>
            {detail.status === 'rejected' && detail.rejectReason && (
              <div>
                <span className="text-xs text-gray-400">驳回理由</span>
                <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-[13px] leading-relaxed text-rose-950">
                  {detail.rejectReason}
                </p>
              </div>
            )}
            {detail.kind === 'product_new' && (
              <>
                <div>
                  <span className="text-xs text-gray-400">产品单位（备案）</span>
                  <p className="mt-1 font-medium text-gray-900">{detail.productUnit?.trim() || '—'}</p>
                </div>
                {detail.purpose && (
                  <div>
                    <span className="text-xs text-gray-400">产品用途</span>
                    <p className="mt-1 leading-relaxed text-gray-700">{detail.purpose}</p>
                  </div>
                )}
                {detail.status === 'pending' && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-950">
                    审批通过后，该产品将出现在对应<strong>内置行业</strong>的产品多选列表中（标记「已备案」），且<strong>产品单位按本次申报锁定</strong>。
                  </p>
                )}
              </>
            )}
            <div>
              <span className="text-xs text-gray-400">提交时间</span>
              <div>{dayjs(detail.submittedAt).format('YYYY-MM-DD HH:mm:ss')}</div>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
              主管部门审批结果将通过消息中心或短信通知（演示未接入）。
            </p>
          </div>
        )}
      </Modal>
      <NavBar />
    </PageWrapper>
  );
};

const SmartQAPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, hasChart?: boolean}[]>([
    { role: 'ai', text: '您好！我是您的智能水管家助手，可以协助分析用水数据、查询定额、生成趋势图等。您也可以试着问：“查一下2024年我的用水量”。' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const response = await askGemini(userMsg);
    const hasChart = response.includes('[CHART:LINE_3YEARS]');
    const cleanText = response.replace('[CHART:LINE_3YEARS]', '');

    setMessages(prev => [...prev, { role: 'ai', text: cleanText, hasChart }]);
    setLoading(false);
  };

  const lineChartData = [
    { year: '2022年', usage: 1180000 },
    { year: '2023年', usage: 1150000 },
    { year: '2024年', usage: 900000 },
  ];

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h2 className="flex-1 text-center font-bold text-lg">智能问答</h2>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto mb-20" style={{ height: 'calc(100vh - 140px)' }}>
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] p-3 rounded-[10px]",
              msg.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-gray-800 shadow-sm rounded-tl-none"
            )}>
              {msg.text}
              {msg.hasChart && (
                <div className="h-40 w-full mt-3 bg-gray-50 rounded-[10px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lineChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <YAxis hide />
                      <Tooltip formatter={(value: number) => [`${Number(value).toLocaleString()} 立方米`, '用水量']} />
                      <Area type="monotone" dataKey="usage" name="用水量" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-400 text-xs italic">智能助手正在分析数据，请稍候…</div>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex space-x-2 z-50">
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder="在此输入您的用水相关问题…"
          onPressEnter={handleSend}
          className="rounded-full bg-gray-100 border-none px-4"
        />
        <Button 
          type="primary" 
          shape="circle" 
          icon={<ChevronRight />} 
          onClick={handleSend} 
          disabled={loading}
        />
      </div>
    </PageWrapper>
  );
}

const MessagePage = () => {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10 shadow-sm">
        <h2 className="flex-1 text-center font-bold text-lg">消息通知</h2>
      </div>
      <div className="px-4 pt-4 pb-28">
        <div className="overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex gap-3 px-4 pt-4 pb-1">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-blue-600/20"
              aria-hidden
            >
              <FileEdit className="text-white" size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold leading-snug text-gray-900">年度计划用水申请通知</h3>
              <div className="mt-2.5 text-sm leading-relaxed text-[#666666]">
                <p>2025年度计划用水申请通知已下发，截止日期</p>
                <p className="mt-0.5">2025-01-09，请尽快填报！</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => navigate('/messages/detail')}
              className="w-full text-center text-sm font-medium text-blue-600 active:opacity-80"
            >
              查看详情
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-[#999999]">2025-01-02 16:40:21</p>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 消息通知 · 单条详情（演示，与列表「查看详情」一致） */
const MessageDetailPage = () => {
  const navigate = useNavigate();
  return (
    <PageWrapper>
      <div className="sticky top-0 z-10 flex items-center border-b border-gray-100 bg-white px-2 py-3 shadow-sm">
        <button type="button" onClick={() => navigate(-1)} className="p-2" aria-label="返回">
          <ChevronLeft size={22} className="text-gray-800" />
        </button>
        <h2 className="flex-1 pr-10 text-center text-lg font-bold">消息详情</h2>
      </div>
      <div className="px-4 pt-4 pb-28">
        <div className="overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-gray-100">
          <div className="p-4">
            <div className="flex gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-blue-600/20"
                aria-hidden
              >
                <FileEdit className="text-white" size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-gray-900">
                    年度计划用水申请通知
                  </h3>
                  <time
                    className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] leading-tight text-[#999999]"
                    dateTime="2025-01-07T14:44:27"
                  >
                    2025-01-07 14:44:27
                  </time>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#666666]">
                  消息类型：<span className="text-[#666666]">待办事项提醒</span>
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-[#666666]">
                  2025年度计划用水申请通知已下发，截止日期2025-01-09，请尽快填报！
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

/** 公共供水户：我的 → 我的申请（演示记录） */
type MyApplyRecord = {
  id: string;
  productName: string;
  industryPath: string;
  purpose: string;
  appliedAt: string;
  status: '审核中' | '已通过' | '已驳回';
  /** 申请业务类型（与筛选项一致，演示数据） */
  applyType: '定额对标' | '计划调整申请' | '新增产品' | '计划申请';
  /** 已驳回时审核意见 */
  rejectReason?: string;
};

const MY_APPLICATION_DEMO: MyApplyRecord[] = [
  {
    id: '1',
    productName: '风味发酵乳',
    industryPath: '食品制造业 / 乳制品制造 / 发酵乳制品 / 发酵乳制品制造',
    purpose: '终端零售渠道供货',
    appliedAt: '2026-03-18',
    status: '审核中',
    applyType: '新增产品',
  },
  {
    id: '2',
    productName: '品牌正餐门店',
    industryPath: '食品制造业 / 其他食品制造',
    purpose: '门店餐饮用水',
    appliedAt: '2026-02-06',
    status: '已驳回',
    applyType: '计划申请',
    rejectReason:
      '行业分类不对，应该选择H-住宿和餐饮业/H62-餐饮业/H621-正餐服务/H6210-正餐服务',
  },
];

const APPLY_TYPE_OPTIONS: { value: MyApplyRecord['applyType'] | 'all'; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: '定额对标', label: '定额对标' },
  { value: '计划调整申请', label: '计划调整申请' },
  { value: '新增产品', label: '新增产品' },
  { value: '计划申请', label: '计划申请' },
];

const MyApplicationsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [listTab, setListTab] = useState<'pending' | 'done'>('pending');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const exitAllMode = () => {
    if (searchParams.get('mode') !== 'all') return;
    const next = new URLSearchParams(searchParams);
    next.delete('mode');
    setSearchParams(next, { replace: true });
  };

  const setTabAndExitAll = (tab: 'pending' | 'done') => {
    setListTab(tab);
    exitAllMode();
  };

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    MY_APPLICATION_DEMO.forEach((r) => {
      years.add(dayjs(r.appliedAt).year());
    });
    const sorted = [...years].sort((a, b) => b - a);
    return [{ value: 'all', label: '全部年份' }, ...sorted.map((y) => ({ value: String(y), label: `${y}年` }))];
  }, []);

  const monthOptions = useMemo(
    () => [
      { value: 'all', label: '全部月份' },
      ...Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: `${i + 1}月`,
      })),
    ],
    [],
  );

  const filteredRecords = useMemo(() => {
    return MY_APPLICATION_DEMO.filter((r) => {
      const pending = r.status === '审核中';
      if (listTab === 'pending' && !pending) return false;
      if (listTab === 'done' && pending) return false;

      const d = dayjs(r.appliedAt);
      if (filterYear !== 'all' && d.year() !== Number(filterYear)) return false;
      if (filterMonth !== 'all' && d.month() + 1 !== Number(filterMonth)) return false;
      if (filterType !== 'all' && r.applyType !== filterType) return false;
      return true;
    }).sort((a, b) => dayjs(b.appliedAt).valueOf() - dayjs(a.appliedAt).valueOf());
  }, [filterMonth, filterType, filterYear, listTab]);

  return (
    <PageWrapper>
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white shadow-sm">
        <div className="flex items-center p-4">
          <button type="button" onClick={() => navigate(-1)} aria-label="返回">
            <ChevronLeft />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold pr-9">我的申请</h2>
        </div>
        <div className="px-4 pb-3">
          <div className="flex w-full max-w-full rounded-xl bg-gray-100 p-1" role="tablist" aria-label="申请状态">
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'pending'}
              onClick={() => setTabAndExitAll('pending')}
              className={cn(
                'min-h-[40px] flex-1 rounded-lg py-2 text-center text-[13px] font-bold transition-colors',
                listTab === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
              )}
            >
              待审核
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'done'}
              onClick={() => setTabAndExitAll('done')}
              className={cn(
                'min-h-[40px] flex-1 rounded-lg py-2 text-center text-[13px] font-bold transition-colors',
                listTab === 'done' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500',
              )}
            >
              已完成
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4 pb-28">
        <div className="grid grid-cols-3 gap-2">
          <Select
            size="small"
            value={filterYear}
            onChange={setFilterYear}
            options={yearOptions}
            className="min-w-0"
            popupMatchSelectWidth={false}
          />
          <Select
            size="small"
            value={filterMonth}
            onChange={setFilterMonth}
            options={monthOptions}
            className="min-w-0"
            popupMatchSelectWidth={false}
          />
          <Select
            size="small"
            value={filterType}
            onChange={setFilterType}
            options={APPLY_TYPE_OPTIONS}
            className="min-w-0"
            popupMatchSelectWidth={false}
          />
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
            当前条件下暂无记录
          </div>
        ) : (
          filteredRecords.map((r) => (
            <div key={r.id} className="rounded-[10px] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 font-bold text-gray-900">{r.productName}</div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    r.status === '已通过' && 'bg-emerald-50 text-emerald-700',
                    r.status === '审核中' && 'bg-amber-50 text-amber-800',
                    r.status === '已驳回' && 'bg-rose-50 text-rose-700',
                  )}
                >
                  {r.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{r.applyType}</span>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-gray-500">行业：{r.industryPath}</div>
              <div className="mt-1 text-[11px] text-gray-600">用途：{r.purpose}</div>
              {r.status === '已驳回' && r.rejectReason ? (
                <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50/90 px-2.5 py-2 text-[11px] leading-relaxed text-rose-950">
                  <span className="font-bold text-rose-800">驳回理由：</span>
                  {r.rejectReason}
                </div>
              ) : null}
              <div className="mt-2 text-[10px] text-gray-400">申请时间：{r.appliedAt}</div>
            </div>
          ))
        )}
      </div>
      <NavBar />
    </PageWrapper>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const userType = localStorage.getItem('userType') as UserType;
  const items =
    userType === 'WATER_SAVING'
      ? [
          { icon: ClipboardCheck, label: '我的申请', path: '/my-applications' },
          { icon: Settings, label: '修改密码', path: '/change-password' },
          { icon: Phone, label: '联系我们', path: '/contact' },
        ]
      : [
          { icon: Settings, label: '修改密码', path: '/change-password' },
          { icon: Phone, label: '联系我们', path: '/contact' },
        ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <PageWrapper>
      <div className="bg-blue-600 h-48 flex flex-col items-center justify-center pt-8">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30 mb-2 overflow-hidden">
           <UserIcon size={40} className="text-white" />
        </div>
        <div className="text-white font-bold text-lg">连云港协鑫生物质发电</div>
        <div className="text-white/60 text-xs">用户编号：882910</div>
      </div>

      <div className="px-5 -mt-8">
        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm">
          {items.map((item, i) => (
            <div 
              key={item.path} 
              className={cn("flex items-center p-4 active:bg-gray-50", i !== items.length - 1 && "border-b border-gray-100")}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={20} className="text-gray-400 mr-3" />
              <span className="flex-1 text-gray-700">{item.label}</span>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          ))}
        </div>

        <button 
          onClick={handleLogout}
          className="w-full mt-6 bg-white py-4 rounded-[10px] flex items-center justify-center text-red-500 font-medium shadow-sm active:bg-gray-50"
        >
          <LogOut size={20} className="mr-2" />
          退出登录
        </button>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

function readEnterpriseMainProductsRaw(): string {
  try {
    return localStorage.getItem(LS_ENTERPRISE_MAIN_PRODUCTS)?.trim() ?? '';
  } catch {
    return '';
  }
}

function tokenizeProductHint(text: string): string[] {
  return text
    .split(/[,，、;；\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 企业「主要产品及生产能力」与名录匹配；无记录时默认演示酸奶 */
function matchAccountCatalogProducts(
  all: CatalogProductEntry[],
  hint: string,
): CatalogProductEntry[] {
  const tokens = tokenizeProductHint(hint);
  if (tokens.length === 0) {
    return all.filter((e) => e.productName === '酸奶');
  }
  const map = new Map<string, CatalogProductEntry>();
  for (const entry of all) {
    for (const t of tokens) {
      if (!t) continue;
      if (
        entry.productName === t ||
        entry.productName.includes(t) ||
        t.includes(entry.productName)
      ) {
        const k = `${entry.pathValues.join('/')}\0${entry.productName}`;
        map.set(k, entry);
        break;
      }
    }
  }
  return Array.from(map.values());
}

function quotaQueryUnitLabel(entry: CatalogProductEntry): string {
  return entry.pathValues[0] === 'power' ? '立方米/万千瓦时' : '立方米/吨';
}

function demoQuotaForCatalogProduct(name: string): { tier: string; value: string; blurb: string } {
  let s = 0;
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i);
  const tiers = ['一级', '二级', '三级'];
  const tier = tiers[s % 3]!;
  const v = (1.2 + (s % 90) / 100).toFixed(2);
  const blurbs = ['先进值，优于行业平均水平', '达到行业通用水平', '建议关注节水改造空间'];
  return { tier, value: v, blurb: blurbs[s % 3]! };
}

const QuotaQueryPage = () => {
  const navigate = useNavigate();
  const allProducts = useMemo(() => listAllCatalogProducts(), []);

  const enterpriseHint = readEnterpriseMainProductsRaw();
  const accountProducts = useMemo(
    () => matchAccountCatalogProducts(allProducts, enterpriseHint),
    [allProducts, enterpriseHint],
  );

  const [keyword, setKeyword] = useState('');

  /** 无关键词：只展示本单位关联；有关键词：在定额产品库全库中检索 */
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return accountProducts;
    return allProducts.filter(
      (e) =>
        e.productName.toLowerCase().includes(k) || e.pathLabels.toLowerCase().includes(k),
    );
  }, [keyword, allProducts, accountProducts]);

  return (
    <PageWrapper>
      <div className="bg-white p-4 border-b flex items-center sticky top-0 z-10">
        <button type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg">定额查询</h2>
      </div>
      <div className="p-4 pb-28">
        <Input.Search
          allowClear
          placeholder="搜索产品名称，如：酸奶"
          className="mb-4 !rounded-[10px]"
          size="large"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 leading-relaxed">
              {!keyword.trim()
                ? enterpriseHint && accountProducts.length === 0
                  ? '未在定额产品库中匹配到您填报的主要产品表述；可在上方输入关键词检索其它产品。'
                  : '暂无本单位关联产品展示。'
                : '未在全库中检索到匹配产品，请尝试更换关键词。'}
            </div>
          ) : (
            filtered.map((entry) => {
              const q = demoQuotaForCatalogProduct(entry.productName);
              const unit = quotaQueryUnitLabel(entry);
              const majorClass = entry.pathLabels.split(' / ')[0] ?? entry.pathLabels;
              return (
                <div
                  key={`${entry.pathValues.join('/')}_${entry.productName}`}
                  className="overflow-hidden rounded-[10px] border border-gray-800/15 bg-white p-4"
                >
                  <div className="mb-3 text-[15px] font-bold leading-snug text-gray-900">
                    根据贵公司产品，查询结果：{entry.productName}
                    <span> (行业大类：{majorClass})</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-xs text-gray-400">测算方法</div>
                      <p className="text-sm leading-relaxed text-gray-600">
                        根据单位产品取水量计算。总取水量 = 产品产量 × 单位产品取水定额（具体以行业口径为准）。
                      </p>
                    </div>
                    <div className="rounded-[10px] border border-emerald-200/80 bg-emerald-50 p-3">
                      <div className="text-sm font-medium text-emerald-700">当前定额标准</div>
                      <div className="mt-1.5 text-lg font-bold text-emerald-800">
                        {q.value} {unit}（{q.tier}）
                      </div>
                      <div className="mt-1 text-sm text-emerald-700/90">{q.blurb}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <NavBar />
    </PageWrapper>
  );
};

// --- App Root ---

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 10,
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <div className="max-w-md mx-auto relative bg-gray-50 min-h-screen">
            <AnimatePresence mode="wait">
              <Routes>
                {/* 根路径直接进登录，避免重定向时偶发旧界面或白屏；与 /login 同页 */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/messages" element={<MessagePage />} />
                <Route path="/messages/detail" element={<MessageDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/my-applications"
                  element={
                    <WaterSavingOnlyRoute>
                      <MyApplicationsPage />
                    </WaterSavingOnlyRoute>
                  }
                />
                <Route
                  path="/approvals"
                  element={
                    <WaterSavingOnlyRoute>
                      <ApprovalCenterPage />
                    </WaterSavingOnlyRoute>
                  }
                />
                <Route path="/enterprise-reg" element={<EnterpriseRegPage />} />
                <Route
                  path="/quota-investigate"
                  element={
                    <WaterSavingFeatureGate>
                      <QuotaBenchmarkListPage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/quota-investigate/survey"
                  element={
                    <WaterSavingFeatureGate>
                      <QuotaInvestigatePage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/quota-investigate/detail"
                  element={
                    <WaterSavingFeatureGate>
                      <QuotaInvestigateDetailPage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/quota-query"
                  element={
                    <WaterSavingFeatureGate>
                      <QuotaQueryPage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/smart-qa"
                  element={
                    <WaterSavingFeatureGate>
                      <SmartQAPage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/more"
                  element={
                    <WaterSavingFeatureGate>
                      <MorePage />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route path="/quick-entry-customize" element={<QuickEntryCustomizePage />} />
                <Route path="/meter-reading" element={<SelfProvidedServiceRoute title="现场抄表" />} />
                <Route path="/meter-manage" element={<SelfProvidedServiceRoute title="换表管理" />} />
                <Route
                  path="/product-confirm"
                  element={
                    <WaterSavingFeatureGate>
                      <ServicePlaceholderPage title="产品确认" />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/product-apply"
                  element={
                    <WaterSavingFeatureGate>
                      <ServicePlaceholderPage title="产品申请" />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/plan-apply"
                  element={
                    <WaterSavingFeatureGate>
                      <ServicePlaceholderPage title="计划申请" />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/plan-adjust"
                  element={
                    <WaterSavingFeatureGate>
                      <ServicePlaceholderPage title="计划调整" />
                    </WaterSavingFeatureGate>
                  }
                />
                <Route
                  path="/usage-summary"
                  element={
                    <WaterSavingFeatureGate>
                      <ServicePlaceholderPage title="用水总结" />
                    </WaterSavingFeatureGate>
                  }
                />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/home" />} />
              </Routes>
            </AnimatePresence>
          </div>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}
