'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  House,
  CalendarDots,
  Camera,
  PlusCircle,
  ClipboardText,
  UserCircle,
} from '@phosphor-icons/react';

export type PresensiTabType = 'home' | 'calendar' | 'overview' | 'account';

export interface BottomNavBarProps {
  activeTab: PresensiTabType;
  onSelectTab: (tab: PresensiTabType) => void;
  hasCheckedIn: boolean;
  onCenterAction: () => void;
  brandColor?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  hasCheckedIn,
  onCenterAction,
  brandColor = '#3B1F3D',
}) => {
  const navItems: { id: PresensiTabType; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Home', icon: House },
    { id: 'calendar', label: 'Kalender', icon: CalendarDots },
    { id: 'overview', label: 'Overview', icon: ClipboardText },
    { id: 'account', label: 'Profil', icon: UserCircle },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pointer-events-auto relative">
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-[#3B1F3D] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}

        {/* Center Floating Action Button (Clock In / Tambah Visit) */}
        <div className="-mt-6 flex flex-col items-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onCenterAction}
            style={{ backgroundColor: brandColor }}
            className="w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center border-4 border-white"
          >
            {hasCheckedIn ? (
              <PlusCircle className="w-6 h-6" weight="bold" />
            ) : (
              <Camera className="w-6 h-6" weight="bold" />
            )}
          </motion.button>
          <span className="text-[10px] font-bold text-slate-600 mt-0.5">
            {hasCheckedIn ? 'Visit' : 'Clock In'}
          </span>
        </div>

        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-[#3B1F3D] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
