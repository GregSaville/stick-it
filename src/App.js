import { useEffect, useState } from 'react';
import './App.css';

const generateTarget = (max) => Math.max(1, Math.floor(Math.random() * max) + 1);
const uid = () => `p-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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
  const [removeTargetId, setRemoveTargetId] = useState(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [feedbackCue, setFeedbackCue] = useState(null); // higher | lower | correct
  const isLocked = status !== 'waiting';

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

    const newPlayer = { id: uid(), name };
    setPlayers((prev) => [...prev, newPlayer]);
    setPlayerName('');
    setError('');
  };

  const restartGame = () => {
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
  };

  const startRound = () => {
    setError('');

    if (mode === 'multiplayer' && players.length === 0) {
      setError('Add at least one player before starting.');
      return;
    }

    const preparedPlayers =
      mode === 'solo' ? [{ id: 'solo', name: 'Solo' }] : [...players];

    setPlayers(preparedPlayers);
    setTargetNumber(generateTarget(maxNumber));
    setGuesses([]);
    setWinner(null);
    setGuessValue('');
    setStatus('active');
    setCurrentPlayerIndex(0);
    setRemoveTargetId(null);
    setControlsCollapsed(true);
  };

  const handleGuess = (event) => {
    event.preventDefault();

    if (!currentPlayer || status !== 'active') {
      return;
    }

    const parsedGuess = Number(guessValue);
    if (
      !Number.isInteger(parsedGuess) ||
      parsedGuess < 1 ||
      parsedGuess > maxNumber
    ) {
      setError(`Enter a whole number between 1 and ${maxNumber}.`);
      return;
    }

    const feedback =
      parsedGuess === targetNumber
        ? 'correct'
        : parsedGuess < targetNumber
          ? 'higher'
          : 'lower';

    const entry = {
      id: `${Date.now()}-${parsedGuess}`,
      player: currentPlayer.name,
      value: parsedGuess,
      feedback,
    };

    setGuesses((prev) => [entry, ...prev]);
    setGuessValue('');
    setError('');
    setFeedbackCue({ type: feedback, id: Date.now() });

    if (feedback === 'correct') {
      setWinner(currentPlayer);
      setStatus('won');
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

  const handleModeChange = (nextMode) => {
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
    }
  };

  const inRangeHint = `1 to ${maxNumber}`;
  const canGuess = status === 'active' && players.length > 0;

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <p className="eyebrow">Stick-It</p>
          <h1>Pass &amp; Play Number Guess</h1>
          <p className="lede">
            Setup a quick number guessing game to settle whatever your predicament may be
          </p>
        </header>

        <div className={`grid ${mode === 'multiplayer' ? 'grid--with-players' : ''}`}>
          <section
            className={`panel host-panel ${controlsCollapsed ? 'host-panel--collapsed' : ''} ${isLocked ? 'host-panel--locked' : ''}`}
          >
            <div className="panel__title">
              <div>
                <p className="label">Game Setup</p>
                <h3>Host controls</h3>
              </div>
              <span className={`badge badge--${status}`}>
                {status === 'won' ? 'Winner' : status === 'active' ? 'In-Progress' : 'Setting up'}
              </span>
              <button
                type="button"
                className="host-toggle"
                onClick={() => setControlsCollapsed((prev) => !prev)}
                aria-label={controlsCollapsed ? 'Expand host controls' : 'Collapse host controls'}
              >
                <span />
                <span />
                <span />
              </button>
            </div>

            {!controlsCollapsed && (
              <>
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

                <div className="control">
                  <label htmlFor="maxNumber">Range (1 to X)</label>
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
                  {winner && status === 'won' && mode === 'multiplayer' && (
                    <button type="button" className="ghost" onClick={removeWinner}>
                      Remove winner and restart?
                    </button>
                  )}
                  {isLocked && (
                    <button type="button" className="restart" onClick={restartGame}>
                      Restart game
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {mode === 'multiplayer' && (
            <section className="panel players-panel">
              <div className="panel__title">
                <div>
                  <p className="label">Add Players</p>
                  <h3>Players ({players.length})</h3>
                </div>
              </div>

              {status === 'waiting' && (
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
              )}

              {status !== 'waiting' && currentPlayer && (
                <p className="status__player">
                  Current guesser: {currentPlayer.name}
                </p>
              )}

              <div className="player-list">
                {players.length === 0 ? (
                  <p className="muted">No players yet. Add friends to start.</p>
                ) : (
                  players.map((player, index) => {
                    const isCurrent = index === currentPlayerIndex;
                    const isFlipped = removeTargetId === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`chip ${isCurrent ? 'chip--active' : ''} ${
                          isFlipped ? 'chip--flipped' : ''
                        }`}
                        onClick={() => setRemoveTargetId(isFlipped ? null : player.id)}
                      >
                        <div className="chip__inner">
                          <div className="chip__face chip__face--front">
                            <span>{player.name}</span>
                            {winner?.id === player.id && <span className="chip__tag">Winner</span>}
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
              <div>
                <p className="label">Round</p>
                <h3>Guess between {inRangeHint}</h3>
              </div>
              <div className="status">
                {winner ? (
                  <p className="status__winner">
                    Baller!
                  </p>
                ) : (
                  <p className="status__player">
                    {mode === 'solo'
                      ? 'Solo mode'
                      : currentPlayer
                        ? `${currentPlayer.name} is up`
                        : 'Waiting for players to join'}
                  </p>
                )}
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
                      type="text"
                      value={guessValue}
                      onChange={(event) => setGuessValue(event.target.value)}
                      disabled={!canGuess || !!winner}
                      placeholder={`Enter ${inRangeHint}`}
                      autoComplete="off"
                    />
                    {feedbackCue && (
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
                  Congrats {winner.name}! The number was {targetNumber}. It took {guesses.length}{' '}
                  {guesses.length === 1 ? 'guess' : 'guesses'}.
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
                  Everyone sees higher / lower in real-time.
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
                        <p className="muted">guessed {guess.value}</p>
                      </div>
                      <span className={`pill pill--${guess.feedback}`}>
                        {guess.feedback === 'correct'
                          ? 'Correct!'
                          : guess.feedback === 'higher'
                            ? 'Go higher'
                            : 'Go lower'}
                      </span>
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
      </div>
    </div>
  );
}

export default App;
