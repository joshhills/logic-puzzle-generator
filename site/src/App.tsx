import { useState, useEffect, useRef } from 'react';
import './App.css';
import { Generator, CategoryConfig, CategoryType, Puzzle, LogicGrid, Solver } from '../../src/index';
import { LogicGridPuzzle } from './components/LogicGridPuzzle';
import { Sidebar } from './components/Sidebar';
import { CategoryEditor } from './components/CategoryEditor';
import { Modal } from './components/Modal';

// Steps: 0=Structure, 1=Goal, 2=Solution
const STEPS = ['Structure', 'Goal', 'Solution'];

// Helper to generate defaults
const generateDefaultCategories = (nCats: number, nItems: number): CategoryConfig[] => {
  const newCats: CategoryConfig[] = [];

  // Cluedo-esque Defaults
  const defaults = [
    { id: 'Suspect', values: ['Mustard', 'Plum', 'Green', 'Peacock', 'Scarlett', 'White'] },
    { id: 'Weapon', values: ['Dagger', 'Candlestick', 'Revolver', 'Rope', 'Pipe', 'Wrench'] },
    { id: 'Room', values: ['Hall', 'Lounge', 'Dining', 'Kitchen', 'Ballroom', 'Study'] },
    { id: 'Gold', values: ['10', '20', '30', '40', '50', '60'], type: CategoryType.ORDINAL },
    { id: 'Motive', values: ['Revenge', 'Greed', 'Jealousy', 'Power', 'Fear', 'Rage'] }
  ];

  for (let c = 0; c < nCats; c++) {
    const def = defaults[c];
    const values: string[] = [];

    for (let i = 0; i < nItems; i++) {
      if (def && def.values[i]) {
        values.push(def.values[i]);
      } else {
        // Fallback if nItems > default list (shouldn't happen with max 6, but good safety)
        values.push(`Item ${i + 1}`);
      }
    }

    newCats.push({
      id: def ? def.id : `Category ${c + 1}`,
      values: values,
      type: (def && def.type) ? def.type : CategoryType.NOMINAL
    });
  }
  return newCats;
};

// --- Persistence Config ---
const DATA_VERSION = 1;
const STORAGE_KEY = 'logic_puzzle_state';

