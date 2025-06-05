import React, { useEffect, useState } from 'react';
import './App.css';
import { DbConnection, type ErrorContext, type EventContext, Player } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

export type PrettyMessage = {
  senderName: string;
  text: string;
};

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

function App() {
  const [newName, setNewName] = useState('');
  const [settingName, setSettingName] = useState(false);
  // const [systemMessage, setSystemMessage] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);

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
      conn.reducers.onSetName(() => {
        console.log('Name Set.');
      });

      subscribeToQueries(conn, ['SELECT * FROM player']);
    };

    const onDisconnect = () => {
      console.log('Disconnected from SpacetimeDB');
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log('Error connecting to SpacetimeDB:', err);
    };

    setConn(
      DbConnection.builder()
        .withUri('ws://localhost:6666')
        .withModuleName('deployment-bingo')
        .withToken(localStorage.getItem('auth_token') || '')
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build()
    );
  }, []);

  const players = usePlayers(conn);

  const prettyMessages: PrettyMessage[] = [];

  if (!conn || !connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting...</h1>
      </div>
    );
  }

  const name =
    players.get(identity?.toHexString())?.name ||
    identity?.toHexString().substring(0, 8) ||
    'unknown';

  const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingName(false);
    conn.reducers.setName(newName);
  };

  const onMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNewMessage('');
    // TODO: Call `sendMessage` reducer
  };

  

  return (
    <div className="App">
      <div className="profile">
        <h1>Profile</h1>
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
      <div className="message">
        <h1>Messages</h1>
        {prettyMessages.length < 1 && <p>No messages</p>}
        <div>
          {prettyMessages.map((message, key) => (
            <div key={key}>
              <p>
                <b>{message.senderName}</b>
              </p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="system" style={{ whiteSpace: 'pre-wrap' }}>
        <h1>System</h1>
        <div>
          {/* <p>{systemMessage}</p> */}
        </div>
      </div>
      <div className="new-message">
        <form
          onSubmit={onMessageSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '50%',
            margin: '0 auto',
          }}
        >
          <h3>New Message</h3>
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          ></textarea>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;