import {
  LucideIcon,
  Home,
  Bell,
  User,
  MousePointer2,
  ClipboardList,
  PenTool,
  LayoutDashboard,
  Search,
  FileText,
  MessageSquare,
  ClipboardCheck,
  ArrowRightLeft,
  CalendarDays,
  BarChart3,
  Settings2,
  FileBarChart,
  Package,
} from 'lucide-react';

export type UserType = 'SELF_PROVIDED' | 'WATER_SAVING';

export interface ServiceItem {
  id: string;
  name: string;
  icon: LucideIcon;
  path: string;
}

export const COMMON_SERVICES: ServiceItem[] = [
  { id: 'meter_reading', name: '现场抄表', icon: MousePointer2, path: '/meter-reading' },
  { id: 'meter_manage', name: '换表管理', icon: ClipboardList, path: '/meter-manage' },
  { id: 'product_confirm', name: '产品确认', icon: Package, path: '/product-confirm' },
  { id: 'quota_investigate', name: '定额对标', icon: PenTool, path: '/quota-investigate' },
  { id: 'plan_apply', name: '计划申请', icon: PenTool, path: '/plan-apply' },
  { id: 'plan_adjust', name: '计划调整', icon: MousePointer2, path: '/plan-adjust' },
  { id: 'usage_summary', name: '用水总结', icon: MousePointer2, path: '/usage-summary' },
];

export const WATER_SAVING_SERVICES: ServiceItem[] = [
  { id: 'enterprise_reg', name: '企业注册', icon: LayoutDashboard, path: '/enterprise-reg' },
  { id: 'quota_investigate', name: '定额对标', icon: PenTool, path: '/quota-investigate' },
  { id: 'quota_query', name: '定额查询', icon: Search, path: '/quota-query' },
  { id: 'smart_qa', name: '智能问答', icon: MessageSquare, path: '/smart-qa' },
  { id: 'more_services', name: '更多功能', icon: LayoutDashboard, path: '/more' },
];