function App() {
  const [activeStep, setActiveStep] = useState(0);

  // --- Step 1: Structure State ---
  const [numCats, setNumCats] = useState(3);
  const [numItems, setNumItems] = useState(4);
  const [categories, setCategories] = useState<CategoryConfig[]>(() => generateDefaultCategories(3, 4));
  const [draftCategories, setDraftCategories] = useState<CategoryConfig[] | null>(null);
  const [isEditingCats, setIsEditingCats] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // --- Step 2: Goal State ---
  const [targetClueCount, setTargetClueCount] = useState(8);
  const [useTargetClueCount, setUseTargetClueCount] = useState(true);
  const [seedInput, setSeedInput] = useState<string>('');
  const [flavorText, setFlavorText] = useState<string>('');

  // Target Fact Selection
  const [targetCat1Idx, setTargetCat1Idx] = useState(0);
  const [targetVal1Idx, setTargetVal1Idx] = useState(0);
  const [targetCat2Idx, setTargetCat2Idx] = useState(1);

  // --- Step 3: Solution State ---
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  // Scroll refs
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Derived State (for visualization)
  const [selectedStep, setSelectedStep] = useState<number>(-1); // -1 = Final Solution, -2 = Start
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [displayGrid, setDisplayGrid] = useState<LogicGrid | null>(null);

  // --- Effects ---

  // Persistence: Hydrate on Mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === DATA_VERSION) {
          // Restore State
          setActiveStep(data.activeStep ?? 0);
          setNumCats(data.config.numCats);
          setNumItems(data.config.numItems);
          setCategories(data.categories || []);

          // Goal State
          setTargetClueCount(data.config.targetClueCount);
          setUseTargetClueCount(data.config.useTargetClueCount);
          setSeedInput(data.config.seedInput || '');
          setFlavorText(data.config.flavorText || '');
          setTargetCat1Idx(data.config.targetCat1Idx || 0);
          setTargetVal1Idx(data.config.targetVal1Idx || 0);
          setTargetCat2Idx(data.config.targetCat2Idx || 1);

          // Puzzle (if any)
          if (data.puzzle) {
            setPuzzle(data.puzzle);
            // Restore view state if puzzle exists
            setMaxReachedStep(data.maxReachedStep || 2);
            setSelectedStep(data.selectedStep ?? -1);
          }
        } else {
          console.log("Data version mismatch, defining defaults.");
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }, []);

  // Persistence: Save on Change
  useEffect(() => {
    // Debounce could be good, but for now simple effect is fine.
    // We only save "Stable" state.
    const timer = setTimeout(() => {
      const state = {
        version: DATA_VERSION,
        timestamp: Date.now(),
        activeStep,
        maxReachedStep,
        selectedStep,
        config: {
          numCats, numItems,
          targetClueCount, useTargetClueCount, seedInput, flavorText,
          targetCat1Idx, targetVal1Idx, targetCat2Idx
        },
        categories,
        puzzle
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [
    activeStep, maxReachedStep, selectedStep,
    numCats, numItems, categories,
    targetClueCount, useTargetClueCount, seedInput, flavorText,
    targetCat1Idx, targetVal1Idx, targetCat2Idx,
    puzzle
  ]);

  // Update max reached step
  useEffect(() => {
    setMaxReachedStep(prev => Math.max(prev, activeStep));
  }, [activeStep]);

  // Update Display Grid logic
  useEffect(() => {
    if (categories.length === 0) return;

    if (puzzle) {
      if (selectedStep === -1) {
        // SHOW FULL SOLUTION (God Mode)
        const grid = new LogicGrid(categories);
        const baseCat = categories[0];
        for (const baseVal of baseCat.values) {
          // Populate full solution from valid map
          for (const cat1 of categories) {
            const val1 = puzzle.solution[cat1.id][String(baseVal)];
            for (const cat2 of categories) {
              if (cat1.id === cat2.id) continue;
              const val2 = puzzle.solution[cat2.id][String(baseVal)];
              for (const v2Candidate of cat2.values) {
                const isMatch = (v2Candidate === val2);
                grid.setPossibility(cat1.id, val1, cat2.id, v2Candidate, isMatch);
              }
            }
          }
        }
        setDisplayGrid(grid);
      } else if (selectedStep === -2) {
        // STEP 0: Empty Grid (Start)
        setDisplayGrid(new LogicGrid(categories));
      } else {
        // STEP SCRUBBER MODE
        const grid = new LogicGrid(categories);
        const solver = new Solver();

        // Replay clues
        for (let i = 0; i <= selectedStep; i++) {
          if (i >= puzzle.proofChain.length) break;
          solver.applyClue(grid, puzzle.proofChain[i].clue);
        }
        setDisplayGrid(grid);
      }
    } else {
      // Preview Mode (Empty Grid)
      setDisplayGrid(new LogicGrid(categories));
    }
  }, [puzzle, categories, selectedStep]);

  // Scroll to active step
  useEffect(() => {
    if (stepRefs.current[activeStep]) {
      stepRefs.current[activeStep]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeStep]);

  // --- Actions ---

  const handleStructureChange = (nC: number, nI: number) => {
    setNumCats(nC);
    setNumItems(nI);
    // Regenerate defaults
    const newCats = generateDefaultCategories(nC, nI);
    setCategories(newCats);

    // Reset targets
    if (targetCat1Idx >= nC) setTargetCat1Idx(0);
    if (targetCat2Idx >= nC) setTargetCat2Idx(1);

    // Reset puzzle if structure changes
    setPuzzle(null);
    setSelectedStep(-1);
  };

  const handleOpenEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Initialize draft if not exists (persistence)
    if (!draftCategories) {
      setDraftCategories(JSON.parse(JSON.stringify(categories)));
    }
    setIsEditingCats(true);
  };

  const handleDraftUpdate = (newDraft: CategoryConfig[]) => {
    setDraftCategories(newDraft);
  };

  const handleSaveCategories = () => {
    if (draftCategories) {
      setCategories(draftCategories);
      setDraftCategories(null); // Clear draft
      setIsEditingCats(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftCategories(null); // Discard
    setIsEditingCats(false);
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const handleGenerate = () => {
    // String Hashing for Seed
    const getSeed = (input: string): number => {
      if (!input) return Date.now();
      const num = Number(input);
      if (!isNaN(num)) return num;

      // Simple hash for strings
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
      }
      return hash;
    };

    const s = getSeed(seedInput);
    const gen = new Generator(s);

    const c1 = categories[targetCat1Idx] || categories[0];
    const c2 = categories[targetCat2Idx] || categories[1];
    if (c1.id === c2.id) {
      alert("Target Categories must be different.");
      return;
    }
    const v1 = c1.values[targetVal1Idx] || c1.values[0];

    try {
      const p = gen.generatePuzzle(categories, {
        category1Id: c1.id,
        value1: v1,
        category2Id: c2.id,
      }, {
        targetClueCount: targetClueCount
      });
      setPuzzle(p);
      setSelectedStep(-2); // Start at "Step 0" (Instruction)
      setActiveStep(2);
      setMaxReachedStep(2);
    } catch (e: any) {
      console.error(e);
      alert("Generation failed: " + e.message);
    }
  };

  const maxStep = puzzle ? 2 : Math.min(maxReachedStep, 1);

  const jumpToStep = (idx: number) => {
    if (idx > maxStep) return;
    setActiveStep(idx);
  };

  // --- JSON Export/Import ---
  const handleExportJSON = () => {
    const state = {
      version: DATA_VERSION,
      timestamp: Date.now(),
      activeStep,
      maxReachedStep,
      selectedStep,
      config: {
        numCats, numItems,
        targetClueCount, useTargetClueCount, seedInput, flavorText,
        targetCat1Idx, targetVal1Idx, targetCat2Idx
      },
      categories,
      puzzle
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logic-puzzle-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt: any) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (data.version !== DATA_VERSION) {
            alert("Version mismatch or invalid file.");
            return;
          }
          // Restore State
          setActiveStep(data.activeStep ?? 0);
          setMaxReachedStep(data.maxReachedStep ?? 0);
          setSelectedStep(data.selectedStep ?? -1);
          setNumCats(data.config.numCats);
          setNumItems(data.config.numItems);
          setCategories(data.categories || []);

          // Goal State
          setTargetClueCount(data.config.targetClueCount);
          setUseTargetClueCount(data.config.useTargetClueCount);
          setSeedInput(data.config.seedInput || '');
          setFlavorText(data.config.flavorText || '');
          setTargetCat1Idx(data.config.targetCat1Idx || 0);
          setTargetVal1Idx(data.config.targetVal1Idx || 0);
          setTargetCat2Idx(data.config.targetCat2Idx || 1);

          // Puzzle (if any)
          setPuzzle(data.puzzle || null);

          alert("Puzzle loaded successfully!");
        } catch (err) {
          console.error(err);
          alert("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // --- Render Sections ---

  const renderStructureStep = () => (
    <div
      key="step0"
      ref={(el) => { if (el) stepRefs.current[0] = el; }}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        cursor: activeStep !== 0 ? 'pointer' : 'default',
        transition: 'all 0.3s',
        border: activeStep === 0 ? '1px solid #3b82f6' : '1px solid transparent'
      }}
      onClick={() => activeStep !== 0 && jumpToStep(0)}
    >
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>1. Structure</h3>
        {activeStep !== 0 && <div style={{ color: '#aaa' }}>{numCats} Categories, {numItems} Items</div>}
      </div>

      {activeStep === 0 && (
        <div style={{ padding: '0 20px 20px 20px', color: '#ccc' }}>
          {!isEditingCats ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Number of Categories: <strong>{numCats}</strong></label>
                <input
                  type="range" min="2" max="5"
                  value={numCats} onChange={(e) => handleStructureChange(Number(e.target.value), numItems)}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>Items per Category: <strong>{numItems}</strong></label>
                <input
                  type="range" min="3" max="6"
                  value={numItems} onChange={(e) => handleStructureChange(numCats, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {categories.map((c, i) => (
                    <div key={i} style={{ padding: '5px 10px', backgroundColor: '#333', borderRadius: '4px', fontSize: '0.9em' }}>
                      {c.id} ({c.values.length})
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleOpenEditor}
                  style={{ background: 'none', border: '1px solid #555', color: '#ccc', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                >
                  Edit Details
                </button>
              </div>
            </>
          ) : (
            <CategoryEditor
              originalCategories={categories}
              draftCategories={draftCategories || categories} // Safe fallback
              onDraftUpdate={handleDraftUpdate}
              onSave={handleSaveCategories}
              onCancel={handleCancelEdit}
            />
          )}

          {!isEditingCats && <button
            onClick={(e) => { e.stopPropagation(); setActiveStep(1); }}
            style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', float: 'right' }}
          >
            Continue
          </button>}
          <div style={{ clear: 'both' }}></div>
        </div>
      )}
    </div>
  );

  const renderGoalStep = () => (
    <div
      key="step1"
      ref={(el) => { if (el) stepRefs.current[1] = el; }}
      onClick={() => jumpToStep(1)}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        opacity: activeStep < 1 ? 0.5 : 1,
        cursor: activeStep > 1 || (activeStep === 0) ? 'pointer' : 'default',
        transition: 'all 0.3s',
        border: activeStep === 1 ? '1px solid #3b82f6' : '1px solid transparent'
      }}
    >
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>2. Goal</h3>
        {activeStep !== 1 && activeStep > 1 && puzzle && <div style={{ color: '#aaa' }}>{useTargetClueCount ? `${targetClueCount} Clues` : 'Any Clues'}</div>}
      </div>

      {activeStep === 1 && (
        <div style={{ padding: '0 20px 20px 20px', color: '#ccc' }}>
          <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#222', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Puzzle Objective</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '1.1em' }}>
              <span>For the group where</span>

              <select
                value={targetCat1Idx}
                onChange={e => {
                  const newVal = Number(e.target.value);
                  setTargetCat1Idx(newVal);
                  if (newVal === targetCat2Idx) {
                    setTargetCat2Idx(targetCat1Idx);
                  }
                }}
                style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', fontWeight: 'bold' }}
              >
                {categories.map((c, i) => (
                  <option key={i} value={i}>{c.id}</option>
                ))}
              </select>

              <span>is</span>

              <select
                value={targetVal1Idx}
                onChange={e => setTargetVal1Idx(Number(e.target.value))}
                style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', fontWeight: 'bold' }}
              >
                {categories[targetCat1Idx]?.values.map((v, i) => (
                  <option key={i} value={i}>{v}</option>
                ))}
              </select>

              <span>, find the</span>

              <select
                value={targetCat2Idx}
                onChange={e => {
                  const newVal = Number(e.target.value);
                  setTargetCat2Idx(newVal);
                  if (newVal === targetCat1Idx) {
                    setTargetCat1Idx(targetCat2Idx);
                  }
                }}
                style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', fontWeight: 'bold' }}
              >
                {categories.map((c, i) => (
                  <option key={i} value={i}>{c.id}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={useTargetClueCount}
                  onChange={(e) => setUseTargetClueCount(e.target.checked)}
                />
                Target Clue Count: <strong>{useTargetClueCount ? targetClueCount : 'Any'}</strong>
              </label>
            </div>

            {useTargetClueCount && (
              <input
                type="range" min="3" max="15"
                value={targetClueCount} onChange={(e) => setTargetClueCount(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            )}
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Flavor Text (Intro)</label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={flavorText}
                onChange={(e) => {
                  if (e.target.value.length <= 256) setFlavorText(e.target.value);
                }}
                placeholder="e.g. Five friends went to the local bakery..."
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#222',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#fff',
                  marginTop: '5px',
                  minHeight: '80px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '10px',
                fontSize: '0.75em',
                color: flavorText.length >= 256 ? '#ef4444' : '#666'
              }}>
                {flavorText.length} / 256
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Seed (Optional)</label>
            <input
              type="text" placeholder="Random"
              value={seedInput} onChange={(e) => setSeedInput(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#111', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
            style={{ padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', float: 'right', fontWeight: 'bold' }}
          >
            Generate Puzzle
          </button>
          <div style={{ clear: 'both' }}></div>
        </div>
      )}
    </div>
  );

  const renderSolutionStep = () => {
    if (!puzzle) return null;
    return (
      <div
        key="step2"
        ref={(el) => { if (el) stepRefs.current[2] = el; }}
        style={{
          backgroundColor: '#2a2a35',
          borderRadius: '12px',
          marginBottom: '100px',
          animation: 'fadeIn 0.5s',
          border: activeStep === 2 ? '1px solid #10b981' : '1px solid transparent'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#10b981' }}>3. Clues Generated!</h3>
            <div style={{ color: '#aaa', fontSize: '0.9em', marginTop: '5px' }}>
              Target: Find <strong>{categories[targetCat2Idx]?.id}</strong> for <strong>{categories[targetCat1Idx]?.values[targetVal1Idx]}</strong> ({categories[targetCat1Idx]?.id})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => window.print()} style={{ background: 'none', border: '1px solid #10b981', color: '#10b981', cursor: 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px' }}>
              Print / Save PDF
            </button>
            <button onClick={() => setSelectedStep(-1)} style={{ background: 'none', border: 'none', color: selectedStep === -1 ? '#10b981' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>
              Show Full Solution
            </button>
          </div>
        </div>

        {/* Interactive Clue Scrubber */}
        <div style={{ padding: '0' }}>
          {/* Step 0: Start */}
          <div
            onClick={() => setSelectedStep(-2)}
            style={{
              padding: '15px 20px',
              borderBottom: '1px solid #333',
              backgroundColor: selectedStep === -2 ? '#333' : 'transparent',
              fontStyle: 'italic',
              color: selectedStep === -2 ? '#fff' : '#888',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '10px', opacity: 0.5, fontFamily: 'monospace', width: '20px', textAlign: 'right', display: 'inline-block' }}>0.</span>
              <span>{flavorText || "The puzzle setup is clean. No clues applied yet."}</span>
            </div>
          </div>

          {puzzle.proofChain.map((step, i) => {
            let desc = "Unknown Clue";
            const c = step.clue as any;
            if (c) {
              // Basic formatting for demo
              if (c.type === 0 || c.type === 'BINARY') {
                desc = `${c.val1} is ${c.operator === 0 ? '' : 'NOT '} ${c.val2}`;
              } else if (c.type === 1 || c.type === 'ORDINAL') {
                desc = `${c.item1Val} is ${c.operator === 0 ? 'BEFORE' : 'AFTER'} ${c.item2Val} (${c.ordinalCat})`;
              } else if (c.type === 2 || c.type === 'SUPERLATIVE') {
                desc = `${c.targetVal} is the ${c.operator === 0 ? 'LOWEST' : 'HIGHEST'} in ${c.ordinalCat}`;
              } else if (c.type === 3 || c.type === 'UNARY') {
                desc = `${c.targetVal} is ${(c.filter === 0 || c.filter === 'IS_ODD') ? 'ODD' : 'EVEN'} (${c.ordinalCat})`;
              }
            }

            const isActive = selectedStep === i;
            const isFuture = selectedStep !== -1 && i > selectedStep;

            return (
              <div
                key={i}
                onClick={() => setSelectedStep(i)}
                style={{
                  padding: '15px 20px',
                  borderBottom: '1px solid #333',
                  backgroundColor: isActive ? '#333' : 'transparent',
                  opacity: isFuture ? 0.3 : 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: '#ddd'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    color: isActive ? '#fff' : '#666',
                    marginRight: '10px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontFamily: 'monospace',
                    width: '20px',
                    textAlign: 'right',
                    display: 'inline-block'
                  }}>
                    {i + 1}.
                  </span>
                  {desc}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          {!seedInput && (
            <button onClick={handleGenerate} style={{ padding: '10px 20px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
              Reroll with same settings
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSteps = () => {
    const items = [];
    if (maxStep >= 2) items.push(renderSolutionStep());
    if (maxStep >= 1) items.push(renderGoalStep());
    items.push(renderStructureStep());
    return items;
  };

  // derived state for reset
  const canReset = activeStep > 0 || puzzle !== null || seedInput !== '' || flavorText !== '';

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#111', flexDirection: 'column' }}>
      <Sidebar
        currentStep={activeStep}
        steps={STEPS}
        onStepSelect={jumpToStep}
        maxReachableStep={maxStep}
        onReset={handleReset}
        canReset={canReset}
        onExport={handleExportJSON}
        onImport={handleImportJSON}
      />

      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmReset}
        title="Reset Application"
        message="Are you sure you want to reset everything? This will clear your current puzzle, settings, and saved data. This action cannot be undone."
      />

      <div className="main-content">

        {/* Top: Fixed Grid Visualization */}
        <div style={{ padding: '20px', flex: '0 0 auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', borderBottom: '1px solid #333', overflow: 'auto', position: 'relative', zIndex: 10, backgroundColor: '#111' }}>
          <div style={{ position: 'absolute', top: '10px', right: '10px', color: '#666', fontSize: '0.8em', textTransform: 'uppercase' }}>
            {puzzle ? (selectedStep === -1 ? 'Solution View' : (selectedStep === -2 ? 'Start Setup' : 'Step Preview')) : 'Preview Mode'}
          </div>
          {displayGrid && (
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '12px',
              width: '80%', /* Match the 10% padding of the bottom section (100 - 10 - 10 = 80) */
              maxWidth: '1200px', /* Reasonable cap */
              display: 'flex',
              justifyContent: 'center',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              color: '#333',
              overflowX: 'auto'
            }}>
              <LogicGridPuzzle
                grid={displayGrid}
                categories={categories}
                targetFact={{
                  category1Id: categories[targetCat1Idx]?.id,
                  value1: categories[targetCat1Idx]?.values[targetVal1Idx] as string,
                  category2Id: categories[targetCat2Idx]?.id
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom: Scrollable Accordion Flow (Natural Page Scroll) */}
        <div style={{ padding: '40px 10%' }}>
          <div style={{ marginBottom: '20px', color: '#666', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8em' }}>Configuration Steps</div>
          {renderSteps()}

          {/* Spacer */}
          <div style={{ height: '100px' }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
