interface FilterButtonsProps {
  options: Array<{
    value: string;
    label: string;
  }>;
  selected: string;
  onSelect: (value: string) => void;
}

export default function FilterButtons({ options, selected, onSelect }: FilterButtonsProps) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            selected === option.value
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-[1.02]'
              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:scale-[1.02] border border-slate-200 dark:border-slate-600'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
