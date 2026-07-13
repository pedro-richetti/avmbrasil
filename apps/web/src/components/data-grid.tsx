import React, { useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";

interface DataGridProps {
  initialRows?: number;
  initialCols?: number;
  onSave: (grid: string[][]) => void;
}

export function DataGrid({ initialRows = 10, initialCols = 5, onSave }: DataGridProps) {
  const [grid, setGrid] = useState<string[][]>(() => {
    return Array.from({ length: initialRows }, () => Array(initialCols).fill(""));
  });

  const handleChange = (rowIndex: number, colIndex: number, value: string) => {
    const newGrid = [...grid];
    newGrid[rowIndex] = [...(newGrid[rowIndex] || [])];
    newGrid[rowIndex][colIndex] = value;
    setGrid(newGrid);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    if (!pasteData) return;

    const rows = pasteData.split(/\r?\n/);
    const parsedData = rows.map((row) => row.split(/\t/)); // Excel typically uses tabs for clipboard

    // Ensure grid is large enough
    const maxRowNeeded = startRow + parsedData.length;
    const maxColNeeded = startCol + Math.max(...parsedData.map((r) => r.length));

    let newGrid = [...grid];

    // Add rows if needed
    if (maxRowNeeded > newGrid.length) {
      const rowsToAdd = maxRowNeeded - newGrid.length;
      const cols = newGrid[0]?.length || maxColNeeded; newGrid.push(...Array.from({ length: rowsToAdd }, () => Array(cols).fill("")));
    }

    // Add cols if needed
    if (maxColNeeded > (newGrid[0]?.length || 0)) {
      const colsToAdd = maxColNeeded - (newGrid[0]?.length || 0);
      newGrid = newGrid.map((row) => [...row, ...Array(colsToAdd).fill("")]);
    }

    // Fill data
    parsedData.forEach((row, rIdx) => {
      if (startRow + rIdx >= newGrid.length) return; // safety
      newGrid[startRow + rIdx] = [...(newGrid[startRow + rIdx] || [])];
      row.forEach((cell, cIdx) => {
        if (startCol + cIdx >= (newGrid[startRow + rIdx]?.length || 0)) return; // safety
        const targetRow = newGrid[startRow + rIdx];
        if (targetRow) targetRow[startCol + cIdx] = cell;
      });
    });

    setGrid(newGrid);
  }, [grid]);

  const addRow = () => {
    setGrid([...grid, Array(grid[0]?.length || initialCols).fill("")]);
  };

  const addColumn = () => {
    setGrid(grid.map((row) => [...row, ""]));
  };

  const removeRow = (rowIndex: number) => {
    if (grid.length <= 1) return;
    setGrid(grid.filter((_, idx) => idx !== rowIndex));
  };

  const removeColumn = (colIndex: number) => {
    if ((grid[0]?.length || 0) <= 1) return;
    setGrid(grid.map((row) => row.filter((_, idx) => idx !== colIndex)));
  };

  return (
    <div className="data-grid-container" style={{ overflowX: "auto", paddingBottom: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "max-content" }}>
        <thead>
          <tr>
            <th style={{ width: 40, border: "1px solid #ddd", background: "#f9f9f9" }}></th>
            {Array.from({ length: grid[0]?.length || 0 }).map((_, colIndex) => (
              <th key={colIndex} style={{ border: "1px solid #ddd", padding: "4px", background: "#f9f9f9", textAlign: "center", minWidth: "100px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#666" }}>{String.fromCharCode(65 + (colIndex % 26))}</span>
                  <button
                    type="button"
                    onClick={() => removeColumn(colIndex)}
                    title="Remover Coluna"
                    aria-label="Remover Coluna"
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                  >
                    <Trash2 size={12} color="#999" />
                  </button>
                </div>
              </th>
            ))}
            <th style={{ border: "none", padding: "4px" }}>
               <button
                  type="button"
                  onClick={addColumn}
                  title="Adicionar Coluna"
                  aria-label="Adicionar Coluna"
                  className="btn"
                  style={{ padding: "4px", minWidth: "unset" }}
                >
                  <Plus size={16} />
                </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {grid.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td style={{ border: "1px solid #ddd", background: "#f9f9f9", textAlign: "center", fontSize: "12px", color: "#666", padding: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  {rowIndex + 1}
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    title="Remover Linha"
                    aria-label="Remover Linha"
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                  >
                    <Trash2 size={12} color="#999" />
                  </button>
                </div>
              </td>
              {row.map((cell, colIndex) => (
                <td key={colIndex} style={{ border: "1px solid #ddd", padding: 0 }}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => handleChange(rowIndex, colIndex, e.target.value)}
                    onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                    style={{
                      width: "100%",
                      minWidth: "100px",
                      border: "none",
                      padding: "6px 8px",
                      outline: "none",
                      boxSizing: "border-box",
                      background: "transparent",
                      fontSize: "14px"
                    }}
                    onFocus={(e) => e.target.style.background = "#eef4ff"}
                    onBlur={(e) => e.target.style.background = "transparent"}
                  />
                </td>
              ))}
              <td style={{ border: "none" }}></td>
            </tr>
          ))}
          <tr>
            <td colSpan={(grid[0]?.length || 0) + 1} style={{ border: "none", paddingTop: "8px", textAlign: "center" }}>
              <button
                type="button"
                aria-label="Adicionar Linha"
                title="Adicionar Linha"
                onClick={addRow}
                className="btn"
                style={{ padding: "4px 8px" }}
              >
                <Plus size={16} /> <span style={{ marginLeft: 4 }}>Adicionar Linha</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        <button
          className="btn primary"
          onClick={() => onSave(grid)}
        >
          Salvar Tabela e Atualizar Amostra
        </button>
      </div>
    </div>
  );
}
