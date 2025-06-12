import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DbConnection, type ErrorContext } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

interface SignupPageProps {
  onSignupSuccess: () => void;
}

function SignupPage({ onSignupSuccess }: SignupPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [connected, setConnected] = useState(false);
  
  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect if no token provided
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    // Set up database connection
    const onConnect = (
      connection: DbConnection,
      identity: Identity,
      authToken: string
    ) => {
      console.log('Connected to SpacetimeDB for signup with identity:', identity.toHexString());
      setConn(connection);
      setConnected(true);
      localStorage.setItem('auth_token', authToken);
    };

    const onDisconnect = () => {
      console.log('Disconnected from SpacetimeDB');
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log('Error connecting to SpacetimeDB:', err);
      setError('Failed to connect to server. Please try again.');
    };

    const connection = DbConnection.builder()
      .withUri('ws://localhost:3030')
      .withModuleName('deployment-bingo')
      .withToken('') // No token for initial connection
      .onConnect(onConnect)
      .onDisconnect(onDisconnect)
      .onConnectError(onConnectError)
      .build();

    setConn(connection);

    return () => {
      connection?.disconnect();
    };
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!conn || !connected) {
      setError('Not connected to server. Please refresh and try again.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // First, use the player invite token
      conn.reducers.usePlayerInvite(token!);
      
      // Set up a one-time callback for when the invite is successfully used
      const onInviteUsed = () => {
        // After invite is used, create the player account
        conn.reducers.createPlayer(name, password);
        conn.reducers.removeOnUsePlayerInvite(onInviteUsed);
      };
      
      // Set up a one-time callback for when the player is created
      const onPlayerCreated = () => {
        console.log('Player created successfully');
        conn.reducers.removeOnCreatePlayer(onPlayerCreated);
        
        // Now sign in the player
        conn.reducers.signIn(name, password);
      };

      // Set up a one-time callback for successful sign-in
      const onSignIn = () => {
        console.log('Player signed in successfully after signup');
        conn.reducers.removeOnSignIn(onSignIn);
        
        // Call the success callback to let the parent component handle the transition
        onSignupSuccess();
      };
      
      conn.reducers.onUsePlayerInvite(onInviteUsed);
      conn.reducers.onCreatePlayer(onPlayerCreated);
      conn.reducers.onSignIn(onSignIn);
      
    } catch (err) {
      console.error('Signup error:', err);
      setError('Signup failed. The invite token may be invalid or expired.');
      setIsLoading(false);
    }
  };

  if (!token) {
    return null; // This will redirect in useEffect
  }

  if (!connected) {
    return (
      <div className="signup-page">
        <div className="signup-container">
          <h1>Connecting...</h1>
          <p>Please wait while we connect to the server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-container">
        <h1>Join Deployment Bingo</h1>
        <p>You've been invited to join! Create your account below.</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              disabled={isLoading}
              placeholder="Enter your name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              disabled={isLoading}
              placeholder="Choose a password"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password:</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={4}
              disabled={isLoading}
              placeholder="Confirm your password"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading || !name || !password || !confirmPassword}
            className="signup-button"
          >
            {isLoading ? 'Creating Account...' : 'Create Account & Join'}
          </button>
        </form>
        
        <div className="signup-footer">
          <p>
            <button 
              type="button" 
              onClick={() => navigate('/')} 
              className="link-button"
              disabled={isLoading}
            >
              Back to Home
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage; 