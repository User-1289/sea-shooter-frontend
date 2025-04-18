"use client";
import React from 'react';

export type CellState = 'empty' | 'ship' | 'miss' | 'hit';

interface BoardProps {
  grid: CellState[][];
  onCellClick?: (x: number, y: number) => void;
  showShips?: boolean;
}

const Board: React.FC<BoardProps> = ({ grid, onCellClick, showShips = false }) => {
  return (
    <div className="grid grid-cols-10 gap-1">
      {grid.map((row, y) =>
        row.map((cell, x) => {
          let className = 'w-8 h-8 border';
          if (cell === 'ship' && showShips) className += ' bg-blue-300';
          else if (cell === 'hit') className += ' bg-red-500';
          else if (cell === 'miss') className += ' bg-gray-300';
          else className += ' bg-blue-200';
          return (
            <div
              key={`${x}-${y}`}
              className={className + (onCellClick ? ' cursor-pointer hover:opacity-75' : '')}
              onClick={() => onCellClick && onCellClick(x, y)}
            >
              {cell === 'ship' && showShips && (
                <span className="flex items-center justify-center w-full h-full text-black text-xs">🚢</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default Board;