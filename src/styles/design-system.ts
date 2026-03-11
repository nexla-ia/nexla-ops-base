// Design System - Cores e estilos padronizados

export const colors = {
  // Cores primárias
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutros
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Status
  success: {
    50: '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
  },

  warning: {
    50: '#fefce8',
    500: '#eab308',
    600: '#ca8a04',
  },

  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },

  // Chat específico
  chat: {
    received: '#ffffff',
    sent: '#3b82f6',
    system: '#e0f2fe',
    background: '#f8fafc',
  }
};

export const animations = {
  // Transições
  transition: {
    fast: 'transition-all duration-150 ease-in-out',
    normal: 'transition-all duration-200 ease-in-out',
    slow: 'transition-all duration-300 ease-in-out',
  },

  // Hover effects
  hover: {
    scale: 'hover:scale-105',
    lift: 'hover:-translate-y-0.5 hover:shadow-lg',
    brightness: 'hover:brightness-110',
    bg: 'hover:bg-opacity-90',
  },

  // Fade
  fadeIn: 'animate-in fade-in duration-200',
  fadeOut: 'animate-out fade-out duration-200',

  // Slide
  slideIn: 'animate-in slide-in-from-right duration-200',
  slideOut: 'animate-out slide-out-to-right duration-200',
};

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  card: 'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
  hover: 'hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]',
};

export const spacing = {
  sidebar: 'w-80',
  header: 'h-16',
  chat: 'max-w-4xl',
};

export const rounded = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
  message: 'rounded-2xl',
};

export const buttons = {
  primary: 'px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
  secondary: 'px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all shadow-sm',
  danger: 'px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 hover:shadow-lg transition-all duration-200',
  ghost: 'px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200',
};

export const badges = {
  primary: 'inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200',
  success: 'inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full border border-green-200',
  warning: 'inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full border border-amber-200',
  error: 'inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full border border-red-200',
};

export const inputs = {
  base: 'w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all',
  search: 'w-full bg-slate-50 text-slate-900 text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-md transition-all duration-200',
};

export const cards = {
  base: 'bg-white rounded-xl shadow-sm border border-slate-200 p-6',
  hover: 'bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200',
};
