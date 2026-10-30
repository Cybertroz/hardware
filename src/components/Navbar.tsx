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
  AlertCircle
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
  pendingApprovalsCount
}) => {
  const currentBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  const navItems = [
    { id: 'pos', label: 'POS Counter', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'purchasing', label: 'Purchasing & GRN', icon: Truck },
    { id: 'customers', label: 'Customers & Credit', icon: Users },
    { id: 'reports', label: 'Reports & Tax', icon: BarChart3 },
    {
      id: 'scaleup',
      label: 'Scale-Up & Approvals',
      icon: Sliders,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined
    },
    { id: 'architecture', label: 'Architecture & ERD', icon: Database },
    { id: 'tests', label: 'Automated Tests', icon: CheckCircle2 }
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Top Banner: Branch, Role & Offline Sync Status */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
        {/* Left: Brand & Kenyan Badge */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-amber-400 text-sm">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span>JengaPro ERP</span>
          </div>
          <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-500/30">
            KES (Ksh) • Kenya VAT 16% • eTIMS
          </span>
          {!featureFlags.multiBranch && (
            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[11px] border border-blue-500/30">
              Single Shop Mode
            </span>
          )}
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Active Branch Selector (Multi-Branch) */}
          {featureFlags.multiBranch ? (
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
              <span className="text-slate-400">Branch:</span>
              <select
                value={activeBranchId}
                onChange={e => setActiveBranchId(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-slate-800 text-white">
                    {b.name} {b.isMainWarehouse ? '★ (Main)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-slate-300 font-medium">
              📍 {currentBranch?.name}
            </div>
          )}

          {/* User Role Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Role:</span>
            <select
              value={currentRole}
              onChange={e => setCurrentRole(e.target.value as Role)}
              className="bg-transparent text-emerald-300 font-semibold focus:outline-none cursor-pointer capitalize"
            >
              <option value="owner" className="bg-slate-800 text-white">Owner / Super Admin</option>
              <option value="manager" className="bg-slate-800 text-white">Branch Manager</option>
              <option value="cashier" className="bg-slate-800 text-white">POS Cashier</option>
              <option value="storekeeper" className="bg-slate-800 text-white">Storekeeper (Warehouse)</option>
              <option value="dispatcher" className="bg-slate-800 text-white">Dispatch & Fleet Officer</option>
            </select>
          </div>

          {/* Till Reconciliation Quick Status */}
          <button
            onClick={onOpenTillModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Click to view Till status or perform Cash-Up / Z-Report"
          >
            <div className={`w-2 h-2 rounded-full ${activeTill?.status === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span>Till: {activeTill?.status === 'open' ? 'Open' : 'Closed'}</span>
          </button>

          {/* Offline / Online Network Connectivity Toggle & Queue Indicator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700 hover:bg-emerald-900/60'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-700 hover:bg-rose-900/60'
              }`}
              title={isOnline ? 'Click to simulate network outage / offline mode' : 'Click to restore online network'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
            </button>

            {offlineQueueCount > 0 && (
              <button
                onClick={onSyncOffline}
                disabled={!isOnline || isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500 hover:bg-amber-500/30 transition disabled:opacity-50"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Sync Queue ({offlineQueueCount})</span>
                {isSyncing && <span className="animate-spin text-xs">↻</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="px-4 flex items-center overflow-x-auto space-x-1 py-1.5 scrollbar-thin">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-medium text-sm whitespace-nowrap transition relative ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
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
