'use client'

interface Column {
  key: string
  label: string
  width?: string
}

interface TableHeaderProps {
  columns: Column[]
}

export default function TableHeader({ columns }: TableHeaderProps) {
  return (
    <thead className="bg-zinc-50 border-b border-zinc-200">
      <tr>
        {columns.map(col => (
          <th
            key={col.key}
            className="px-4 py-3 text-left text-xs font-semibold text-zinc-700"
            style={{ width: col.width }}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}
