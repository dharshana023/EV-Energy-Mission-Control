
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Play, User, Cpu, ChevronRight, Hash, Grid3X3, Circle, Square, Info, Activity } from 'lucide-react';

type GameType = 'go' | 'sudoku';

export default function BoardGames() {
  const [activeGame, setActiveGame] = useState<GameType>('go');

  return (
    <div className="space-y-6">
      {/* Game Selector */}
      <div className="flex bg-[#151619] p-1 rounded-xl border border-white/10 w-fit">
        {[
          { id: 'go', label: 'Go Strategy', icon: Circle },
          { id: 'sudoku', label: 'Sudo Logic', icon: Hash }
        ].map(game => (
          <button
            key={game.id}
            onClick={() => setActiveGame(game.id as GameType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all ${
              activeGame === game.id ? 'bg-orange-500 text-black font-bold' : 'text-white/40 hover:bg-white/5'
            }`}
          >
            <game.icon size={14} />
            {game.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeGame === 'go' && <GoGame key="go" />}
        {activeGame === 'sudoku' && <SudokuGame key="sudoku" />}
      </AnimatePresence>
    </div>
  );
}

// --- GO GAME COMPONENT ---
function GoGame() {
  const SIZE = 9;
  const [board, setBoard] = useState<(null | 'black' | 'white')[]>(new Array(SIZE * SIZE).fill(null));
  const [turn, setTurn] = useState<'black' | 'white'>('black');
  const [captures, setCaptures] = useState({ black: 0, white: 0 });
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [history, setHistory] = useState<(null | 'black' | 'white')[][]>([]);

  const getNeighbors = (index: number) => {
    const neighbors = [];
    const x = index % SIZE;
    const y = Math.floor(index / SIZE);
    if (x > 0) neighbors.push(index - 1);
    if (x < SIZE - 1) neighbors.push(index + 1);
    if (y > 0) neighbors.push(index - SIZE);
    if (y < SIZE - 1) neighbors.push(index + SIZE);
    return neighbors;
  };

  const getGroup = (index: number, currentBoard: (null | 'black' | 'white')[]) => {
    const color = currentBoard[index];
    if (!color) return new Set<number>();
    const group = new Set<number>([index]);
    const stack = [index];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      for (const neighbor of getNeighbors(curr)) {
        if (currentBoard[neighbor] === color && !group.has(neighbor)) {
          group.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    return group;
  };

  const getLiberties = (group: Set<number>, currentBoard: (null | 'black' | 'white')[]) => {
    const liberties = new Set<number>();
    for (const index of group) {
      for (const neighbor of getNeighbors(index)) {
        if (currentBoard[neighbor] === null) {
          liberties.add(neighbor);
        }
      }
    }
    return liberties.size;
  };

  const placeStone = (index: number) => {
    if (board[index]) return;
    
    let newBoard = [...board];
    newBoard[index] = turn;
    
    const opponent = turn === 'black' ? 'white' : 'black';
    let capturedAny = false;
    let newCaptures = { ...captures };

    // Check neighbors for captures
    for (const neighbor of getNeighbors(index)) {
      if (newBoard[neighbor] === opponent) {
        const group = getGroup(neighbor, newBoard);
        if (getLiberties(group, newBoard) === 0) {
          group.forEach(i => {
            newBoard[i] = null;
          });
          newCaptures[turn] += group.size;
          capturedAny = true;
        }
      }
    }

    // Check for suicide
    const ownGroup = getGroup(index, newBoard);
    if (getLiberties(ownGroup, newBoard) === 0 && !capturedAny) {
      // Illegal move: suicide
      return;
    }
    
    // Check for Ko rule (board state cannot repeat previous state)
    const boardString = JSON.stringify(newBoard);
    const isKo = history.some(prevBoard => JSON.stringify(prevBoard) === boardString);
    if (isKo) {
      // Illegal move: Ko
      return;
    }
    
    setHistory([...history, board]);
    setLastMove(index);
    setBoard(newBoard);
    setCaptures(newCaptures);
    setTurn(turn === 'black' ? 'white' : 'black');
  };

  const undoMove = () => {
    if (history.length === 0) return;
    const prevBoard = history[history.length - 1];
    setBoard(prevBoard);
    setHistory(history.slice(0, -1));
    setTurn(turn === 'black' ? 'white' : 'black');
    setLastMove(null);
  };

  const passTurn = () => {
    setTurn(turn === 'black' ? 'white' : 'black');
    setLastMove(null);
  };

  const reset = () => {
    setBoard(new Array(SIZE * SIZE).fill(null));
    setTurn('black');
    setCaptures({ black: 0, white: 0 });
    setHistory([]);
    setLastMove(null);
  };

  const resign = () => {
    reset();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <div className="bg-[#151619] p-8 rounded-2xl border border-white/10 flex flex-col items-center">
        <div className="bg-[#dcb35c] p-1 rounded-sm shadow-2xl border-4 border-[#8b4513]">
          <div className="grid grid-cols-9 grid-rows-9 gap-0 bg-[#dcb35c]">
            {board.map((stone, i) => (
              <div 
                key={i} 
                onClick={() => placeStone(i)}
                className="w-8 h-8 border border-black/20 flex items-center justify-center cursor-pointer relative group"
              >
                {/* Grid lines */}
                <div className="absolute w-full h-px bg-black/40 top-1/2 left-0" />
                <div className="absolute h-full w-px bg-black/40 left-1/2 top-0" />
                
                {stone ? (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-7 h-7 rounded-full shadow-md z-10 relative ${
                      stone === 'black' ? 'bg-black' : 'bg-white'
                    }`}
                  >
                    {lastMove === i && (
                      <div className={`absolute inset-0 rounded-full border-2 ${stone === 'black' ? 'border-white/30' : 'border-black/30'}`} />
                    )}
                  </motion.div>
                ) : (
                  <div className={`w-7 h-7 rounded-full opacity-0 group-hover:opacity-30 z-10 ${
                    turn === 'black' ? 'bg-black' : 'bg-white'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between w-full max-w-xs">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
              turn === 'black' ? 'border-orange-500 scale-110' : 'border-white/10'
            }`}>
              <div className="w-6 h-6 rounded-full bg-black shadow-lg" />
            </div>
            <span className="text-[10px] font-mono uppercase text-white/40">Black ({captures.black})</span>
          </div>

          <button onClick={undoMove} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60">
            <RotateCcw size={18} />
          </button>

          <div className="flex flex-col gap-2">
            <button 
              onClick={passTurn}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-[10px] font-mono uppercase text-white/60 transition-all"
            >
              Pass Turn
            </button>
            <button 
              onClick={resign}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 text-[10px] font-mono uppercase text-red-500 transition-all"
            >
              Resign
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
              turn === 'white' ? 'border-orange-500 scale-110' : 'border-white/10'
            }`}>
              <div className="w-6 h-6 rounded-full bg-white shadow-lg" />
            </div>
            <span className="text-[10px] font-mono uppercase text-white/40">White ({captures.white})</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <h3 className="text-sm font-mono uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
            <Info className="text-orange-500" size={16} /> Go Strategy Rules
          </h3>
          <ul className="space-y-3 text-[10px] font-mono text-white/60 uppercase">
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> Surround territory to win points.</li>
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> Capture stones by removing their liberties.</li>
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> "sudo go" - Execute strategic dominance.</li>
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> This is a 9x9 simplified board.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// --- SUDOKU GAME COMPONENT ---
function SudokuGame() {
  const [grid, setGrid] = useState<(number | null)[]>(new Array(16).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const setNumber = (num: number) => {
    if (selected === null || fixed[selected]) return;
    const newGrid = [...grid];
    newGrid[selected] = num;
    setGrid(newGrid);
    setIsCorrect(null);
    setValidationMessage(null);
  };

  const validate = () => {
    // Check if full
    if (grid.some(val => val === null)) {
      setIsCorrect(false);
      setValidationMessage('Grid Incomplete. Fill all cells.');
      return;
    }

    const isValid = (arr: (number | null)[]) => {
      const nums = arr.filter(n => n !== null);
      return new Set(nums).size === nums.length && nums.length === 4;
    };

    let allValid = true;
    // Rows
    for (let i = 0; i < 4; i++) {
      if (!isValid(grid.slice(i * 4, i * 4 + 4))) allValid = false;
    }
    // Cols
    for (let i = 0; i < 4; i++) {
      const col = [grid[i], grid[i + 4], grid[i + 8], grid[i + 12]];
      if (!isValid(col)) allValid = false;
    }
    // Boxes
    const boxes = [
      [grid[0], grid[1], grid[4], grid[5]],
      [grid[2], grid[3], grid[6], grid[7]],
      [grid[8], grid[9], grid[12], grid[13]],
      [grid[10], grid[11], grid[14], grid[15]]
    ];
    for (const box of boxes) {
      if (!isValid(box)) allValid = false;
    }

    setIsCorrect(allValid);
    setValidationMessage(allValid ? 'Grid is Correct! Strategic Dominance Achieved.' : 'Invalid Configuration. Re-analyze Logic.');
  };

  const [fixed, setFixed] = useState<boolean[]>(new Array(16).fill(false));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const generatePuzzle = () => {
    // 4x4 Sudoku Solver/Generator
    const isValidPlacement = (board: (number | null)[], row: number, col: number, num: number) => {
      // Row
      for (let i = 0; i < 4; i++) if (board[row * 4 + i] === num) return false;
      // Col
      for (let i = 0; i < 4; i++) if (board[i * 4 + col] === num) return false;
      // Box
      const boxRow = Math.floor(row / 2) * 2;
      const boxCol = Math.floor(col / 2) * 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (board[(boxRow + i) * 4 + (boxCol + j)] === num) return false;
        }
      }
      return true;
    };

    const solve = (board: (number | null)[]): boolean => {
      for (let i = 0; i < 16; i++) {
        if (board[i] === null) {
          const nums = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
          for (const num of nums) {
            const row = Math.floor(i / 4);
            const col = i % 4;
            if (isValidPlacement(board, row, col, num)) {
              board[i] = num;
              if (solve(board)) return true;
              board[i] = null;
            }
          }
          return false;
        }
      }
      return true;
    };

    const fullGrid = new Array(16).fill(null);
    solve(fullGrid);

    // Remove numbers to create puzzle
    const puzzle = [...fullGrid];
    const newFixed = new Array(16).fill(false);
    const indices = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
    
    // Keep 6-8 numbers
    const keepCount = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < 16; i++) {
      if (i < keepCount) {
        newFixed[indices[i]] = true;
      } else {
        puzzle[indices[i]] = null;
      }
    }

    setGrid(puzzle);
    setFixed(newFixed);
    setIsCorrect(null);
    setValidationMessage(null);
  };

  useEffect(() => {
    generatePuzzle();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <div className="bg-[#151619] p-8 rounded-2xl border border-white/10 flex flex-col items-center">
        <div className="grid grid-cols-4 grid-rows-4 gap-1 p-1 bg-white/10 rounded-xl border border-white/10">
          {grid.map((val, i) => (
            <div 
              key={i} 
              onClick={() => setSelected(i)}
              className={`w-14 h-14 flex items-center justify-center text-xl font-bold font-mono cursor-pointer transition-all rounded-lg ${
                selected === i ? 'bg-orange-500 text-black' : fixed[i] ? 'bg-white/20 text-white/90' : 'bg-white/5 text-white hover:bg-white/10'
              } ${
                (Math.floor(i / 4) < 2 && i % 4 < 2) || (Math.floor(i / 4) >= 2 && i % 4 >= 2) ? 'border border-white/10' : ''
              }`}
            >
              {val}
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(num => (
            <button 
              key={num}
              onClick={() => setNumber(num)}
              className="w-12 h-12 bg-white/5 hover:bg-orange-500 hover:text-black rounded-xl border border-white/10 font-bold transition-all"
            >
              {num}
            </button>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={validate} className="px-6 py-3 bg-orange-500 text-black font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:scale-105 transition-all uppercase text-[10px] font-mono">
            Validate Grid
          </button>
          <button onClick={generatePuzzle} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60 flex items-center gap-2 text-[10px] font-mono uppercase">
            <Play size={14} /> New Puzzle
          </button>
          <button onClick={() => { setGrid(new Array(16).fill(null)); setFixed(new Array(16).fill(false)); setIsCorrect(null); setValidationMessage(null); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60 flex items-center gap-2 text-[10px] font-mono uppercase">
            <RotateCcw size={14} /> Clear
          </button>
        </div>

        {validationMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-xl border ${
              isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
            } text-center font-mono text-[10px] uppercase tracking-wider`}
          >
            {validationMessage}
          </motion.div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <h3 className="text-sm font-mono uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
            <Info className="text-orange-500" size={16} /> Sudo Logic Rules
          </h3>
          <ul className="space-y-3 text-[10px] font-mono text-white/60 uppercase">
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> Fill the 4x4 grid with numbers 1-4.</li>
            <li className="flex gap-2"><ChevronRight size={12} className="text-orange-500 shrink-0" /> Each row, column, and 2x2 box must contain all numbers.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
