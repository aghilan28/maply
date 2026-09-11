import React from 'react';
import { 
  Plane, 
  Briefcase, 
  Home, 
  Heart, 
  Trees, 
  Gem,
  Cloud, 
} from 'lucide-react';

interface CategoryPillsProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  counts?: Record<string, number>;
}

export interface CategoryItem {
  id: string | null;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  isIconOnly?: boolean;
}

export const CATEGORY_ITEMS: CategoryItem[] = [
  { id: null, label: 'All' },
  { id: 'Travel', label: 'Travel', icon: Plane, iconColor: 'text-amber-400' },
  { id: 'Work', label: 'Work', icon: Briefcase, iconColor: 'text-amber-500' },
  { id: 'Home', label: 'Home', icon: Home, iconColor: 'text-slate-300' },
  { id: 'Food', label: 'Food', icon: Heart, iconColor: 'text-rose-500' },
  { id: 'Nature', label: 'Nature', icon: Trees, iconColor: 'text-emerald-400' },
  { id: 'History', label: 'History', icon: Gem, iconColor: 'text-purple-400', isIconOnly: true },
  { id: 'Other', label: 'Other', icon: Cloud, iconColor: 'text-slate-300' },
];

export const CATEGORIES = CATEGORY_ITEMS;

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none select-none max-w-full">
      {CATEGORY_ITEMS.map((cat, idx) => {
        const isSelected = selectedCategory === cat.id;
        const Icon = cat.icon;

        if (cat.isIconOnly && Icon) {
          return (
            <button
              key={idx}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              aria-label={cat.label}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-purple-600/40 text-white shadow-md shadow-purple-500/30 border border-purple-400/60'
                  : 'liquid-glass hover:bg-white/[0.08] text-purple-400 border border-white/14'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        }

        return (
          <button
            key={cat.label}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'bg-blue-600/35 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/50'
                : 'liquid-glass hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/14'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 ${
                  isSelected ? 'text-white' : cat.iconColor || 'text-slate-300'
                }`}
              />
            )}
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
