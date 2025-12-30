import { useEffect, useRef, useState } from 'react';
import './App.css';

const generateTarget = (max) => Math.max(1, Math.floor(Math.random() * max) + 1);
const uid = () => `p-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const basePlayer = (overrides = {}) => ({
  id: uid(),
  name: 'Player',
  wins: 0,
  streak: 0,
  ...overrides,
});
const shufflePlayers = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function App() {
  const [maxNumber, setMaxNumber] = useState(50);
  const [targetNumber, setTargetNumber] = useState(() => generateTarget(50));
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [status, setStatus] = useState('waiting'); // waiting | active | won
  const [guessValue, setGuessValue] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('solo'); // solo | multiplayer
  const [gameMode, setGameMode] = useState('exact'); // exact | quickfire
  const [guessOrderMode, setGuessOrderMode] = useState('random'); // random | set
  const [higherLowerEnabled, setHigherLowerEnabled] = useState(true);
  const [draggingPlayerId, setDraggingPlayerId] = useState(null);
  const [removeTargetId, setRemoveTargetId] = useState(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [feedbackCue, setFeedbackCue] = useState(null); // higher | lower | correct
  const [restartSpinning, setRestartSpinning] = useState(false);
  const restartSpinTimer = useRef(null);
  const chipRefs = useRef(new Map());
  const isLocked = status === 'active';
  const isQuickfire = gameMode === 'quickfire';
  const isMultiplayerMode = isQuickfire || mode === 'multiplayer';
  const canAddPlayersNow =
    mode === 'multiplayer' && (status === 'waiting' || status === 'won');

  const currentPlayer = players.length
    ? players[currentPlayerIndex % players.length]
    : null;

  const addPlayer = (event) => {
    event.preventDefault();
    const name = playerName.trim();

    if (!name) {
      setError('Enter a name before joining.');
      return;
    }

    const duplicate = players.some(
      (player) => player.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError('That name is already in the lobby.');
      return;
    }

    const newPlayer = basePlayer({ id: uid(), name });
    setPlayers((prev) => [...prev, newPlayer]);
    setPlayerName('');
    setError('');
  };

  const restartGame = (resetPlayers = false) => {
    setGuesses([]);
    setWinner(null);
    setGuessValue('');
    setStatus('waiting');
    setError('');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setTargetNumber(generateTarget(maxNumber));
    setFeedbackCue(null);
    setControlsCollapsed(false);
    if (resetPlayers) {
      setPlayers([]);
      setMode('multiplayer');
    }
  };

  const startRound = () => {
    setError('');

    if (isMultiplayerMode && players.length === 0) {
      setError('Add at least one player before starting.');
      return;
    }

    if (isQuickfire && players.length < 2) {
      setError('Quickfire needs at least two players.');
      return;
    }

    const preparedPlayers = isMultiplayerMode
      ? (guessOrderMode === 'random' ? shufflePlayers(players) : [...players]).map((player) => ({
          ...player,
          wins: player.wins ?? 0,
          streak: player.streak ?? 0,
        }))
      : [basePlayer({ id: 'solo', name: 'Solo' })];

    setPlayers(preparedPlayers);
    setTargetNumber(generateTarget(maxNumber));
    setGuesses([]);
    setWinner(null);
    setGuessValue('');
    setStatus('active');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setControlsCollapsed(true);
    setFeedbackCue(null);
  };

  const handleGuess = (event) => {
    event.preventDefault();

    if (!currentPlayer || status !== 'active') {
      return;
    }

    const parsedGuess = Number(guessValue);
    if (
      !Number.isInteger(parsedGuess) ||
      parsedGuess < effectiveMin ||
      parsedGuess > effectiveMax
    ) {
      setError(`Enter a whole number between ${effectiveMin} and ${effectiveMax}.`);
      return;
    }

    const duplicateGuess = guesses.some((guess) => guess.value === parsedGuess);
    if (duplicateGuess) {
      setError('That number was already guessed this round. Pick a new one.');
      return;
    }

    let feedback =
      parsedGuess === targetNumber
        ? 'correct'
        : parsedGuess < targetNumber
          ? 'higher'
          : 'lower';

    if (gameMode === 'exact' && !higherLowerEnabled && feedback !== 'correct') {
      feedback = 'neutral';
    }

    const timestamp = Date.now();
    const entry = {
      id: `${timestamp}-${parsedGuess}`,
      player: currentPlayer.name,
      playerId: currentPlayer.id,
      value: parsedGuess,
      feedback,
      createdAt: timestamp,
    };

    if (isQuickfire) {
      const alreadyGuessed = guesses.some(
        (guess) => guess.playerId === currentPlayer.id
      );

      if (alreadyGuessed) {
        setError('Each player only gets one guess in Quickfire.');
        return;
      }

      const nextGuesses = [...guesses, entry];
      const everyoneGuessed =
        players.length > 0 &&
        players.every((player) =>
          nextGuesses.some((guess) => guess.playerId === player.id)
        );

      const winningGuess = [...nextGuesses].sort((a, b) => {
        const diffA = Math.abs(a.value - targetNumber);
        const diffB = Math.abs(b.value - targetNumber);
        if (diffA !== diffB) return diffA - diffB;
        return a.createdAt - b.createdAt; // earliest wins ties
      })[0];

      setGuesses(nextGuesses);
      setGuessValue('');
      setError('');
      setFeedbackCue(feedback === 'correct' ? { type: feedback, id: timestamp } : null);

      if ((feedback === 'correct' || everyoneGuessed) && winningGuess?.playerId) {
        applyWin(winningGuess.playerId);
      } else if (!everyoneGuessed) {
        const nextPlayerIndex = players.findIndex(
          (player) => !nextGuesses.some((guess) => guess.playerId === player.id)
        );

        if (nextPlayerIndex >= 0) {
          setCurrentPlayerIndex(nextPlayerIndex);
        }
      }

      return;
    }

    setGuesses((prev) => [entry, ...prev]);
    setGuessValue('');
    setError('');
    setFeedbackCue(feedback === 'neutral' ? null : { type: feedback, id: timestamp });

    if (feedback === 'correct') {
      if (mode === 'multiplayer') {
        applyWin(currentPlayer.id);
      } else {
        setWinner(currentPlayer);
        setStatus('won');
      }
    } else {
      setCurrentPlayerIndex((prev) =>
        players.length ? (prev + 1) % players.length : 0
      );
    }
  };

  useEffect(() => {
    if (!feedbackCue) return undefined;
    const timer = setTimeout(() => setFeedbackCue(null), 1400);
    return () => clearTimeout(timer);
  }, [feedbackCue]);

  useEffect(() => {
    if (!removeTargetId) return undefined;
    const handleOutsideClick = (event) => {
      const target = event.target;
      const currentChip = chipRefs.current.get(removeTargetId);
      if (!currentChip) {
        setRemoveTargetId(null);
        return;
      }

      const clickedRemove =
        target?.closest && target.closest('.chip__remove');
      const insideCurrentChip =
        target?.closest && target.closest(`[data-player-id="${removeTargetId}"]`);

      if (clickedRemove || insideCurrentChip) {
        return;
      }

      setRemoveTargetId(null);
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [removeTargetId]);

  useEffect(() => () => {
    if (restartSpinTimer.current) {
      clearTimeout(restartSpinTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!removeTargetId) return undefined;
    const node = chipRefs.current.get(removeTargetId);
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry && !entry.isIntersecting) {
        setRemoveTargetId(null);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [removeTargetId]);

  const removeWinner = () => {
    if (!winner) return;

    const remaining = players.filter((player) => player.id !== winner.id);
    setPlayers(remaining);
    setWinner(null);
    setGuesses([]);
    setGuessValue('');
    setTargetNumber(generateTarget(maxNumber));

    if (remaining.length) {
      setCurrentPlayerIndex((prev) =>
        prev >= remaining.length ? 0 : prev
      );
      setStatus('active');
    } else {
      setCurrentPlayerIndex(0);
      setStatus('waiting');
    }
  };

  const handleRemovePlayer = (playerId) => {
    const target = players.find((player) => player.id === playerId);
    const confirmed = window.confirm(
      `Remove ${target?.name ?? 'this player'} from the game?`
    );

    if (!confirmed) return;

    const updated = players.filter((player) => player.id !== playerId);

    if (updated.length === 0) {
      setPlayers([]);
      setCurrentPlayerIndex(0);
      setStatus('waiting');
      setWinner(null);
      setRemoveTargetId(null);
      return;
    }

    const currentIndex =
      currentPlayerIndex >= updated.length ? 0 : currentPlayerIndex;
    const winnerRemoved = winner?.id === playerId;

    setPlayers(updated);
    setCurrentPlayerIndex(currentIndex);
    setRemoveTargetId(null);

    if (winnerRemoved) {
      setWinner(null);
      setStatus('active');
    }
  };

  const applyWin = (winnerId) => {
    setPlayers((prev) => {
      const updated = prev.map((player) => {
        if (player.id === winnerId) {
          return {
            ...player,
            wins: (player.wins ?? 0) + 1,
            streak: (player.streak ?? 0) + 1,
          };
        }
        return { ...player, streak: 0 };
      });

      const nextWinner = updated.find((player) => player.id === winnerId);
      if (nextWinner) {
        setWinner(nextWinner);
        setStatus('won');
      }

      return updated;
    });
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === 'solo' && mode === 'multiplayer' && players.length > 0) {
      const confirmed = window.confirm(
        'Switching to Solo will clear the current lobby and reset all win/streak data. Continue?'
      );
      if (!confirmed) return;
    }

    setMode(nextMode);
    setStatus('waiting');
    setWinner(null);
    setGuesses([]);
    setGuessValue('');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setControlsCollapsed(false);
    if (nextMode === 'solo') {
      setPlayers([]);
      setGameMode('exact');
    }
  };

  const handleGameModeChange = (nextMode) => {
    setGameMode(nextMode);
    if (nextMode !== 'exact') {
      setHigherLowerEnabled(true);
    }
    setStatus('waiting');
    setWinner(null);
    setGuesses([]);
    setGuessValue('');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setControlsCollapsed(false);
    setError('');
    if (nextMode === 'quickfire') {
      setMode('multiplayer');
    }
  };

  const handleGuessOrderChange = (nextMode) => {
    if (mode !== 'multiplayer') return;
    setGuessOrderMode(nextMode);
    setStatus('waiting');
    setWinner(null);
    setGuesses([]);
    setGuessValue('');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setControlsCollapsed(false);
    setError('');
  };

  const reorderPlayers = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setPlayers((prev) => {
      const fromIndex = prev.findIndex((player) => player.id === sourceId);
      const toIndex = prev.findIndex((player) => player.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      const currentId = prev[currentPlayerIndex]?.id;
      if (currentId) {
        const nextIndex = updated.findIndex((player) => player.id === currentId);
        if (nextIndex >= 0 && nextIndex !== currentPlayerIndex) {
          setCurrentPlayerIndex(nextIndex);
        }
      }

      return updated;
    });
  };

  const handlePlayerDragStart = (event, playerId) => {
    if (!(mode === 'multiplayer' && guessOrderMode === 'set') || isLocked) return;
    setDraggingPlayerId(playerId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', playerId);
    }
  };

  const handlePlayerDragOver = (event, targetId) => {
    if (!(mode === 'multiplayer' && guessOrderMode === 'set') || isLocked) return;
    event.preventDefault();
    if (!draggingPlayerId || draggingPlayerId === targetId) return;
    reorderPlayers(draggingPlayerId, targetId);
  };

  const handlePlayerDrop = (event, targetId) => {
    if (!(mode === 'multiplayer' && guessOrderMode === 'set') || isLocked) return;
    event.preventDefault();
    if (draggingPlayerId) {
      reorderPlayers(draggingPlayerId, targetId);
    }
    setDraggingPlayerId(null);
  };

  const handlePlayerDragEnd = () => {
    setDraggingPlayerId(null);
  };

  const lowerBound = guesses
    .filter((guess) => guess.feedback === 'higher')
    .reduce((bound, guess) => Math.max(bound, Math.min(maxNumber, guess.value + 1)), 1);

  const upperBound = guesses
    .filter((guess) => guess.feedback === 'lower')
    .reduce((bound, guess) => Math.min(bound, Math.max(1, guess.value - 1)), maxNumber);

  let effectiveMin = isQuickfire ? 1 : lowerBound;
  let effectiveMax = isQuickfire ? maxNumber : upperBound;

  if (effectiveMin > effectiveMax) {
    const collapsed = Math.max(1, Math.min(effectiveMin, effectiveMax));
    effectiveMin = collapsed;
    effectiveMax = collapsed;
  }

  const guessFontSize = (() => {
    const valueDigits = guessValue ? guessValue.replace(/\D/g, '').length : 0;
    const rangeDigits = `${effectiveMin}-${effectiveMax}`.replace(/\D/g, '').length;
    const maxDigits = Math.max(valueDigits || 1, rangeDigits, String(maxNumber).length);
    const baseSize = 40;
    const minSize = 18;
    if (maxDigits <= 3) return baseSize;
    const digitSpan = 9 - 3; // scale down through 9 digits
    const shrinkRatio = Math.min((maxDigits - 3) / digitSpan, 1);
    return Math.round(baseSize - (baseSize - minSize) * shrinkRatio);
  })();

  const inRangeHint = `${effectiveMin} to ${effectiveMax}`;
  const canGuess = status === 'active' && players.length > 0;
  const showGuessFeedback = feedbackCue && (!isQuickfire || feedbackCue.type === 'correct');
  const modeLabel = gameMode === 'exact' ? 'Exact Match' : 'Quickfire Closest';
  const statusLabel = status === 'won' ? 'Winner' : status === 'active' ? 'In-Progress' : 'Setting up';
  const isGuessOrderDisabled = mode !== 'multiplayer';

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <p className="eyebrow">Stick-It</p>
          <h1>A Digital Pass &amp; Play Number Guessing Game</h1>
          <p className="lede">
            Setup a quick number guessing game and settle whatever your predicament may be!
          </p>
        </header>

        <div className={`grid ${mode === 'multiplayer' ? 'grid--with-players' : ''}`}>
          <section
            className={`panel host-panel ${controlsCollapsed ? 'host-panel--collapsed' : ''} ${isLocked ? 'host-panel--locked' : ''}`}
          >
            <div className="panel__title panel__title--host">
              <div className="host-header">
                <p className="label">Game Settings Tab</p>
                <button
                  type="button"
                  className={`host-toggle ${controlsCollapsed ? 'host-toggle--collapsed' : 'host-toggle--open'}`}
                  onClick={() => setControlsCollapsed((prev) => !prev)}
                  aria-label={controlsCollapsed ? 'Expand host controls' : 'Collapse host controls'}
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>
              <div className={`host-status status-block status-block--${status}`}>
                <div className="status-block__inner">
                  <div className="status-block__heading">
                    <h3>Game Status</h3>
                  </div>
                  <div className="status-chip-wrapper">
                    <span className={`status-chip status-chip--${status}`}>
                      {statusLabel}
                    </span>
                    <span className="status-chip__glow" aria-hidden />
                  </div>
                </div>
                {status === 'won' && <div className="status-block__halo" aria-hidden />}
              </div>
            </div>

            {!controlsCollapsed && (
              <>
                <div className="control">
                  <label>Game Structure</label>
                  <div className="mode-switch">
                    <button
                      type="button"
                      className={mode === 'solo' ? '' : 'ghost'}
                      onClick={() => handleModeChange('solo')}
                      disabled={isLocked}
                    >
                      Solo
                    </button>
                    <button
                      type="button"
                      className={mode === 'multiplayer' ? '' : 'ghost'}
                      onClick={() => handleModeChange('multiplayer')}
                      disabled={isLocked}
                    >
                      Multiplayer
                    </button>
                  </div>
                </div>

                <div className="control">
                  <label htmlFor="gameMode">Game mode</label>
                  <div className="mode-row">
                    <div className="mode-switch">
                      <button
                        type="button"
                        className={`mode-btn ${gameMode === 'exact' ? 'mode-btn--active' : ''}`}
                        onClick={() => handleGameModeChange('exact')}
                        disabled={status === 'active'}
                      >
                        Exact match
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${gameMode === 'quickfire' ? 'mode-btn--active' : ''}`}
                        onClick={() => handleGameModeChange('quickfire')}
                        disabled={status === 'active' || mode === 'solo'}
                      >
                        Quickfire closest
                      </button>
                    </div>
                    {gameMode === 'exact' && (
                      <div className="bonus-toggle">
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={higherLowerEnabled}
                            onChange={(event) => setHigherLowerEnabled(event.target.checked)}
                            disabled={status === 'active'}
                          />
                          <span>Enable Higher/Lower feedback</span>
                        </label>
                        <small className="mode-description">
                          When on, we tell you if a guess is higher or lower and tighten the range. Turn off for no hints.
                        </small>
                      </div>
                    )}
                  </div>
                  {gameMode === 'exact' ? (
                    <small className="mode-description">
                      Exact Match: Precision Reigns. Only an exact hit wins. Guess until someone guesses the exact random number.
                    </small>
                  ) : (
                    <small className="mode-description">
                      Quickfire Closest: everyone guesses once, closest wins. No higher/lower hints.
                    </small>
                  )}
                </div>

                <div className="control">
                  <label htmlFor="guessOrderMode">Guessing order</label>
                  <div className={`mode-switch ${isGuessOrderDisabled ? 'mode-switch--disabled' : ''}`}>
                    <button
                      type="button"
                      className={`mode-btn ${guessOrderMode === 'random' ? 'mode-btn--active' : ''}`}
                      onClick={() => handleGuessOrderChange('random')}
                      disabled={isLocked || isGuessOrderDisabled}
                    >
                      Random
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${guessOrderMode === 'set' ? 'mode-btn--active' : ''}`}
                      onClick={() => handleGuessOrderChange('set')}
                      disabled={isLocked || isGuessOrderDisabled}
                    >
                      Set
                    </button>
                  </div>
                  {isGuessOrderDisabled ? (
                    <small className="mode-description">
                      Switch to Multiplayer to choose the guessing order.
                    </small>
                  ) : guessOrderMode === 'random' ? (
                    <small className="mode-description">
                      Random: we shuffle the guessing order at the start of each round.
                    </small>
                  ) : (
                    <small className="mode-description">
                      Set: Tap and Hold to drag players below to lock in a custom guessing order. We follow your order Top to Bottom each round.
                    </small>
                  )}
                </div>

                <div className="control">
                  <label htmlFor="maxNumber">Number Range (1 to X)</label>
                  <div className="range-row">
                    <button
                      type="button"
                      className="range-btn ghost"
                      onClick={() => setMaxNumber((prev) => Math.max(1, prev - 1))}
                      disabled={isLocked}
                    >
                      -
                    </button>
                    <input
                      id="maxNumber"
                      type="number"
                      min="1"
                      max="1000000"
                      value={maxNumber}
                      disabled={isLocked}
                      onChange={(event) => {
                        const next = Number(event.target.value) || 1;
                        setMaxNumber(Math.max(1, Math.min(next, 1000000)));
                      }}
                    />
                    <button
                      type="button"
                      className="range-btn ghost"
                      onClick={() => setMaxNumber((prev) => Math.min(1000000, prev + 1))}
                      disabled={isLocked}
                    >
                      +
                    </button>
                  </div>
                  <small>Update the max and start a new round to lock it in.</small>
                </div>

                <div className="actions">
                  <button type="button" onClick={startRound} disabled={isLocked}>
                    Start
                  </button>
                  <button
                    type="button"
                    className="ghost clear-round"
                    onClick={() => restartGame(false)}
                    disabled={status === 'waiting'}
                  >
                    Clear current round
                  </button>
                </div>
              </>
            )}
          </section>

          {mode === 'multiplayer' && (
            <section className="panel players-panel">
              <div className="panel__title">
                <div>
                  <p className="label">Multiplayer Details</p>
                  <h3>Players ({players.length})</h3>
                </div>
              </div>

              {canAddPlayersNow ? (
                <form className="add-player" onSubmit={addPlayer} autoComplete="off">
                  <input
                    type="text"
                    placeholder="Add player name"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    autoComplete="off"
                  />
                  <button type="submit">Add</button>
                </form>
              ) : status !== 'waiting' && currentPlayer && (
                <p className="status__player">
                  Current guesser: {currentPlayer.name}
                </p>
              )}

              <div className={`player-list ${mode === 'multiplayer' && guessOrderMode === 'set' ? 'player-list--set' : ''}`}>
                {players.length === 0 ? (
                  <p className="muted">No players yet. Add friends to start.</p>
                ) : (
                  players.map((player, index) => {
                    const isCurrent = index === currentPlayerIndex;
                    const isFlipped = removeTargetId === player.id;
                    const playerWins = player.wins ?? 0;
                    const playerStreak = player.streak ?? 0;
                    const hasHotStreak = playerStreak >= 3;
                    const flameLevel = Math.max(0, Math.min(playerStreak, 8));
                    const flameScale = 1 + flameLevel * 0.14;
                    const canDragSet = mode === 'multiplayer' && guessOrderMode === 'set' && !isLocked;
                    const isDragging = draggingPlayerId === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`chip ${isCurrent ? 'chip--active' : ''} ${
                          isFlipped ? 'chip--flipped' : ''
                        } ${hasHotStreak ? 'chip--hot' : ''} ${canDragSet ? 'chip--draggable' : ''} ${
                          isDragging ? 'chip--dragging' : ''
                        }`}
                        data-player-id={player.id}
                        ref={(node) => {
                          if (node) {
                            chipRefs.current.set(player.id, node);
                          } else {
                            chipRefs.current.delete(player.id);
                          }
                        }}
                        draggable={canDragSet}
                        onDragStart={(event) => handlePlayerDragStart(event, player.id)}
                        onDragOver={(event) => handlePlayerDragOver(event, player.id)}
                        onDrop={(event) => handlePlayerDrop(event, player.id)}
                        onDragEnd={handlePlayerDragEnd}
                        onClick={() => setRemoveTargetId(isFlipped ? null : player.id)}
                      >
                        <div className="chip__inner">
                          <div className="chip__face chip__face--front">
                            <div className="chip__front">
                              <div className="chip__top">
                                <div className="chip__name-wrap">
                                  <span className="chip__name">{player.name}</span>
                                  {playerStreak > 0 && (
                                    <div
                                      className="chip__flame"
                                      style={{ '--flame-scale': flameScale }}
                                      aria-label={`Streak ${playerStreak}`}
                                    />
                                  )}
                                  {winner?.id === player.id && <span className="chip__tag">Winner</span>}
                                </div>
                              </div>
                            {mode === 'multiplayer' && (
                              <div className="chip__meta">
                                <span className="chip__stat">Wins: {playerWins}</span>
                                {playerStreak > 0 && (
                                  <span
                                    className={`chip__stat chip__stat--streak ${
                                      hasHotStreak ? 'chip__stat--glow' : ''
                                    }`}
                                  >
                                    Streak: {playerStreak}
                                  </span>
                                )}
                              </div>
                            )}
                            </div>
                          </div>
                          <div className="chip__face chip__face--back">
                            <button
                              type="button"
                              className="chip__remove"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemovePlayer(player.id);
                              }}
                            >
                              X
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>

        {status !== 'waiting' && (
          <section className="panel wide">
            <div className="panel__title">
              <div className="round-heading">
                <div className="mode-display-wrap">
                  <div className={`mode-display mode-display--${gameMode}`} aria-label={modeLabel}>
                    <span className="mode-display__text">
                      {gameMode === 'exact' ? (
                        <>
                          <span className="mode-display__word mode-display__word--exact">Exact</span>
                          <span className="mode-display__word mode-display__word--match">Match</span>
                        </>
                      ) : (
                        <span className="mode-display__word mode-display__word--quickfire">
                          Quickfire Closest
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="round-line">
                <div className="round-copy">
                  <p className="label">Round</p>
                  <h3>Guess between {inRangeHint}</h3>
                </div>
                <div className="status">
                  {winner ? (
                    <p className="status__winner">
                      Baller!
                    </p>
                  ) : (
                    <h3 className="status__player">
                      {isQuickfire
                        ? currentPlayer
                          ? `${currentPlayer.name} is up`
                          : 'Waiting for players to join'
                        : mode === 'solo'
                          ? 'Solo mode'
                          : currentPlayer
                            ? `${currentPlayer.name} is up`
                            : 'Waiting for players to join'}
                    </h3>
                  )}
                </div>
              </div>
            </div>

            {!winner ? (
              <form className="guess" onSubmit={handleGuess} autoComplete="off">
                <div className="guess__inputs">
                  <label htmlFor="guessInput">Your guess</label>
                  <div className="guess-shell">
                    <input
                      id="guessInput"
                      className="guess-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={guessValue}
                      onChange={(event) => setGuessValue(event.target.value)}
                      disabled={!canGuess || !!winner}
                      placeholder={`Enter ${effectiveMin}-${effectiveMax}`}
                      style={{ fontSize: `${guessFontSize}px` }}
                      autoComplete="off"
                    />
                    {showGuessFeedback && (
                      <div
                        className={`guess-feedback guess-feedback--${feedbackCue.type}`}
                      >
                        <span className="guess-feedback__label">
                          {feedbackCue.type === 'higher'
                            ? 'Higher'
                            : feedbackCue.type === 'lower'
                              ? 'Lower'
                              : 'Correct!'}
                        </span>
                        {feedbackCue.type === 'higher' && (
                          <div className="arrow-stack arrow-stack--up">
                            {[...Array(5)].map((_, index) => (
                              <span key={index} className="arrow arrow--up">
                                ^
                              </span>
                            ))}
                          </div>
                        )}
                        {feedbackCue.type === 'lower' && (
                          <div className="arrow-stack arrow-stack--down">
                            {[...Array(5)].map((_, index) => (
                              <span key={index} className="arrow arrow--down">
                                v
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button type="submit" disabled={!canGuess || !!winner}>
                  Submit guess
                </button>
              </form>
            ) : (
              <div className="guess guess--winner">
                <p className="status__winner">
                  Congrats {winner.name}! The number was {targetNumber}.{' '}
                  {isQuickfire
                    ? 'Quickfire is one round - closest guess wins.'
                    : `It took ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`}
                </p>
                <button type="button" className="play-again" onClick={startRound}>
                  Play again
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <div className="feed">
              <div className="feed__header">
                <p className="label">Guess History</p>
                <span className="muted">
                  See all the guesses made this round
                </span>
              </div>

              {guesses.length === 0 ? (
                <p className="muted">No guesses yet - take the first shot.</p>
              ) : (
                <ul className="guesses">
                  {guesses.map((guess) => (
                    <li key={guess.id} className="guess-row">
                      <div>
                        <p className="guess-row__name">{guess.player}</p>
                        <p className="muted">
                          guessed <span className="guess-row__value">{guess.value}</span>
                        </p>
                      </div>
                      {isQuickfire ? (
                        <span
                          className={`pill pill--${
                            winner?.id === guess.playerId ? 'correct' : 'neutral'
                          }`}
                        >
                          {winner?.id === guess.playerId ? 'Closest' : 'Guess'}
                        </span>
                      ) : (
                        <span className={`pill pill--${guess.feedback === 'neutral' ? 'incorrect' : guess.feedback}`}>
                          {guess.feedback === 'correct'
                            ? 'Correct!'
                            : guess.feedback === 'neutral'
                              ? 'Incorrect'
                              : guess.feedback === 'higher'
                                ? 'Go higher'
                                : 'Go lower'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {winner && (
              <div className="confetti">
                {Array.from({ length: 60 }).map((_, index) => (
                  <span key={index} style={{ '--i': index }} />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="footer-row">
          <footer className="warning-footer" role="alert" aria-live="polite">
            <div className="warning-footer__icon" aria-hidden="true">!</div>
            <div>
              <p className="warning-footer__title">Warning</p>
              <p className="warning-footer__text">
                Refreshing this page will clear all current players and progress.
              </p>
            </div>
          </footer>

          <div className="restart-box" aria-label="Restart game controls">
            <p className="restart-box__title">Restart Game</p>
            <p className="restart-box__text">Reset the current session and start fresh.</p>
            <button
              type="button"
              className="restart-box__button"
              onClick={() => {
                const confirmed = window.confirm('Restart the current game and wipe to start fresh?');
                if (confirmed) {
                  setRestartSpinning(true);
                  if (restartSpinTimer.current) {
                    clearTimeout(restartSpinTimer.current);
                  }
                  restartSpinTimer.current = setTimeout(() => {
                    setRestartSpinning(false);
                    restartSpinTimer.current = null;
                  }, 1300);
                  restartGame(true);
                }
              }}
            >
              <span
                className={`refresh-icon ${restartSpinning ? 'refresh-icon--spin' : ''}`}
                aria-hidden="true"
              />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
