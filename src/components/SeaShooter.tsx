"use client";
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Board, { CellState } from './Board';

interface Ship {
  coordinates: { x: number; y: number }[];
}

type GameStage =
  | 'lobby'
  | 'waitingForOpponent'
  | 'placeShips'
  | 'waitingForPlacement'
  | 'playing'
  | 'gameOver';

const SeaShooter: React.FC = () => {
  const [socket, setSocket] = useState<any | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [stage, setStage] = useState<GameStage>('lobby');
  const [status, setStatus] = useState<string>('');
  // Ship placement state
  const shipTypes = [
    { name: 'Carrier', length: 5, count: 1 },
    { name: 'Battleship', length: 4, count: 1 },
    { name: 'Cruiser', length: 3, count: 1 },
    { name: 'Submarine', length: 3, count: 1 },
    { name: 'Destroyer', length: 2, count: 1 },
  ];
  const totalShips = shipTypes.length;
  const [shipsToPlace, setShipsToPlace] = useState(shipTypes);
  const [currentShip, setCurrentShip] = useState<{ name: string; length: number } | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [placedShips, setPlacedShips] = useState<{ name: string; coordinates: { x: number; y: number }[] }[]>([]);
  const [ownBoard, setOwnBoard] = useState<CellState[][]>(() =>
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'empty'))
  );
  const [opponentBoard, setOpponentBoard] = useState<CellState[][]>(() =>
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'empty'))
  );
  const [turnId, setTurnId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  useEffect(() => {
    const s = io(process.env.SERVER_URL || 'http://localhost:3000');
    setSocket(s);

    s.on('connect', () => {
      setClientId(s.id);
    });

    s.on('gameStarted', ({ turn }: { turn: string }) => {
      setStage('placeShips');
      setTurnId(turn);
      setStatus('Game started. Place your ships.');
    });

    s.on('allShipsPlaced', ({ turn }: { turn: string }) => {
      setStage('playing');
      setTurnId(turn);
      setStatus(turn === s.id ? 'Your turn' : 'Opponent turn');
    });

    s.on(
      'shotResult',
      (data: { shooter: string; x: number; y: number; hit: boolean; sunk: boolean; winner?: string }) => {
        const { shooter, x, y, hit, winner } = data;
        if (shooter === s.id) {
          setOpponentBoard(prev => {
            const newBoard = prev.map(row => [...row]);
            newBoard[y][x] = hit ? 'hit' : 'miss';
            return newBoard;
          });
        } else {
          setOwnBoard(prev => {
            const newBoard = prev.map(row => [...row]);
            newBoard[y][x] = hit ? 'hit' : 'miss';
            return newBoard;
          });
        }
        if (winner) {
          setStage('gameOver');
          setWinnerId(winner);
          setStatus(winner === s.id ? 'You won!' : 'You lost!');
        }
      }
    );

    s.on('turnChanged', ({ turn }: { turn: string }) => {
      setTurnId(turn);
      setStatus(turn === s.id ? 'Your turn' : 'Opponent turn');
    });

    s.on('gameOver', ({ winner }: { winner: string }) => {
      setStage('gameOver');
      setWinnerId(winner);
      setStatus(winner === s.id ? 'You won!' : 'You lost!');
    });

    s.on('playerLeft', () => {
      setStatus('Opponent left. Returning to lobby.');
      setStage('lobby');
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleCreateGame = () => {
    if (!socket) return;
    socket.emit('createGame', (response: { status: string; gameId?: string; message?: string }) => {
      if (response.status === 'ok' && response.gameId) {
        setGameId(response.gameId);
        setStage('waitingForOpponent');
        setStatus(`Game created: ${response.gameId}. Waiting for opponent...`);
      } else {
        setStatus(response.message || 'Error creating game.');
      }
    });
  };

  const handleJoinGame = () => {
    if (!socket) return;
    socket.emit('joinGame', { gameId }, (response: { status: string; turn?: string; message?: string }) => {
      if (response.status === 'ok' && response.turn) {
        setStage('placeShips');
        setTurnId(response.turn);
        setStatus('Joined game. Place your ships.');
      } else {
        setStatus(response.message || 'Error joining game.');
      }
    });
  };

  // Place a ship of selected type at clicked cell with current orientation
  const handlePlaceShipClick = (x: number, y: number) => {
    if (stage !== 'placeShips' || !currentShip) return;
    // Compute ship coordinates
    const coords = Array.from({ length: currentShip.length }, (_, i) => {
      const nx = orientation === 'horizontal' ? x + i : x;
      const ny = orientation === 'vertical' ? y + i : y;
      return { x: nx, y: ny };
    });
    // Validate placement
    for (const { x: nx, y: ny } of coords) {
      if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10 || ownBoard[ny][nx] !== 'empty') {
        setStatus('Invalid placement');
        return;
      }
    }
    // Place ship on own board
    setOwnBoard(prev => {
      const newBoard = prev.map(row => [...row]);
      coords.forEach(({ x: nx, y: ny }) => {
        newBoard[ny][nx] = 'ship';
      });
      return newBoard;
    });
    setPlacedShips(prev => [...prev, { name: currentShip.name, coordinates: coords }]);
    setShipsToPlace(prev => prev.map(s => s.name === currentShip.name ? { ...s, count: s.count - 1 } : s));
    setCurrentShip(null);
    setStatus(`${currentShip.name} placed`);
  };

  // Confirm all ships placement
  const handleConfirmPlacement = () => {
    if (!socket) return;
    const ships = placedShips.map(s => ({ coordinates: s.coordinates }));
    socket.emit('placeShips', { gameId, ships }, (response: { status: string; message?: string }) => {
      if (response.status === 'ok') {
        setStage('waitingForPlacement');
        setStatus('Waiting for opponent to place ships...');
      } else {
        setStatus(response.message || 'Error placing ships.');
      }
    });
  };

  const handleCellClickFire = (x: number, y: number) => {
    if (stage !== 'playing' || turnId !== clientId) return;
    if (opponentBoard[y][x] !== 'empty') return;
    if (!socket) return;
    socket.emit('fire', { gameId, x, y }, (response: { status: string; message?: string }) => {
      if (response.status !== 'ok') {
        setStatus(response.message || 'Error firing.');
      }
    });
  };

  return (
    <div className="p-4">
      {stage === 'lobby' && (
        <div className="space-y-4">
          <button onClick={handleCreateGame} className="px-4 py-2 bg-blue-500 text-white rounded">
            Create Game
          </button>
          <div className="flex space-x-2">
            <input
              value={gameId}
              onChange={e => setGameId(e.target.value.toUpperCase())}
              placeholder="Game ID"
              className="border px-2 py-1"
            />
            <button
              onClick={handleJoinGame}
              disabled={!gameId}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
            >
              Join Game
            </button>
          </div>
        </div>
      )}
      {(stage === 'waitingForOpponent' || stage === 'waitingForPlacement') && <div>{status}</div>}
      {stage === 'placeShips' && (
        <div>
          <div>{status}</div>
          <div className="mt-4">
            {/* Ship selection and orientation */}
            <div className="flex items-center space-x-4 mb-2">
              <div className="flex space-x-2">
                {shipsToPlace
                  .filter(s => s.count > 0)
                  .map(s => (
                    <button
                      key={s.name}
                      onClick={() => setCurrentShip({ name: s.name, length: s.length })}
                      className={`px-2 py-1 border rounded ${
                        currentShip?.name === s.name ? 'bg-blue-500 text-white' : ''
                      }`}
                    >
                      {s.name} ({s.length})
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setOrientation(o => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
                className="px-2 py-1 border rounded"
              >
                {orientation === 'horizontal' ? '↔️' : '↕️'}
              </button>
            </div>
            <Board grid={ownBoard} onCellClick={handlePlaceShipClick} showShips />
          </div>
          <div className="mt-2">
            <span>Ships placed: {placedShips.length}/{totalShips}</span>
            <button
              onClick={handleConfirmPlacement}
              disabled={placedShips.length < totalShips}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Confirm Placement
            </button>
          </div>
        </div>
      )}
      {stage === 'playing' && (
        <div>
          <div className="mb-2">{status}</div>
          <div className="flex space-x-8">
            <div>
              <h3 className="mb-1">Your Board</h3>
              <Board grid={ownBoard} showShips />
            </div>
            <div>
              <h3 className="mb-1">Opponent Board</h3>
              <Board grid={opponentBoard} onCellClick={handleCellClickFire} />
            </div>
          </div>
        </div>
      )}
      {stage === 'gameOver' && (
        <div>
          <div>{status}</div>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500 text-white rounded">
            Restart
          </button>
        </div>
      )}
    </div>
  );
};

export default SeaShooter;