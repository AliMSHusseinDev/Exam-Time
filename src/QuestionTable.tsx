import type { QuestionTable as TableData } from "./exam";

/** Text-only cells keep imported content safe; wide data scrolls inside the card. */
export function QuestionTable({ table }: { table?: TableData }) {
  if (!table) return null;
  return (
    <div
      className="question-table-scroll"
      role="region"
      aria-label={table.caption || "Question data table"}
      tabIndex={0}
    >
      <table className="question-table">
        <caption>{table.caption || "Question data"}</caption>
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th key={index} scope="col" dir="auto">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column} dir="auto">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
