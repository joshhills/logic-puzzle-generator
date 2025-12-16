import { useState, useEffect } from 'react';
import { Generator, CategoryConfig, CategoryType, Puzzle } from '../../src/index';
import { LogicGridPuzzle } from './components/LogicGridPuzzle';
import { LogicGrid } from '../../src/engine/LogicGrid';

function App() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  // Scrubber State
  const [stepIndex, setStepIndex] = useState(-1);
  const [visualGrid, setVisualGrid] = useState<LogicGrid | null>(null);

  useEffect(() => {
    // Generate an initial random puzzle for testing
    const cats: CategoryConfig[] = [
      { id: 'Name', type: CategoryType.NOMINAL, values: ['Alice', 'Bob', 'Charlie', 'David'] },
      { id: 'Item', type: CategoryType.NOMINAL, values: ['Sword', 'Shield', 'Staff', 'Bow'] },
      { id: 'Color', type: CategoryType.NOMINAL, values: ['Red', 'Blue', 'Green', 'Yellow'] },
      { id: 'Age', type: CategoryType.ORDINAL, values: [20, 30, 40, 50] },
    ];

    // Choose a random target to ensure we get a valid solvable puzzle
    // (Actually the generator does solve checks, but we need a valid target fact)
    const target = { category1Id: 'Name', value1: 'Alice', category2Id: 'Item' };

    const gen = new Generator(Date.now());
    try {
      const p = gen.generatePuzzle(cats, target, { maxCandidates: 50 });
      setPuzzle(p);
      setStepIndex(p.clues.length); // Start at solved state
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update Visual Grid when step changes
  useEffect(() => {
    if (!puzzle) return;

    // We need to re-apply clues up to stepIndex
    const newGrid = new LogicGrid(puzzle.categories);
    const solver = (new Generator(0) as any).solver; // Hack to access solver or import Solver directly if exported

    // Actually Solver is exported.
    // import { Solver } from '@logic/index';
    // but Solver is a class.
    // const s = new Solver();

    // Wait, Solver is in @logic/index.
    // I need to import it.

  }, [puzzle, stepIndex]);

  if (!puzzle) return <div style={{ padding: 20 }}>Generating...</div>;

  return (
    <div className="App">
      <h1>Logic Puzzle Demo</h1>

      {/* Visualizer */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
        {/* We need to pass a grid. Since I didn't finish the useEffect above, let's just pass a new generic one or the finished one?
               For MVP step 1, let's just create a grid and apply all clues.
           */}
        <PuzzleRenderer puzzle={puzzle} />
      </div>
    </div>
  );
}

// Temporary sub-component to handle the effect cleanly
import { Solver } from '../../src/index';

const PuzzleRenderer = ({ puzzle }: { puzzle: Puzzle }) => {
  const [step, setStep] = useState(puzzle.clues.length);
  const [grid, setGrid] = useState<LogicGrid | null>(null);

  useEffect(() => {
    const g = new LogicGrid(puzzle.categories);
    const s = new Solver();

    // Apply clues 0 to step-1
    // puzzle.proofChain is ordered.

    for (let i = 0; i < step; i++) {
      if (i < puzzle.proofChain.length) {
        s.applyClue(g, puzzle.proofChain[i].clue);
      }
    }
    setGrid(g);
  }, [puzzle, step]);

  if (!grid) return <div>Loading Grid...</div>;

  return (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      <div>
        <div style={{ marginBottom: '10px' }}>
          <label>Step: {step} / {puzzle.clues.length}</label>
          <input
            type="range"
            min="0"
            max={puzzle.clues.length}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            style={{ marginLeft: '10px' }}
          />
        </div>
        <LogicGridPuzzle categories={puzzle.categories} grid={grid} />
      </div>

      {/* Clue List Panel */}
      <div style={{ maxHeight: '80vh', overflowY: 'auto', textAlign: 'left', minWidth: '300px', border: '1px solid #444', padding: '10px', borderRadius: '4px', backgroundColor: '#333' }}>
        <h3>Clues</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {puzzle.proofChain.map((stepData, idx) => {
            const isCurrent = (idx + 1) === step;
            const isPast = (idx + 1) < step;

            // We need a human readable string for the clue.
            // Currently clues are objects (e.g. { type: 1, ... }).
            // We should probably rely on a helper to stringify them, 
            // but for now let's dump a basic description.

            let desc = `[${stepData.clue.type}] Clue`;
            // Simple custom stringifier for MVP
            const c = stepData.clue as any;
            if (c.type === 0 || c.type === 'BINARY') { // Binary
              desc = `${c.val1} is ${c.operator === 0 ? '' : 'NOT '} ${c.val2}`;
            } else if (c.type === 1 || c.type === 'ORDINAL') {
              desc = `${c.item1Val} is ${c.operator === 0 ? 'BEFORE' : 'AFTER'} ${c.item2Val} (${c.ordinalCat})`;
            } else if (c.type === 2 || c.type === 'SUPERLATIVE') {
              desc = `${c.targetVal} is the ${c.operator === 0 ? 'LOWEST' : 'HIGHEST'} in ${c.ordinalCat}`;
            } else if (c.type === 3 || c.type === 'UNARY') {
              desc = `${c.targetVal} is ${(c.filter === 0 || c.filter === 'IS_ODD') ? 'ODD' : 'EVEN'} (${c.ordinalCat})`;
            }

            return (
              <li key={idx} style={{
                padding: '8px',
                borderBottom: '1px solid #555',
                backgroundColor: isCurrent ? '#4caf50' : (isPast ? '#2a2a2a' : 'transparent'),
                color: isCurrent ? '#fff' : (isPast ? '#888' : '#ccc'),
                fontWeight: isCurrent ? 'bold' : 'normal'
              }}>
                {idx + 1}. {desc}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default App;
