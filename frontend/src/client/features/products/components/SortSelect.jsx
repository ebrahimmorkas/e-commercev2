import { SORT_OPTIONS } from '../constants/sortOptions';

const SortSelect = ({ value, onChange, disabled = false }) => (
  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
    <span>Sort by</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export default SortSelect;
