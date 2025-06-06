import React, { useEffect, useState } from 'react';
import './App.css';
import { DbConnection, type ErrorContext, type EventContext, Player, GameSession, BingoItem, PlayerItemSubject } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

export type PlayerStatus = {
  name: string;
  online: boolean;
}

function usePlayers(conn: DbConnection | null): Map<string, Player> {
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, player: Player) => {
      setPlayers(prev => new Map(prev.set(player.identity.toHexString(), player)));
    };
    conn.db.player.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldPlayer: Player, newPlayer: Player) => {
      setPlayers(prev => {
        prev.delete(oldPlayer.identity.toHexString());
        return new Map(prev.set(newPlayer.identity.toHexString(), newPlayer));
      });
    };
    conn.db.player.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, player: Player) => {
      setPlayers(prev => {
        prev.delete(player.identity.toHexString());
        return new Map(prev);
      });
    };
    conn.db.player.onDelete(onDelete);

    return () => {
      conn.db.player.removeOnInsert(onInsert);
      conn.db.player.removeOnUpdate(onUpdate);
      conn.db.player.removeOnDelete(onDelete);
    };
  }, [conn]);

  return players;
}

function useGameSessions(conn: DbConnection | null): GameSession[] {
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);

  useEffect(() => {
    if (!conn) return;
    
    const onInsert = (_ctx: EventContext, gameSession: GameSession) => {
      setGameSessions(prev => [...prev, gameSession].sort((a, b) => b.id - a.id));
    };
    conn.db.gameSession.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldSession: GameSession, newSession: GameSession) => {
      setGameSessions(prev => {
        const filtered = prev.filter(s => s.id !== oldSession.id);
        return [...filtered, newSession].sort((a, b) => b.id - a.id);
      });
    };
    conn.db.gameSession.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, gameSession: GameSession) => {
      setGameSessions(prev => prev.filter(s => s.id !== gameSession.id));
    };
    conn.db.gameSession.onDelete(onDelete);

    return () => {
      conn.db.gameSession.removeOnInsert(onInsert);
      conn.db.gameSession.removeOnUpdate(onUpdate);
      conn.db.gameSession.removeOnDelete(onDelete);
    };
  }, [conn]);

  return gameSessions;
}

function useBingoItems(conn: DbConnection | null): BingoItem[] {
  const [bingoItems, setBingoItems] = useState<BingoItem[]>([]);

  useEffect(() => {
    if (!conn) return;
    
    const onInsert = (_ctx: EventContext, bingoItem: BingoItem) => {
      setBingoItems(prev => [...prev, bingoItem].sort((a, b) => b.id - a.id));
    };
    conn.db.bingoItem.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldItem: BingoItem, newItem: BingoItem) => {
      setBingoItems(prev => {
        const filtered = prev.filter(item => item.id !== oldItem.id);
        return [...filtered, newItem].sort((a, b) => b.id - a.id);
      });
    };
    conn.db.bingoItem.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, bingoItem: BingoItem) => {
      setBingoItems(prev => prev.filter(item => item.id !== bingoItem.id));
    };
    conn.db.bingoItem.onDelete(onDelete);

    return () => {
      conn.db.bingoItem.removeOnInsert(onInsert);
      conn.db.bingoItem.removeOnUpdate(onUpdate);
      conn.db.bingoItem.removeOnDelete(onDelete);
    };
  }, [conn]);

  return bingoItems;
}

function usePlayerItemSubjects(conn: DbConnection | null): PlayerItemSubject[] {
  const [subjects, setSubjects] = useState<PlayerItemSubject[]>([]);

  useEffect(() => {
    if (!conn) return;
    
    const onInsert = (_ctx: EventContext, subject: PlayerItemSubject) => {
      setSubjects(prev => [...prev, subject]);
    };
    conn.db.playerItemSubject.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, subject: PlayerItemSubject) => {
      setSubjects(prev => prev.filter(s => 
        s.bingoItemId !== subject.bingoItemId || 
        s.playerId.toHexString() !== subject.playerId.toHexString()
      ));
    };
    conn.db.playerItemSubject.onDelete(onDelete);

    return () => {
      conn.db.playerItemSubject.removeOnInsert(onInsert);
      conn.db.playerItemSubject.removeOnDelete(onDelete);
    };
  }, [conn]);

  return subjects;
}

function useCurrentPlayer(conn: DbConnection | null, identity: Identity | null): Player | undefined {
  const players = usePlayers(conn);
  if (!identity) return undefined;
  return players.get(identity.toHexString());
}

