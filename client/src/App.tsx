import React, { useEffect, useState } from 'react';
import './App.css';
import { DbConnection, type ErrorContext, type EventContext, Player, GameSession, BingoItem, PlayerItemSubject, PlayerSession } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import BingoGame from './BingoGame';

export type PlayerStatus = {
  name: string;
  online: boolean;
}

function usePlayers(conn: DbConnection | null, onIdentityUpdate?: (newIdentity: Identity) => void): Map<string, Player> {
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, player: Player) => {
      setPlayers(prev => new Map(prev.set(player.identity.toHexString(), player)));
    };
    conn.db.player.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldPlayer: Player, newPlayer: Player) => {
      console.log('onUpdate', oldPlayer, newPlayer);
      
      // Check if we're awaiting an identity update after sign-in
      if (sessionStorage.getItem('awaiting_identity_update') === 'true' && newPlayer.online && !oldPlayer.online) {
        console.log('Detected identity change after sign-in:', newPlayer.identity.toHexString());
        sessionStorage.removeItem('awaiting_identity_update');
        if (onIdentityUpdate) {
          onIdentityUpdate(newPlayer.identity);
        }
      }
      
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

function usePlayerSessions(conn: DbConnection | null): PlayerSession[] {
  const [playerSessions, setPlayerSessions] = useState<PlayerSession[]>([]);

  useEffect(() => {
    if (!conn) return;
    
    const onInsert = (_ctx: EventContext, playerSession: PlayerSession) => {
      setPlayerSessions(prev => [...prev, playerSession]);
    };
    conn.db.playerSession.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, playerSession: PlayerSession) => {
      setPlayerSessions(prev => prev.filter(ps => 
        ps.gameSessionId !== playerSession.gameSessionId || 
        ps.playerId.toHexString() !== playerSession.playerId.toHexString()
      ));
    };
    conn.db.playerSession.onDelete(onDelete);

    return () => {
      conn.db.playerSession.removeOnInsert(onInsert);
      conn.db.playerSession.removeOnDelete(onDelete);
    };
  }, [conn]);

  return playerSessions;
}

function useCurrentPlayer(conn: DbConnection | null, identity: Identity | null): Player | undefined {
  const players = usePlayers(conn);
  console.log('useCurrentPlayer', identity?.toHexString(), players);
  if (!identity) return undefined;
  console.log('useCurrentPlayer', identity.toHexString(), players.get(identity.toHexString()));
  return players.get(identity.toHexString());
}

