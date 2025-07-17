'use client'; // This directive marks the component as a Client Component

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Supabase client setup
// Replace with your actual Supabase URL and Anon Public Key
const supabaseUrl = 'https://mfqqzvplykhvhfnqriaw.supabase.co'; // e.g., 'https://abcde12345.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcXF6dnBseWtodmhmbnFyaWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NDEyMDAsImV4cCI6MjA2ODMxNzIwMH0.Mc-ubsnLZ-7HthLNOo51NRPLYLvBZu2m892tFdF0Zz8'; // e.g., 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'


const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SupabaseContext = createContext(null);

// Supabase Provider to make the client and user available
const SupabaseProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const signIn = async () => {
      try {
        // Sign in anonymously to get a user ID for Realtime subscriptions
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        setUser(data.user);
        console.log('Signed in anonymously as:', data.user.id);
      } catch (error) {
        console.error('Error signing in anonymously:', error.message);
      } finally {
        setLoading(false);
      }
    };

    signIn();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
      console.log('Auth state changed. Current user:', session?.user?.id || 'none');
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase, user, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
};

// Custom hook to use Supabase context
const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

// Game Constants
const INITIAL_LIVES = 4;
const MIN_BULLETS = 3;
const MAX_BULLETS = 7; // Increased range for more variability

// Utility function to generate bullets
const generateBullets = () => {
  const totalBullets = Math.floor(Math.random() * (MAX_BULLETS - MIN_BULLETS + 1)) + MIN_BULLETS;
  let realBullets = Math.floor(Math.random() * (totalBullets - 1)) + 1; // At least one real bullet
  let fakeBullets = totalBullets - realBullets;

  const bullets = [];
  for (let i = 0; i < realBullets; i++) bullets.push('real');
  for (let i = 0; i < fakeBullets; i++) bullets.push('fake');

  // Shuffle bullets
  for (let i = bullets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bullets[i], bullets[j]] = [bullets[j], bullets[i]];
  }

  return { bullets, realBullets, fakeBullets };
};

