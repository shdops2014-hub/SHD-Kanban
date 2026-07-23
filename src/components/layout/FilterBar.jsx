import { PROJECT_TYPES, BOARD_STAGES } from '../../utils/constants'

export default function FilterBar({ searchQuery, onSearchChange, typeFilter, onTypeFilterChange, stageFilter, onStageFilterChange }) {
  const hasFilters = searchQuery || typeFilter || stageFilter
  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-100">
      <input
        type="text"
        placeholder="Search by customer or project name..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-shd-brown"
      />
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shd-brown"
      >
        <option value="">All Types</option>
        {PROJECT_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        value={stageFilter}
        onChange={(e) => onStageFilterChange(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-shd-brown"
      >
        <option value="">All Stages</option>
        {BOARD_STAGES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {hasFilters && (
        <button
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={() => { onSearchChange(''); onTypeFilterChange(''); onStageFilterChange('') }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