function App() {
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newGameSessionName, setNewGameSessionName] = useState('');
  const [settingName, setSettingName] = useState(false);
  const [newBingoItem, setNewBingoItem] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'game'>('main');
  const [currentGameSessionId, setCurrentGameSessionId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

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
        // After sign-in, we need to detect the new identity from the player updates
        // The sign-in process should trigger a player update with online: true
        // We'll set a flag to capture the next online player as our new identity
        sessionStorage.setItem('awaiting_identity_update', 'true');
      });

      subscribeToQueries(conn, [
        'SELECT * FROM player',
        'SELECT * FROM game_session',
        'SELECT * FROM player_session',
        'SELECT * FROM bingo_item',
        'SELECT * FROM player_item_subject',
        `SELECT * FROM bingo_board WHERE player_id = '${identity.toHexString()}'`,
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
        .withUri('wss://api.everbingo.win')
        .withModuleName('deployment-bingo')
        .withToken(localStorage.getItem('auth_token') || '')
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build()
    );
  }, []);

  const handleIdentityUpdate = (newIdentity: Identity) => {
    console.log('Updating identity after sign-in:', newIdentity.toHexString());
    setIdentity(newIdentity);
    
    // Re-subscribe with the new identity for the bingo_board query
    if (conn) {
      const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
        conn
          ?.subscriptionBuilder()
          .onApplied(() => {
            console.log('SDK client cache re-initialized after identity update.');
          })
          .subscribe(queries);
      };

      subscribeToQueries(conn, [
        'SELECT * FROM player',
        'SELECT * FROM game_session',
        'SELECT * FROM player_session',
        'SELECT * FROM bingo_item',
        'SELECT * FROM player_item_subject',
        `SELECT * FROM bingo_board WHERE player_id = '${newIdentity.toHexString()}'`,
      ]);
    }
  };

  const players = usePlayers(conn, handleIdentityUpdate);
  const gameSessions = useGameSessions(conn);
  const bingoItems = useBingoItems(conn);
  const playerItemSubjects = usePlayerItemSubjects(conn);
  const playerSessions = usePlayerSessions(conn);
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
    // Check for invite token in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const handleSignIn = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      conn.reducers.signIn(loginName, password);
    };

    const handleCreatePlayer = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (token && password.length >= 4) {
        // First, use the player invite token
        conn.reducers.usePlayerInvite(token);
        
        // Set up callbacks for the signup flow
        const onInviteUsed = () => {
          conn.reducers.createPlayer(loginName, password);
          conn.reducers.removeOnUsePlayerInvite(onInviteUsed);
        };
        
        const onPlayerCreated = () => {
          conn.reducers.signIn(loginName, password);
          conn.reducers.removeOnCreatePlayer(onPlayerCreated);
        };
        
        conn.reducers.onUsePlayerInvite(onInviteUsed);
        conn.reducers.onCreatePlayer(onPlayerCreated);
      }
    };

    return (
      <div className="App">
        <div className="landing-page">
          <h1>Deployment Bingo</h1>
          <p>Welcome to Deployment Bingo! Track deployment milestones and compete with your team.</p>
          
          {token ? (
            // Show create new player form when token is present
            <>
              <p>You've been invited to join! Create your account to get started.</p>
              <form onSubmit={handleCreatePlayer}>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                />
                <input
                  type="password"
                  placeholder="Create password (min 4 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                />
                <button type="submit" disabled={password.length < 4}>Create Account</button>
              </form>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Already have an account? <button 
                  onClick={() => window.location.href = window.location.pathname}
                  style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Sign in instead
                </button>
              </p>
            </>
          ) : (
            // Show sign in form when no token is present
            <>
              <p>Join the fun by signing in.</p>
              <form onSubmit={handleSignIn}>
                <input
                  type="text"
                  placeholder="Enter name"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit">Sign In</button>
              </form>
            </>
          )}
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

  const handleCreateInvite = () => {
    // Generate a random token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Call the reducer to create the invite
    conn?.reducers.createPlayerInvite(token);
    
    // Create the invite link
    const hostUrl = window.location.origin;
    const link = `${hostUrl}?token=${token}`;
    setInviteLink(link);
    setShowInviteModal(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Show game view if selected
  if (currentView === 'game' && currentGameSessionId !== null) {
    return (
      <BingoGame
        conn={conn}
        gameSessionId={currentGameSessionId}
        currentPlayer={currentPlayer}
        players={players}
        gameSessions={gameSessions}
        playerSessions={playerSessions}
        onBack={() => {
          setCurrentView('main');
          setCurrentGameSessionId(null);
        }}
      />
    );
  }

  // Show main view
  return (
    <div className="App">
      <div className="profile">
        <h1>Deployment Bingo</h1>
        {!settingName ? (
          <>
            <p>{name}</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setSettingName(true);
                  setNewName(name);
                }}
              >
                Edit Name
              </button>
              <button
                onClick={handleCreateInvite}
                className="invite-button"
              >
                Create Invite
              </button>
            </div>
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
              <span className={`status-indicator ${player.online ? 'online' : 'offline'}`}>
                {player.online ? '●' : '○'}
              </span>
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
          <>
            <div className="sessions-list">
              {(() => {
                const itemsPerPage = 3;
                const totalPages = Math.ceil(gameSessions.length / itemsPerPage);
                const startIndex = currentPage * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedSessions = gameSessions.slice(startIndex, endIndex);
                
                // Reset to last page if current page is out of bounds
                if (currentPage >= totalPages && totalPages > 0) {
                  setCurrentPage(totalPages - 1);
                }
                
                return paginatedSessions.map((session) => {
                  const sessionPlayerSessions = playerSessions.filter(ps => ps.gameSessionId === session.id);
                  const playerCount = sessionPlayerSessions.length;
                  const isPlayerInGame = sessionPlayerSessions.some(ps => ps.playerId.toHexString() === identity.toHexString());
                  
                  let buttonAction: 'open' | 'join' | 'view';
                  let buttonText: string;
                  
                  if (isPlayerInGame) {
                    buttonAction = 'open';
                    buttonText = 'Open';
                  } else if (session.active) {
                    buttonAction = 'join';
                    buttonText = 'Join';
                  } else {
                    buttonAction = 'view';
                    buttonText = 'View';
                  }
                  
                  return (
                    <div key={session.id} className="session-item">
                      <div className="session-info">
                        <h3>{session.name}</h3>
                        <p>Status: {session.active ? 'Active' : 'Completed'}</p>
                        <p>Players: {playerCount}</p>
                        {session.winner && (
                          <p>Winner: {players.get(session.winner.toHexString())?.name || 'Unknown'}</p>
                        )}
                      </div>
                      <button 
                        className={`session-action-button session-action-${buttonAction}`}
                        onClick={() => {
                          if (buttonAction === 'join') {
                            conn.reducers.joinGame(session.id);
                          }
                          setCurrentGameSessionId(session.id);
                          setCurrentView('game');
                        }}
                      >
                        {buttonText}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
            {(() => {
              const itemsPerPage = 3;
              const totalPages = Math.ceil(gameSessions.length / itemsPerPage);
              
              return totalPages > 1 ? (
                <div className="pagination-controls">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    Next
                  </button>
                </div>
              ) : null;
            })()}
          </>
        )}
        <input
            type="text"
            placeholder="Enter game session name (min 4 chars)"
            value={newGameSessionName}
            onChange={e => setNewGameSessionName(e.target.value)}
            minLength={4}
            required
            style={{ marginBottom: '0.5em', width: '60%' }}
          />
        <button 
          className="create-game-button"
          onClick={() => {
            conn.reducers.startNewGame(newGameSessionName);
            setNewGameSessionName('');
          }}
          disabled={newGameSessionName.length < 4}
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
      
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Player Invite Created</h3>
              <button 
                className="modal-close"
                onClick={() => setShowInviteModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Share this link with new players to invite them to join:</p>
              <div className="invite-link-container">
                <input 
                  type="text" 
                  value={inviteLink} 
                  readOnly 
                  className="invite-link-input"
                />
                <button 
                  onClick={copyToClipboard}
                  className="copy-button"
                >
                  Copy
                </button>
              </div>
              <p className="invite-note">This invite will expire in 1 hour.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