// Home Page Component
const HomePage = ({ onHostGame, onJoinGame }) => {
  const [roomKey, setRoomKey] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-8 text-red-500">Buckshot Roulette</h1>
        <button
          onClick={onHostGame}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg mb-4 transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
        >
          Host New Game
        </button>
        <div className="flex items-center my-6">
          <hr className="flex-grow border-gray-600" />
          <span className="px-4 text-gray-400">OR</span>
          <hr className="flex-grow border-gray-600" />
        </div>
        <input
          type="text"
          placeholder="Enter Room Key"
          value={roomKey}
          onChange={(e) => setRoomKey(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => onJoinGame(roomKey)}
          disabled={!roomKey.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join Game
        </button>
      </div>
    </div>
  );
};

// Room Page Component
const RoomPage = ({ roomId, onLeaveRoom }) => {
  const { supabase, user, loading } = useSupabase();
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState('');
  const [showBulletInfo, setShowBulletInfo] = useState(false);

  const myId = user?.id;
  const isHost = room?.player1_id === myId;
  const isPlayer = room?.player1_id === myId || room?.player2_id === myId;
  const otherPlayerId = isHost ? room?.player2_id : room?.player1_id;

  // Function to update game state in Supabase
  const updateGameState = useCallback(async (newGameState) => {
    if (!supabase || !room?.id) return;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ game_state: newGameState })
        .eq('id', room.id);
      if (error) throw error;
      console.log('Game state updated successfully.');
    } catch (error) {
      console.error('Error updating game state:', error.message);
      setMessage(`Error: ${error.message}`);
    }
  }, [supabase, room?.id]);

  // Initialize game
  const initializeGame = useCallback(async () => {
    console.log('Attempting to initialize game...');
    console.log('isHost:', isHost, 'room:', room, 'room.status:', room?.status, 'game_started:', room?.game_state?.game_started);

    if (!isHost || !room || room.status !== 'playing' || room.game_state?.game_started) {
      console.log('Initialization conditions not met.');
      return;
    }

    console.log('Initializing game now!');
    const { bullets, realBullets, fakeBullets } = generateBullets();
    const firstTurnPlayerId = Math.random() < 0.5 ? room.player1_id : room.player2_id;

    const initialGameState = {
      player1_lives: INITIAL_LIVES,
      player2_lives: INITIAL_LIVES,
      bullets: bullets,
      displayed_bullets: { real: realBullets, fake: fakeBullets },
      current_turn: firstTurnPlayerId,
      game_started: true,
      winner: null,
      // Use last_action for initial coin flip message
      last_action: {
        shooterId: null, // No shooter for coin flip
        targetId: null, // No target for coin flip
        bulletType: null, // No bullet for coin flip
        outcome: 'coin_flip',
        firstTurnPlayerId: firstTurnPlayerId, // Store who got first turn
        timestamp: Date.now()
      },
    };

    await updateGameState(initialGameState);
    // Message will be set by the useEffect watching last_action
    setShowBulletInfo(true); // Show bullet info initially
    setTimeout(() => setShowBulletInfo(false), 5000); // Hide after 5 seconds
  }, [isHost, room, updateGameState]);

  // Handle shooting action
  const handleShot = useCallback(async (target) => {
    if (!room || !room.game_state || room.game_state.current_turn !== myId || room.game_state.winner) {
      setMessage("It's not your turn or game is over.");
      return;
    }
    if (room.game_state.bullets.length === 0) {
      setMessage("No bullets left! Waiting for reload.");
      return;
    }

    const currentGameState = { ...room.game_state };
    const shotBullet = currentGameState.bullets.shift(); // Take one bullet

    let outcome = '';
    let nextTurn = currentGameState.current_turn; // Default to current turn (for fake self-shot)
    let reloadNeeded = false;
    let lastShooter = myId;
    let lastTarget = target === 'self' ? myId : otherPlayerId;

    if (target === 'self') {
      if (shotBullet === 'fake') {
        outcome = 'fake_self_hit';
        // nextTurn remains myId
      } else { // real bullet
        currentGameState[myId === currentGameState.player1_id ? 'player1_lives' : 'player2_lives']--;
        outcome = 'real_self_hit';
        nextTurn = otherPlayerId;
      }
    } else { // target === 'opponent'
      if (shotBullet === 'fake') {
        outcome = 'fake_opponent_hit';
        nextTurn = otherPlayerId;
      } else { // real bullet
        currentGameState[otherPlayerId === currentGameState.player1_id ? 'player1_lives' : 'player2_lives']--;
        outcome = 'real_opponent_hit';
        nextTurn = otherPlayerId;
      }
    }

    // Check for game end
    let winner = null;
    if (currentGameState.player1_lives <= 0) {
      winner = currentGameState.player2_id;
      outcome += '_game_end'; // Append game end status
      nextTurn = null; // Game over
    } else if (currentGameState.player2_lives <= 0) {
      winner = currentGameState.player1_id;
      outcome += '_game_end'; // Append game end status
      nextTurn = null; // Game over
    } else if (currentGameState.bullets.length === 0 && !winner) { // Reload only if game is not over
      reloadNeeded = true;
      outcome += '_reload_needed'; // Append reload status
    }

    currentGameState.current_turn = nextTurn;
    currentGameState.winner = winner;
    currentGameState.last_action = {
      shooterId: lastShooter,
      targetId: lastTarget,
      bulletType: shotBullet,
      outcome: outcome,
      timestamp: Date.now() // To ensure updates even if other fields are same
    };
    // The 'message' field is now derived on the client side, so no need to set it here
    // delete currentGameState.message; // Clear old message if it existed

    await updateGameState(currentGameState);

    if (reloadNeeded && !winner) { // Reload only if game is not over
      setTimeout(async () => {
        const { bullets: newBullets, realBullets, fakeBullets } = generateBullets();
        const reloadedGameState = {
          ...currentGameState,
          bullets: newBullets,
          displayed_bullets: { real: realBullets, fake: fakeBullets },
          last_action: {
            shooterId: null, // No specific shooter for reload
            targetId: null,
            bulletType: null,
            outcome: 'reloaded',
            timestamp: Date.now()
          }
        };
        await updateGameState(reloadedGameState);
        // setMessage will be handled by the useEffect watching last_action
      }, 1000);
    }

  }, [room, myId, otherPlayerId, updateGameState]);

  // Effect to handle dynamic message display based on last_action
  useEffect(() => {
    if (!room?.game_state?.last_action) return;

    const { shooterId, targetId, bulletType, outcome, firstTurnPlayerId } = room.game_state.last_action;
    let displayMessage = '';

    const isMyShot = shooterId === myId;
    const isMyTarget = targetId === myId;
    const isOpponentShot = shooterId === otherPlayerId;
    const isOpponentTarget = targetId === otherPlayerId;

    if (outcome === 'coin_flip') {
      displayMessage = `Coin flip: ${firstTurnPlayerId === myId ? 'You' : 'Opponent'} goes first!`;
    } else if (outcome === 'reloaded') {
      displayMessage = `Bullets reloaded! Real: ${room.game_state.displayed_bullets.real}, Fake: ${room.game_state.displayed_bullets.fake}.`;
      setShowBulletInfo(true);
      setTimeout(() => setShowBulletInfo(false), 5000);
    } else if (outcome.includes('game_end')) {
      const winnerId = room.game_state.winner;
      if (winnerId === myId) {
        displayMessage = `Game Over! You Win!`;
      } else if (winnerId === otherPlayerId) {
        displayMessage = `Game Over! You Lose!`;
      } else {
        displayMessage = `Game Over!`; // Should not happen if winner is always set
      }
    } else {
      // Handle shooting messages
      if (isMyShot) {
        if (isMyTarget) { // Shot self
          if (bulletType === 'fake') {
            displayMessage = `You shot yourself with a FAKE bullet! You get another turn.`;
          } else { // real
            displayMessage = `You shot yourself with a REAL bullet! Your health is now ${myLives}. ${otherPlayerId ? 'Opponent\'s turn.' : ''}`;
          }
        } else { // Shot opponent
          if (bulletType === 'fake') {
            displayMessage = `You shot your opponent with a FAKE bullet! ${otherPlayerId ? 'Opponent\'s turn.' : ''}`;
          } else { // real
            displayMessage = `You shot your opponent with a REAL bullet! Their health is now ${oppLives}. ${otherPlayerId ? 'Opponent\'s turn.' : ''}`;
          }
        }
      } else if (isOpponentShot) { // Opponent shot
        if (isMyTarget) { // Opponent shot me
          if (bulletType === 'fake') {
            displayMessage = `Your opponent shot you with a FAKE bullet! It's your turn.`;
          } else { // real
            displayMessage = `Your opponent shot you with a REAL bullet! Your health is now ${myLives}. It's your turn.`;
          }
        } else { // Opponent shot self
          if (bulletType === 'fake') {
            displayMessage = `Your opponent shot themselves with a FAKE bullet! It's their turn again.`;
          } else { // real
            displayMessage = `Your opponent shot themselves with a REAL bullet! Their health is now ${oppLives}. It's your turn.`;
          }
        }
      }
    }
    setMessage(displayMessage);
  }, [room?.game_state?.last_action, myId, otherPlayerId, myLives, oppLives, room?.game_state?.displayed_bullets, room?.game_state?.winner]);


  // Fetch room data and set up real-time subscription
  useEffect(() => {
    console.log('RoomPage useEffect: roomId changed or loading/supabase changed. Current myId:', myId);
    if (loading || !supabase || !roomId || !myId) return; // Ensure myId is available

    const fetchRoom = async () => {
      console.log('Fetching room:', roomId);
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (error) throw error;
        setRoom(data);
        console.log('Fetched room data:', data);

        // If room found and not full, and current user is not already a player, join the room
        if (data && data.status === 'waiting' && !data.player2_id && data.player1_id !== myId) {
          console.log('Attempting to join room as Player 2...');
          const { data: updatedRoom, error: updateError } = await supabase
            .from('rooms')
            .update({ player2_id: myId, status: 'playing' })
            .eq('id', roomId)
            .select()
            .single();

          if (updateError) throw updateError;
          setRoom(updatedRoom);
          setMessage(`Joined room ${roomId}. Waiting for host to start.`);
          console.log('Successfully joined room as Player 2:', updatedRoom);
        } else if (data && data.status === 'playing' && data.player1_id !== myId && data.player2_id !== myId) {
          setMessage('Room is full. Cannot join.');
          console.log('Room is full, leaving.');
          onLeaveRoom(); // Redirect back to home if room is full
        } else if (data && data.status === 'finished') {
          setMessage('Game has already finished in this room.');
          console.log('Game finished, leaving.');
        }

      } catch (error) {
        console.error('Error fetching room:', error.message);
        setMessage(`Error: ${error.message}`);
        onLeaveRoom(); // Go back to home if room doesn't exist or error
      }
    };

    fetchRoom();

    // Real-time subscription for room changes
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        console.log('Real-time change received!', payload);
        if (payload.new) {
          setRoom(payload.new);
          // Message will now be handled by the new useEffect watching last_action
          // if (payload.new.game_state?.message) {
          //   setMessage(payload.new.game_state.message);
          // }
          // if (payload.new.game_state?.displayed_bullets && payload.old?.game_state?.bullets.length === 0 && payload.new.game_state.bullets.length > 0) {
          //   // Only show bullet info on reload
          //   setShowBulletInfo(true);
          //   setTimeout(() => setShowBulletInfo(false), 5000);
          // }
        }
      })
      .subscribe();

    return () => {
      console.log('Unsubscribing from channel:', roomId);
      channel.unsubscribe();
    };
  }, [supabase, roomId, myId, loading, onLeaveRoom]);

  useEffect(() => {
    console.log('Initialize Game useEffect triggered. Current room state:', room);
    // Automatically start game when two players are in and status is playing
    if (room && room.status === 'playing' && room.player1_id && room.player2_id && !room.game_state?.game_started) {
      console.log('Conditions met for game initialization.');
      if (isHost) { // Only host initializes the game
        console.log('Host is initializing the game.');
        initializeGame();
      } else {
        console.log('Not host, waiting for host to initialize.');
      }
    } else {
      console.log('Conditions not met for game initialization. Room Status:', room?.status, 'Player1 ID:', room?.player1_id, 'Player2 ID:', room?.player2_id, 'Game Started:', room?.game_state?.game_started);
    }
  }, [room, isHost, initializeGame]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-2xl">Loading...</div>;
  }

  if (!room) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white text-2xl">Room not found or error.</div>;
  }

  const myLives = myId === room.game_state?.player1_id ? room.game_state?.player1_lives : room.game_state?.player2_lives;
  const oppLives = otherPlayerId === room.game_state?.player1_id ? room.game_state?.player1_lives : room.game_state?.player2_lives;
  const isMyTurn = room.game_state?.current_turn === myId;
  const gameEnded = room.game_state?.winner !== null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Buckshot Roulette Room: {roomId}</h1>
        <p className="text-lg mb-2 text-gray-300">Your ID: <span className="font-mono text-blue-400 break-all">{myId}</span></p>
        {room.player1_id && <p className="text-lg mb-2 text-gray-300">Player 1 (Host): <span className="font-mono text-purple-400 break-all">{room.player1_id}</span></p>}
        {room.player2_id && <p className="text-lg mb-2 text-gray-300">Player 2: <span className="font-mono text-green-400 break-all">{room.player2_id}</span></p>}

        {!room.player2_id && room.status === 'waiting' && (
          <p className="text-xl text-yellow-400 mt-4">Waiting for another player to join...</p>
        )}

        {/* Health Bars - Always visible */}
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-orange-400">Lives</h2>
          <div className="flex justify-around mb-4 text-xl">
            <p>Your Lives: <span className="font-bold text-red-500">{myLives !== undefined ? myLives : '?'}</span></p>
            {otherPlayerId && <p>Opponent Lives: <span className="font-bold text-red-500">{oppLives !== undefined ? oppLives : '?'}</span></p>}
          </div>
        </div>

        {room.status === 'playing' && room.game_state && (
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-orange-400">Game State</h2>

            {showBulletInfo && room.game_state.displayed_bullets && (
              <p className="text-xl mb-4 text-yellow-300">
                Current Bullets: Real: <span className="font-bold">{room.game_state.displayed_bullets.real}</span>, Fake: <span className="font-bold">{room.game_state.displayed_bullets.fake}</span>
              </p>
            )}

            <p className="text-xl mb-4 text-blue-300">{message}</p>

            {gameEnded ? (
              <p className="text-3xl font-bold text-green-500">
                Game Over! {room.game_state.winner === myId ? 'You Win!' : 'You Lose!'}
              </p>
            ) : (
              <>
                <p className={`text-2xl font-bold mb-4 ${isMyTurn ? 'text-green-400' : 'text-red-400'}`}>
                  {isMyTurn ? "It's YOUR Turn!" : otherPlayerId ? "Waiting for Opponent's Turn..." : "Waiting for game to start..."}
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                  <button
                    onClick={() => handleShot('self')}
                    disabled={!isMyTurn || !otherPlayerId || room.game_state.bullets.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Shoot Self ({room.game_state.bullets.length > 0 ? room.game_state.bullets.length : 0} bullets left)
                  </button>
                  <button
                    onClick={() => handleShot('opponent')}
                    disabled={!isMyTurn || !otherPlayerId || room.game_state.bullets.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Shoot Opponent ({room.game_state.bullets.length > 0 ? room.game_state.bullets.length : 0} bullets left)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={onLeaveRoom}
          className="mt-8 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};

// New component to encapsulate the main game logic and state
const MainGameLogic = () => {
  const [currentPage, setCurrentPage] = useState('home'); // 'home' or 'room'
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const { supabase, user, loading } = useSupabase(); // Now this call is within the provider's scope

  // Function to host a new game
  const handleHostGame = async () => {
    if (!user) {
      // In a real app, you might want a more user-friendly loading state or error message
      alert('User not authenticated. Please wait for loading.');
      return;
    }
    // const newRoomId = uuidv4().substring(0, 8); // No longer needed for 'id' column

    try {
      // Let Supabase generate the UUID for the 'id' column
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ player1_id: user.id, status: 'waiting' }]) // Removed 'id: newRoomId'
        .select() // Select the inserted row to get the generated ID
        .single();

      if (error) throw error;
      setCurrentRoomId(data.id); // Use the actual UUID generated by Supabase
      setCurrentPage('room');
      console.log('Hosted new room with ID:', data.id);
    } catch (error) {
      console.error('Error hosting game:', error.message);
      alert(`Error hosting game: ${error.message}`);
    }
  };

  // Function to join an existing game
  const handleJoinGame = (roomId) => {
    if (!roomId) {
      alert('Please enter a room key.');
      return;
    }
    setCurrentRoomId(roomId);
    setCurrentPage('room');
    console.log('Attempting to join room with ID:', roomId);
  };

  // Function to leave the room and go back to home
  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setCurrentPage('home');
    console.log('Left room.');
  };

  // Render content based on current page
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onHostGame={handleHostGame} onJoinGame={handleJoinGame} />;
      case 'room':
        return <RoomPage roomId={currentRoomId} onLeaveRoom={handleLeaveRoom} />;
      default:
        return <HomePage onHostGame={handleHostGame} onJoinGame={handleJoinGame} />;
    }
  };

  return renderPage();
};


// Main App Component
const App = () => {
  // Tailwind CSS CDN for styling
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    document.body.style.fontFamily = 'Inter, sans-serif';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }, []);

  return (
    <SupabaseProvider>
      {/* To test multiplayer:
        1. Open the first instance in a regular browser tab.
        2. Open the second instance in an Incognito/Private window (or a different browser).
        This ensures two distinct anonymous users are created for Supabase authentication.
      */}
      <MainGameLogic /> {/* Main game logic is now a child of SupabaseProvider */}
    </SupabaseProvider>
  );
};

export default App;
