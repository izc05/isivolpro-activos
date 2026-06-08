export default function DataTable({ columns, rows, empty = 'Sin datos disponibles' }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="muted">{empty}</td></tr>}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => <td key={column.key} data-label={column.label}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
