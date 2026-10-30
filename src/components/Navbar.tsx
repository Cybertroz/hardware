import React from 'react';
import {
  Building2,
  ShoppingCart,
  Boxes,
  Truck,
  Users,
  BarChart3,
  Sliders,
  Database,
  Wifi,
  WifiOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Wallet
} from 'lucide-react';
import { Branch, Role, FeatureFlags, TillSession } from '../types/index.ts';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  branches: Branch[];
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  offlineQueueCount: number;
  onSyncOffline: () => void;
  isSyncing: boolean;
  featureFlags: FeatureFlags;
  activeTill?: TillSession;
  onOpenTillModal: () => void;
  pendingApprovalsCount: number;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  branches,
  activeBranchId,
  setActiveBranchId,
  currentRole,
  setCurrentRole,
  isOnline,
  setIsOnline,
  offlineQueueCount,
  onSyncOffline,
  isSyncing,
  featureFlags,
  activeTill,
  onOpenTillModal,
  pendingApprovalsCount,
  onLogout
}) => {
  const currentBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  const navItems = currentRole === 'cashier' ? [
    { id: 'pos', label: 'POS Counter', icon: ShoppingCart },
    { id: 'finance', label: 'Finance Hub', icon: Wallet }
  ] : [
    { id: 'pos', label: 'POS Counter', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'customers', label: 'Customers & Credit', icon: Users },
    { id: 'finance', label: 'Finance Hub', icon: Wallet },
    { id: 'reports', label: 'Reports & Tax', icon: BarChart3 },
    {
      id: 'scaleup',
      label: 'Approvals & Settings',
      icon: Sliders,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined
    }
  ];

  return (
    <header className="bg-sky-600 text-white border-b border-sky-700 sticky top-0 z-40 shadow-md">
      {/* Top Banner: Branch, Center Brand, & Right Controls */}
      <div className="px-4 py-2 bg-sky-700/50 border-b border-sky-600 grid grid-cols-1 md:grid-cols-3 items-center text-xs gap-3">
        {/* Left: Branch & Role */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Active Branch Selector (Multi-Branch) */}
          {featureFlags.multiBranch ? (
            <div className="flex items-center gap-1.5 bg-sky-800/50 px-2.5 py-1 rounded-md border border-sky-500 shadow-2xs">
              <span className="text-sky-100 font-medium">Branch:</span>
              <select
                value={activeBranchId}
                onChange={e => setActiveBranchId(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-sky-800 text-white">
                    {b.name} {b.isMainWarehouse ? '★ (Main)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sky-50 font-medium">
              📍 {currentBranch?.name}
            </div>
          )}

          {/* User Role Switcher */}
          <div className="flex items-center gap-1.5 bg-sky-800/50 px-2.5 py-1 rounded-md border border-sky-500 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-sky-200" />
            <select
              value={currentRole}
              onChange={e => setCurrentRole(e.target.value as Role)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer capitalize"
            >
              <option value="owner" className="bg-sky-800 text-white">Owner / Admin</option>
              <option value="cashier" className="bg-sky-800 text-white">POS Cashier</option>
            </select>
          </div>
        </div>

        {/* Center: JENGA PRO ERP Branding */}
        <div className="flex items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2 font-black tracking-wider text-sky-900 text-base bg-sky-50 px-3.5 py-1 rounded-lg border border-sky-200 shadow-xs">
            <Building2 className="w-5 h-5 text-sky-600 animate-pulse" />
            <span>JENGA PRO ERP</span>
          </div>
        </div>

        {/* Right: Till, Network Status & Offline Sync */}
        <div className="flex items-center justify-end flex-wrap gap-2">
          {/* Till Reconciliation Quick Status */}
          <button
            onClick={onOpenTillModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-800/50 hover:bg-sky-800 text-white border border-sky-500 shadow-2xs transition cursor-pointer font-medium"
            title="Click to view Till status or perform Cash-Up / Z-Report"
          >
            <div className={`w-2 h-2 rounded-full ${activeTill?.status === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>Till: {activeTill?.status === 'open' ? 'Open' : 'Closed'}</span>
          </button>

          {/* Offline / Online Network Connectivity Toggle & Queue Indicator */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
              isOnline
                ? 'bg-emerald-800/50 text-emerald-50 border border-emerald-500 hover:bg-emerald-800'
                : 'bg-rose-800/50 text-rose-50 border border-rose-500 hover:bg-rose-800'
            }`}
            title={isOnline ? 'Click to simulate network outage / offline mode' : 'Click to restore online network'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>

          {offlineQueueCount > 0 && (
            <button
              onClick={onSyncOffline}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-800/50 text-amber-50 border border-amber-500 hover:bg-amber-800 transition disabled:opacity-50 font-semibold cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
              <span>Sync ({offlineQueueCount})</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="px-2.5 py-1 rounded-md bg-sky-800/50 hover:bg-rose-800 text-sky-50 hover:text-white border border-sky-500 hover:border-rose-300 transition text-[11px] font-semibold cursor-pointer"
            title="Sign out of POS session"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="px-4 flex items-center overflow-x-auto space-x-1.5 py-2 scrollbar-thin">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition cursor-pointer relative ${
                isActive
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-sky-100 hover:text-white hover:bg-sky-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-sky-200'}`} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shadow-xs">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
