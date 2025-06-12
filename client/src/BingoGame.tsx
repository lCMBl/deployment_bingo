import { useEffect, useState } from 'react';
import { DbConnection, type EventContext, BingoBoard, GameSession, Player, PlayerSession, BoardItem } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

interface BingoGameProps {
  conn: DbConnection;
  gameSessionId: number;
  currentPlayer: Player;
  players: Map<string, Player>;
  gameSessions: GameSession[];
  playerSessions: PlayerSession[];
  onBack: () => void;
}

function useBingoBoard(conn: DbConnection | null, playerId: Identity | null, gameSessionId: number | null): BingoBoard | null {
  const [bingoBoard, setBingoBoard] = useState<BingoBoard | null>(null);

  useEffect(() => {
    if (!conn || !playerId || !gameSessionId) return;

    // Check for existing board in cache
    for (const board of conn.db.bingoBoard.iter()) {
      if (board.playerId.toHexString() === playerId.toHexString() && board.gameSessionId === gameSessionId) {
        setBingoBoard(board);
        break;
      }
    }

    const onInsert = (_ctx: EventContext, board: BingoBoard) => {
      if (board.playerId.toHexString() === playerId.toHexString() && board.gameSessionId === gameSessionId) {
        setBingoBoard(board);
      }
    };
    conn.db.bingoBoard.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldBoard: BingoBoard, newBoard: BingoBoard) => {
      if (newBoard.playerId.toHexString() === playerId.toHexString() && newBoard.gameSessionId === gameSessionId) {
        console.log(`Bingo board updated for player ${playerId.toHexString()} in session ${gameSessionId}`);
        console.log('Old board:', oldBoard);
        console.log('New board:', newBoard);
        setBingoBoard(newBoard);
      }
    };
    conn.db.bingoBoard.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, board: BingoBoard) => {
      if (board.playerId.toHexString() === playerId.toHexString() && board.gameSessionId === gameSessionId) {
        setBingoBoard(null);
      }
    };
    conn.db.bingoBoard.onDelete(onDelete);

    return () => {
      conn.db.bingoBoard.removeOnInsert(onInsert);
      conn.db.bingoBoard.removeOnUpdate(onUpdate);
      conn.db.bingoBoard.removeOnDelete(onDelete);
    };
  }, [conn, playerId, gameSessionId]);

  return bingoBoard;
}

function BingoGame({ conn, gameSessionId, currentPlayer, players, gameSessions, playerSessions, onBack }: BingoGameProps) {
  const gameSession = gameSessions.find(session => session.id === gameSessionId);
  const bingoBoard = useBingoBoard(conn, currentPlayer.identity, gameSessionId);
  
  if (!gameSession) {
    return (
      <div className="bingo-game-container">
        <p>Game session not found</p>
        <button onClick={onBack}>Back to Main</button>
      </div>
    );
  }

  // Get players in this game session
  const playersInGame = playerSessions
    .filter(ps => ps.gameSessionId === gameSessionId)
    .map(ps => players.get(ps.playerId.toHexString()))
    .filter(p => p !== undefined) as Player[];

  // Create a map of item positions to board items
  const boardItemsMap = new Map<string, BoardItem>();
  if (bingoBoard) {
    bingoBoard.bingoItemTiles.forEach(tile => {
      const boardItem = gameSession.boardItems.find(item => item.id === tile.id);
      if (boardItem) {
        boardItemsMap.set(`${tile.x}-${tile.y}`, boardItem);
      }
    });
  }

  const handleTileClick = (x: number, y: number, item: BoardItem | undefined) => {
    if (item) {
      console.log(`Clicked bingo item at (${x}, ${y}): "${item.body}" - Checked: ${item.checked}`);
      // In the future, this will cast a vote to check off the item
      conn.reducers.castCheckOffVote(gameSessionId, item.id);
    }
  };

  return (
    <div className="bingo-game-container">
      <div className="game-title-bar">
        <h2 className="game-title">{gameSession.name}</h2>
        <button className="back-button" onClick={onBack}>
          ← Back to Main
        </button>
      </div>

      <div className="game-players-bar">
        <h3>Players in Game ({playersInGame.length})</h3>
        <div className="game-player-list">
          {playersInGame.map(player => (
            <div key={player.identity.toHexString()} className="game-player-item">
              <span className={`status-indicator ${player.online ? 'online' : 'offline'}`}>{player.online ? '●' : '○'}</span>
              <span>{player.name || player.identity.toHexString().substring(0, 8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bingo-grid-container">
        {!bingoBoard ? (
          <div className="loading-message">
            <p>Loading bingo board...</p>
          </div>
        ) : (
          <div className="bingo-grid">
            {Array.from({ length: 5 }, (_, y) => (
              Array.from({ length: 5 }, (_, x) => {
                const item = boardItemsMap.get(`${x}-${y}`);
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`bingo-cell ${item?.checked ? 'checked' : ''}`}
                    onClick={() => handleTileClick(x, y, item)}
                  >
                    <div className="bingo-item-text">
                      {item ? item.body : 'Empty'}
                    </div>
                  </div>
                );
              })
            )).flat()}
          </div>
        )}
      </div>

      {gameSession.winner && (
        <div className="winner-banner">
          <h3>🎉 Winner: {players.get(gameSession.winner.toHexString())?.name || 'Unknown'} 🎉</h3>
        </div>
      )}
    </div>
  );
}

export default BingoGame;