function App() {
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [settingName, setSettingName] = useState(false);
  const [newBingoItem, setNewBingoItem] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);

  const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingName(false);
    conn?.reducers.setName(newName)
  };

  useEffect(() => {
    const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
      conn
        ?.subscriptionBuilder()
        .onApplied(() => {
          console.log('SDK client cache initialized.');
        })
        .subscribe(queries);
    };

    const onConnect = (
      conn: DbConnection,
      identity: Identity,
      token: string
    ) => {
      setIdentity(identity);
      setConnected(true);
      localStorage.setItem('auth_token', token);
      console.log(
        'Connected to SpacetimeDB with identity:',
        identity.toHexString()
      );
      
      // Set up reducer callbacks
      conn.reducers.onSignIn(() => {
        console.log('Signed in successfully.');
      });

      subscribeToQueries(conn, [
        'SELECT * FROM player',
        'SELECT * FROM game_session',
        'SELECT * FROM player_session',
        'SELECT * FROM bingo_item',
        'SELECT * FROM player_item_subject',
      ]);
    };

    const onDisconnect = () => {
      console.log('Disconnected from SpacetimeDB');
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log('error ctx:', _ctx);
      console.log('Error connecting to SpacetimeDB:', err);
    };

    setConn(
      DbConnection.builder()
        .withUri('ws://localhost:3000')
        .withModuleName('deployment-bingo')
        .withToken(localStorage.getItem('auth_token') || '')
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build()
    );
  }, []);

  const players = usePlayers(conn);
  const gameSessions = useGameSessions(conn);
  const bingoItems = useBingoItems(conn);
  const playerItemSubjects = usePlayerItemSubjects(conn);
  const currentPlayer = useCurrentPlayer(conn, identity);

  if (!conn || !connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting...</h1>
      </div>
    );
  }

  // Show landing page if user is not signed in
  if (!currentPlayer) {
    const handleSignIn = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      conn.reducers.signIn(password);
    };

    return (
      <div className="App">
        <div className="landing-page">
          <h1>Deployment Bingo</h1>
          <p>Welcome to Deployment Bingo! Track deployment milestones and compete with your team.</p>
          <p>Join the fun by signing in with the team password.</p>
          <form onSubmit={handleSignIn}>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // Main interface for signed-in users
  const handleSubmitBingoItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newBingoItem.trim()) {
      // Convert selected player hex strings to Identity objects
      const selectedIdentities = selectedPlayers.length > 0 
        ? selectedPlayers.map(hexString => Identity.fromString(hexString))
        : undefined;
      
      conn.reducers.submitNewBingoItem(newBingoItem.trim(), selectedIdentities);
      setNewBingoItem('');
      setSelectedPlayers([]);
    }
  };

  const handlePlayerSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.options;
    const selected: string[] = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    setSelectedPlayers(selected);
  };

  const name = currentPlayer.name || identity.toHexString().substring(0, 8);

  return (
    <div className="App">
      <div className="profile">
        <h1>Deployment Bingo</h1>
        {!settingName ? (
          <>
            <p>{name}</p>
            <button
              onClick={() => {
                setSettingName(true);
                setNewName(name);
              }}
            >
              Edit Name
            </button>
          </>
        ) : (
          <form onSubmit={onSubmitNewName}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </div>
      
      <div className="players">
        <h2>Players</h2>
        <div className="player-list">
          {Array.from(players.values()).map((player) => (
            <div key={player.identity.toHexString()} className="player-item">
              <span className={`status-indicator ${player.online ? 'online' : 'offline'}`}>●</span>
              <span>{player.name || player.identity.toHexString().substring(0, 8)}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="game-sessions">
        <h2>Game Sessions</h2>
        {gameSessions.length === 0 ? (
          <p>No game sessions yet</p>
        ) : (
          <div className="sessions-list">
            {gameSessions.map((session) => (
              <div key={session.id} className="session-item">
                <h3>{session.name}</h3>
                <p>Status: {session.active ? 'Active' : 'Completed'}</p>
                {session.winner && (
                  <p>Winner: {players.get(session.winner.toHexString())?.name || 'Unknown'}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <button 
          className="create-game-button"
          onClick={() => {
            const gameName = `Game Session ${gameSessions.length + 1}`;
            conn.reducers.startNewGame(gameName);
          }}
        >
          Create New Game Session
        </button>
      </div>
      
      <div className="new-bingo-item">
        <form
          onSubmit={handleSubmitBingoItem}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '50%',
            margin: '0 auto',
          }}
        >
          <h3>New Bingo Item</h3>
          <textarea
            value={newBingoItem}
            onChange={(e) => setNewBingoItem(e.target.value)}
            placeholder="Enter a new bingo item..."
            rows={3}
          ></textarea>
          
          <div className="player-select-container">
            <label htmlFor="player-select">Select Player(s) that are the subject of this bingo item, e.g. select Frank if the bingo item is "Frank Swears" (optional):</label>
            <select
              id="player-select"
              multiple
              value={selectedPlayers}
              onChange={handlePlayerSelectionChange}
              className="player-select"
            >
              {Array.from(players.values()).map((player) => (
                <option 
                  key={player.identity.toHexString()} 
                  value={player.identity.toHexString()}
                >
                  {player.name || player.identity.toHexString().substring(0, 8)}
                </option>
              ))}
            </select>
            {selectedPlayers.length > 0 && (
              <p className="selected-count">{selectedPlayers.length} player(s) selected</p>
            )}
          </div>
          
          <button type="submit">Submit</button>
        </form>
      </div>
      
      <div className="bingo-items">
        <h2>Bingo Items ({bingoItems.length})</h2>
        {bingoItems.length === 0 ? (
          <p>No bingo items yet</p>
        ) : (
          <div className="bingo-items-list">
            {bingoItems.map((item) => {
              const itemSubjects = playerItemSubjects.filter(s => s.bingoItemId === item.id);
              const subjectPlayers = itemSubjects
                .map(s => players.get(s.playerId.toHexString()))
                .filter(p => p !== undefined) as Player[];
              
              return (
                <div key={item.id} className="bingo-item">
                  <div className="bingo-item-content">
                    <span className="bingo-item-body">{item.body}</span>
                    {subjectPlayers.length > 0 && (
                      <span className="bingo-item-players">
                        Players: {subjectPlayers.map(p => p.name || p.identity.toHexString().substring(0, 8)).join(', ')}
                      </span>
                    )}
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => conn.reducers.deleteBingoItem(item.id)}
                    title="Delete bingo item"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
