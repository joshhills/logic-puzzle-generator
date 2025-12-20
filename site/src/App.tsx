import { useState, useEffect, useRef } from 'react';
import './App.css';
import { Generator, CategoryConfig, CategoryType, Puzzle, LogicGrid, Solver, ClueType, GenerativeSession, Clue } from '../../src/index';
import { LogicGridPuzzle } from './components/LogicGridPuzzle';
import { Sidebar } from './components/Sidebar';
import { CategoryEditor } from './components/CategoryEditor';
import { Modal } from './components/Modal';
import { SavedGamesModal, SavedPuzzle } from './components/SavedGamesModal';
import { AppCategoryConfig } from './types';
import { getRecommendedBounds } from '../../src/engine/DifficultyBounds';
import PuzzleWorker from './worker/puzzle.worker?worker';

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
  const [categories, setCategories] = useState<AppCategoryConfig[]>(() => generateDefaultCategories(3, 4));

  // Async Generation State
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // Helper to append logs
  const addLog = (msg: string) => {
    setGenerationLogs(prev => [...prev.slice(-99), msg]); // Keep last 100 logs
  };

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Dirty State
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedState = useRef<string>('');

  // Modals
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
  };

  // --- Step 2: Goal State ---
  const [targetClueCount, setTargetClueCount] = useState(8);
  const [useTargetClueCount, setUseTargetClueCount] = useState(false);
  const [seedInput, setSeedInput] = useState<string>('');
  const [flavorText, setFlavorText] = useState<string>('');
  const [puzzleTitle, setPuzzleTitle] = useState<string>('');

  // Target Fact Selection
  const [targetCat1Idx, setTargetCat1Idx] = useState(0);
  const [targetVal1Idx, setTargetVal1Idx] = useState(0);
  const [targetCat2Idx, setTargetCat2Idx] = useState(1);

  const [useSpecificGoal, setUseSpecificGoal] = useState(true);

  // Clue Constraints
  const [allowedClueTypes, setAllowedClueTypes] = useState<ClueType[]>([
    ClueType.BINARY,
    ClueType.ORDINAL,
    ClueType.SUPERLATIVE,
    ClueType.UNARY,
    ClueType.CROSS_ORDINAL
  ]);

  // Interactive Mode State
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [session, setSession] = useState<GenerativeSession | null>(null);

  const [interactiveSolved, setInteractiveSolved] = useState(false);
  const [nextClueConstraints, setNextClueConstraints] = useState<ClueType[]>([]); // Subset of allowed? or separate?
  // We'll initialize nextClueConstraints with allowedClueTypes when entering mode.

  // --- Step 3: Solution State ---
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  // --- Step 4: Play Mode State ---
  const [viewMode, setViewMode] = useState<'solution' | 'play'>('play');
  const [userPlayState, setUserPlayState] = useState<Record<string, 'T' | 'F'>>({});
  const [checkAnswers, setCheckAnswers] = useState(false);

  // Scroll refs
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Derived State (for visualization)
  const [selectedStep, setSelectedStep] = useState<number>(-1); // -1 = Final Solution, -2 = Start
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [displayGrid, setDisplayGrid] = useState<LogicGrid | null>(null);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Effects ---

  // Persistence: Hydrate on Mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === DATA_VERSION) {
          // ... (hydration logic) ...
          // We let the standard state setters run. 
          // The dirty checker effect will run after render and set dirty=true because baseline is empty.
          // We should probably allow the first effect run to set the baseline?
          // Or just set baseline here?
          // Actually, if we just hydration, we probably don't want to force user to save immediately.
          // BUT, we don't have this complex hydration logic exposed as a function cleanly.
          // Let's just let it be dirty on first load, or...
          // Better: In the main dirty check effect, if lastSavedState.current is empty, set it to current?
          // No, that means any new session starts as "clean". which is probably correct.
        }
      } else {
        // No saved state, fresh start. 
        // Baseline will be empty string initially. 
      }
    } catch (e) {
      console.error("Failed to load persistence", e);
    }
  }, []);

  // Set initial baseline once to avoid immediate dirty state on fresh load
  useEffect(() => {
    // Small timeout to allow hydration
    setTimeout(() => {
      if (lastSavedState.current === '') {
        lastSavedState.current = generateCurrentStateString();
        setIsDirty(false);
      }
    }, 500);
  }, []);

  // Auto-Persist to LocalStorage (throttled)
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
          setPuzzleTitle(data.config.puzzleTitle || '');
          setTargetCat1Idx(data.config.targetCat1Idx || 0);
          setTargetVal1Idx(data.config.targetVal1Idx || 0);
          setTargetCat2Idx(data.config.targetCat2Idx || 1);
          setUseSpecificGoal(data.config.useSpecificGoal ?? true);


          // Puzzle (if any)
          if (data.puzzle) {
            setPuzzle(data.puzzle);
            // Restore view state if puzzle exists
            setMaxReachedStep(data.maxReachedStep || 2);
            setSelectedStep(data.selectedStep ?? -1);

            // Restore Play Mode
            if (data.viewMode) setViewMode(data.viewMode);
            if (data.userPlayState) setUserPlayState(data.userPlayState);
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
        activeStep: isInteractiveMode ? 1 : activeStep, // Reset step if interactive
        maxReachedStep: isInteractiveMode ? 1 : maxReachedStep,
        selectedStep: isInteractiveMode ? -1 : selectedStep,
        config: {
          numCats, numItems,
          targetClueCount, useTargetClueCount, seedInput, flavorText,
          targetCat1Idx, targetVal1Idx, targetCat2Idx, useSpecificGoal
        },
        categories,
        puzzle: isInteractiveMode ? null : puzzle, // Do not save interactive placeholder puzzle
        viewMode,
        userPlayState
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [
    activeStep, maxReachedStep, selectedStep,
    numCats, numItems, categories,
    targetClueCount, useTargetClueCount, seedInput, flavorText,
    targetCat1Idx, targetVal1Idx, targetCat2Idx, useSpecificGoal,
    puzzle, viewMode, userPlayState, isInteractiveMode
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
            const solCat1 = puzzle.solution[cat1.id];
            if (!solCat1) continue;
            const val1 = solCat1[String(baseVal)];
            if (val1 === undefined) continue;

            for (const cat2 of categories) {
              if (cat1.id === cat2.id) continue;
              const solCat2 = puzzle.solution[cat2.id];
              if (!solCat2) continue;
              const val2 = solCat2[String(baseVal)];
              if (val2 === undefined) continue;

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
  }, [puzzle, categories, selectedStep, isInteractiveMode]);

  // Scroll to active step
  useEffect(() => {
    if (stepRefs.current[activeStep]) {
      stepRefs.current[activeStep]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeStep]);

  // Strict Bounds Enforcement
  // Ensure we never stay out of bounds even if state was persisted or default logic missed it
  useEffect(() => {
    const bounds = getRecommendedBounds(numCats, numItems);
    if (targetClueCount < bounds.min) {
      setTargetClueCount(bounds.min);
    } else if (targetClueCount > bounds.max) {
      // Optional: don't strictly enforce max? Max is "useful", not "possible".
      // But let's enforce min strictly.
    }
  }, [numCats, numItems, targetClueCount]);

  // --- Actions ---

  const handleLiveCategoryUpdate = (newCats: AppCategoryConfig[]) => {
    setCategories(newCats);

    const nC = newCats.length;
    const nI = nC > 0 ? newCats[0].values.length : 4;
    setNumCats(nC);
    setNumItems(nI);

    // Reset targets if out of bounds
    if (targetCat1Idx >= nC) setTargetCat1Idx(0);
    if (targetCat2Idx >= nC) setTargetCat2Idx(1);

    // Heuristic: Use precomputed bounds
    const bounds = getRecommendedBounds(nC, nI);
    if (targetClueCount < bounds.min || targetClueCount > bounds.max) {
      const defaultClues = Math.floor((bounds.min + bounds.max) / 2);
      setTargetClueCount(defaultClues);
    }

    // Reset puzzle if structure changes
    setPuzzle(null);
    setSelectedStep(-1);

    // Reset Play Mode
    setUserPlayState({});
    setViewMode('solution');
  };


  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  // --- Save / Load Logic ---
  const [isSavesModalOpen, setIsSavesModalOpen] = useState(false);
  const [savedPuzzles, setSavedPuzzles] = useState<SavedPuzzle[]>([]);

  useEffect(() => {
    // Load saves list on mount
    try {
      const raw = localStorage.getItem('saved_puzzles_list');
      if (raw) {
        setSavedPuzzles(JSON.parse(raw));
      }
    } catch (e) { console.error("Failed to load saves list", e); }
  }, []);

  // Helper to get current unique state string
  const generateCurrentStateString = () => {
    return JSON.stringify({
      version: DATA_VERSION,
      activeStep,
      maxReachedStep,
      viewMode,
      userPlayState,
      config: {
        numCats, numItems,
        targetClueCount, useTargetClueCount, seedInput, flavorText, puzzleTitle,
        targetCat1Idx, targetVal1Idx, targetCat2Idx, useSpecificGoal
      },
      categories,
      puzzle
    });
  };

  // Check for changes
  useEffect(() => {
    // Don't mark as dirty if we haven't initialized the baseline yet
    if (lastSavedState.current === '') return;

    const current = generateCurrentStateString();
    setIsDirty(current !== lastSavedState.current);
  }, [
    activeStep, maxReachedStep, viewMode, userPlayState,
    numCats, numItems, targetClueCount, useTargetClueCount, seedInput, flavorText, puzzleTitle,
    targetCat1Idx, targetVal1Idx, targetCat2Idx, useSpecificGoal,
    categories, puzzle
  ]);

  const handleQuickSave = () => {
    const currentStateStr = generateCurrentStateString();
    // Parse it back to object for storage to keep clean structure
    const state = JSON.parse(currentStateStr);
    state.timestamp = Date.now(); // Update timestamp

    const newSave: SavedPuzzle = {
      id: String(Date.now()),
      title: puzzleTitle || 'Untitled Puzzle',
      date: Date.now(),
      preview: `${numCats} Categories, ${numItems} Items`,
      data: state
    };

    const newSaves = [newSave, ...savedPuzzles].slice(0, 10);
    setSavedPuzzles(newSaves);
    localStorage.setItem('saved_puzzles_list', JSON.stringify(newSaves));

    // Update baseline
    lastSavedState.current = currentStateStr;
    setIsDirty(false);

    showAlert('Success', 'Puzzle state saved successfully!');
  };

  const handleLoadSave = (save: SavedPuzzle) => {
    try {
      const data = save.data;
      // Restore
      setActiveStep(data.activeStep ?? 0);
      setMaxReachedStep(data.maxReachedStep ?? 0);
      setSelectedStep(data.selectedStep ?? -1);
      setNumCats(data.config.numCats);
      setNumItems(data.config.numItems);
      setCategories(data.categories || []);

      setTargetClueCount(data.config.targetClueCount);
      setUseTargetClueCount(data.config.useTargetClueCount);
      setSeedInput(data.config.seedInput || '');
      setFlavorText(data.config.flavorText || '');
      setPuzzleTitle(data.config.puzzleTitle || '');
      setTargetCat1Idx(data.config.targetCat1Idx || 0);
      setTargetVal1Idx(data.config.targetVal1Idx || 0);
      setTargetCat2Idx(data.config.targetCat2Idx || 1);
      setUseSpecificGoal(data.config.useSpecificGoal ?? true);

      setPuzzle(data.puzzle || null);
      setViewMode(data.viewMode || 'play');
      setUserPlayState(data.userPlayState || {});

      // Sync baseline
      const expectedStateStr = JSON.stringify({
        version: DATA_VERSION,
        activeStep: data.activeStep ?? 0,
        maxReachedStep: data.maxReachedStep ?? 0,
        viewMode: data.viewMode || 'play',
        userPlayState: data.userPlayState || {},
        config: {
          numCats: data.config.numCats,
          numItems: data.config.numItems,
          targetClueCount: data.config.targetClueCount,
          useTargetClueCount: data.config.useTargetClueCount,
          seedInput: data.config.seedInput || '',
          flavorText: data.config.flavorText || '',
          puzzleTitle: data.config.puzzleTitle || '',
          targetCat1Idx: data.config.targetCat1Idx || 0,
          targetVal1Idx: data.config.targetVal1Idx || 0,
          targetCat2Idx: data.config.targetCat2Idx || 1,
          useSpecificGoal: data.config.useSpecificGoal ?? true
        },
        categories: data.categories || [],
        puzzle: data.puzzle || null
      });

      lastSavedState.current = expectedStateStr;
      setIsDirty(false);
      setIsSavesModalOpen(false);

      showAlert('Success', 'Puzzle loaded successfully!');
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to load save.');
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteSave = () => {
    if (!deleteConfirmId) return;
    const newSaves = savedPuzzles.filter(s => s.id !== deleteConfirmId);
    setSavedPuzzles(newSaves);
    localStorage.setItem('saved_puzzles_list', JSON.stringify(newSaves));
    setDeleteConfirmId(null);
  };

  // Play Mode Action
  const handleCellInteraction = (cat1: string, val1: string | number, cat2: string, val2: string | number) => {
    // Always canonicalize key to avoid (A,B) vs (B,A) dupes
    // Sort categories by ID
    const [cA, cB] = [cat1, cat2].sort();
    // If categories swapped, swap values too
    const [vA, vB] = cA === cat1 ? [val1, val2] : [val2, val1];

    const key = `${cA}:${cB}:${vA}:${vB}`;

    // Cycle: Empty -> 'F' -> 'T' -> Empty
    // Current State
    const curr = userPlayState[key];
    let next: 'T' | 'F' | undefined = undefined;

    if (curr === undefined) next = 'F'; // Empty -> Cross
    else if (curr === 'F') next = 'T'; // Cross -> Tick
    else if (curr === 'T') next = undefined; // Tick -> Empty

    const newState = { ...userPlayState };
    if (next === undefined) {
      delete newState[key];
    } else {
      newState[key] = next;
    }
    setUserPlayState(newState);
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsGenerating(false);
    addLog("Generation cancelled by user.");
  };

  const handleGenerate = () => {
    // Prevent double clicking
    if (isGenerating) return;

    setIsGenerating(true);
    setGenerationLogs([]); // Clear logs

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

    // Validate target categories
    const c1 = categories[targetCat1Idx] || categories[0];
    const c2 = categories[targetCat2Idx] || categories[1];

    if (c1.id === c2.id) {
      showAlert("Configuration Error", "Target Categories must be different.");
      setIsGenerating(false);
      return;
    }
    const v1 = c1.values[targetVal1Idx] || c1.values[0];

    const targetFact = useSpecificGoal ? {
      category1Id: c1.id,
      value1: v1,
      category2Id: c2.id,
    } : undefined;


    // Interactive Mode is still sync for now (or could be moved to worker too, but keeping minimal changes first)
    if (isInteractiveMode) {
      try {
        const gen = new Generator(s);
        const sess = gen.startSession(categories, targetFact);
        setSession(sess);
        setInteractiveSolved(false);
        setNextClueConstraints([...allowedClueTypes]);

        setPuzzle({
          solution: sess.getSolution(),
          clues: [],
          proofChain: [],
          categories: categories,
          targetFact: targetFact as any
        } as any);

        setSelectedStep(-2);
        setActiveStep(2);
        setMaxReachedStep(2);
      } catch (e: any) {
        console.error(e);
        showAlert("Interactive Mode Error", e.message);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Async Worker Generation
    try {
      if (workerRef.current) workerRef.current.terminate();

      workerRef.current = new PuzzleWorker();

      workerRef.current.onmessage = (e) => {
        const { type } = e.data;
        if (type === 'trace') {
          addLog(e.data.message);
        } else if (type === 'done') {
          const { puzzle } = e.data;
          setPuzzle(puzzle);

          if (useTargetClueCount && puzzle.clues.length !== targetClueCount) {
            showAlert(
              "Target Missed",
              `Could not generate exact puzzle with ${targetClueCount} clues within the time limit.\n\nGenerated a valid puzzle with ${puzzle.clues.length} clues instead.`
            );
          }

          setSelectedStep(-2);
          setActiveStep(2);
          setMaxReachedStep(2);
          setIsGenerating(false);
          workerRef.current?.terminate();
          workerRef.current = null;
        } else if (type === 'error') {
          console.error("Worker Error:", e.data.message);
          showAlert("Generation Failed", e.data.message);
          setIsGenerating(false);
          workerRef.current?.terminate();
          workerRef.current = null;
        }
      };

      workerRef.current.onerror = (err) => {
        console.error("Worker Script Error:", err);
        showAlert("Generation Error", "Worker script failed to execute.");
        setIsGenerating(false);
        workerRef.current?.terminate();
        workerRef.current = null;
      };

      workerRef.current.postMessage({
        type: 'start',
        categories,
        targetFact,
        options: {
          targetClueCount: useTargetClueCount ? targetClueCount : undefined,
          timeoutMs: 30000,
          constraints: { allowedClueTypes },
          // generator seed isn't passed yet! we generated 's' but Generator ctor takes it.
          // We need to pass seed to worker if Generator supports it.
          // Currently Generator class ctor takes seed.
          // I need to update worker to create Generator with seed.
          seed: s
        }
      });

    } catch (e: any) {
      console.error(e);
      showAlert("Setup Error", e.message);
      setIsGenerating(false);
    }
  };
  /* eslint-enable react-hooks/exhaustive-deps */

  const maxStep = puzzle ? 2 : Math.min(maxReachedStep, 1);

  const jumpToStep = (idx: number) => {
    if (idx > maxStep) return;
    setActiveStep(idx);
  };

  // --- JSON Export/Import ---
  const handleExportJSON = async () => {
    const state = {
      version: DATA_VERSION,
      timestamp: Date.now(),
      activeStep,
      maxReachedStep,
      selectedStep,
      viewMode,
      userPlayState,
      config: {
        numCats, numItems,
        targetClueCount, useTargetClueCount, seedInput, flavorText, puzzleTitle,
        targetCat1Idx, targetVal1Idx, targetCat2Idx, useSpecificGoal
      },
      categories,
      puzzle
    };

    const jsonStr = JSON.stringify(state, null, 2);
    const fileName = `logic-puzzle-${new Date().toISOString().slice(0, 10)}.json`;

    try {
      // Modern File System Access API
      // @ts-ignore - API might not be in standard lib yet
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled
      console.warn("File System Access API failed, falling back to download.", err);
    }

    // Fallback: Blob Download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
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
            showAlert("Error", "Version mismatch or invalid file.");
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
          setUseSpecificGoal(data.config.useSpecificGoal ?? true);

          // Puzzle (if any)
          setPuzzle(data.puzzle || null);

          showAlert("Success", "Puzzle loaded successfully!");
        } catch (err) {
          console.error(err);
          showAlert("Error", "Failed to parse JSON file.");
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
      className="step-structure" // Added for print
      ref={(el) => { if (el) stepRefs.current[0] = el; }}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        scrollMarginTop: '20px',
        cursor: activeStep !== 0 ? 'pointer' : 'default',
        transition: 'all 0.3s',
        border: activeStep === 0 ? '1px solid #3b82f6' : '1px solid transparent'
      }}
      onClick={() => activeStep !== 0 && jumpToStep(0)}
    >
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="step-header" style={{ margin: 0, color: '#fff' }}>1. Structure</h3>
        <div style={{ color: '#aaa' }}>{numCats} Categories, {numItems} Items</div>
      </div>

      {activeStep === 0 && (
        <div style={{ padding: '0 20px 20px 20px', color: '#ccc' }}>
          <CategoryEditor
            originalCategories={categories}
            draftCategories={categories}
            onDraftUpdate={handleLiveCategoryUpdate}
            hideFooter={true}
          />

          <button
            onClick={(e) => { e.stopPropagation(); setActiveStep(1); }}
            style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', float: 'right' }}
          >
            Continue
          </button>
          <div style={{ clear: 'both' }}></div>
        </div>
      )}
    </div>
  );

  const renderGoalStep = () => (
    <div
      key="step1"
      className="step-goal" // Added for print
      ref={(el) => { if (el) stepRefs.current[1] = el; }}
      onClick={() => jumpToStep(1)}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        scrollMarginTop: '20px',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.9em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Puzzle Objective</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9em', color: '#aaa' }}>
                <input
                  type="checkbox"
                  checked={useSpecificGoal}
                  onChange={(e) => setUseSpecificGoal(e.target.checked)}
                />
                Define Specific Goal
              </label>
            </div>

            {useSpecificGoal ? (
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
            ) : (
              <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                Figure out the whole board.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2em', fontWeight: 'bold', color: '#8ec07c' }}>
              <input
                type="checkbox"
                checked={isInteractiveMode}
                onChange={(e) => {
                  setIsInteractiveMode(e.target.checked);
                  // Clean up any existing state when switching modes
                  setPuzzle(null);
                  setSession(null);
                  setInteractiveSolved(false);
                  // if (activeStep === 2) setActiveStep(1); // Dead code: This UI is only visible in Step 1
                }}
                style={{ width: '20px', height: '20px' }}
              />
              Enable Interactive Mode
            </label>
            <div style={{ fontSize: '0.9em', color: '#888', marginLeft: '34px' }}>
              Generate clues one by one instead of a full puzzle.
            </div>
          </div>



          {!isInteractiveMode && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={useTargetClueCount}
                    onChange={(e) => setUseTargetClueCount(e.target.checked)}
                  />
                  Target Clue Count ({getRecommendedBounds(numCats, numItems).min} - {getRecommendedBounds(numCats, numItems).max})
                </label>
              </div>

              {useTargetClueCount && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={getRecommendedBounds(numCats, numItems).min}
                    max={getRecommendedBounds(numCats, numItems).max}
                    value={targetClueCount}
                    onChange={(e) => {
                      setTargetClueCount(parseInt(e.target.value));
                      // setUseTargetClueCount(true); // Redundant if already rendered
                    }}
                    style={{ flex: 1, marginRight: '10px' }}
                  />
                  <span style={{ fontWeight: 'bold', width: '30px', textAlign: 'center' }}>{targetClueCount}</span>
                </div>
              )}
            </div>
          )}


          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#222', borderRadius: '8px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Allowed Clue Types
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              {[
                { type: ClueType.BINARY, label: 'Binary (Is/Not)' },
                { type: ClueType.ORDINAL, label: 'Ordinal (Before/After)' },
                { type: ClueType.SUPERLATIVE, label: 'Superlative (First/Last)' },
                { type: ClueType.UNARY, label: 'Unary (Values)' },
                { type: ClueType.CROSS_ORDINAL, label: 'Cross-Ordinal' }
              ].map((opt) => {
                const isOrdinalDependent = [
                  ClueType.ORDINAL,
                  ClueType.SUPERLATIVE,
                  ClueType.UNARY,
                  ClueType.CROSS_ORDINAL
                ].includes(opt.type);

                const hasOrdinalCategory = categories.some(c => c.type === CategoryType.ORDINAL);
                const isDisabled = isOrdinalDependent && !hasOrdinalCategory;

                return (
                  <label key={opt.type} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: isDisabled ? 'not-allowed' : 'pointer', color: isDisabled ? '#666' : '#ccc', opacity: isDisabled ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={allowedClueTypes.includes(opt.type)}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedClueTypes(prev => [...prev, opt.type]);
                        } else {
                          setAllowedClueTypes(prev => prev.filter(t => t !== opt.type));
                        }
                      }}
                    />
                    {opt.label} {isDisabled && <span style={{ fontSize: '0.8em' }}>(Requires Ordinal Category)</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Puzzle Title (Optional)</label>
            <input
              type="text"
              value={puzzleTitle}
              onChange={(e) => setPuzzleTitle(e.target.value)}
              placeholder="My Awesome Puzzle"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' }}
            />
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
          <div style={{ float: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isGenerating && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
              disabled={isGenerating}
              style={{
                padding: '10px 20px',
                backgroundColor: isInteractiveMode ? '#8ec07c' : (isGenerating ? '#666' : '#10b981'),
                color: isInteractiveMode ? '#282828' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: isGenerating ? 'wait' : 'pointer',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
                opacity: isGenerating ? 0.7 : 1
              }}
            >
              {isGenerating ? 'Working...' : (isInteractiveMode ? 'Start Session' : 'Generate Puzzle')}
            </button>
          </div>
          <div style={{ clear: 'both' }}></div>

          {/* Trace Logs Console */}
          {(isGenerating || generationLogs.length > 0) && !isInteractiveMode && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#111',
              color: '#00ff00',
              fontFamily: 'monospace',
              fontSize: '0.85em',
              borderRadius: '6px',
              border: '1px solid #333',
              maxHeight: '120px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {generationLogs.length === 0 ? (
                <span style={{ color: '#666' }}>Waiting for logs...</span>
              ) : (
                generationLogs.map((log, idx) => (
                  <div key={idx} style={{ lineHeight: '1.4' }}>{log}</div>
                ))
              )}
              {isGenerating && <div style={{ animation: 'blink 1s infinite', color: '#00ff00' }}>_</div>}
            </div>
          )}
          <div style={{ clear: 'both' }}></div>
        </div>
      )
      }
    </div >
  );




  const renderSolutionStep = () => {
    if (!puzzle) return null;
    // Date Formatting Helper
    // Date Formatting & Ambiguity Helper
    const valueCounts = new Map<string, number>();
    categories.forEach(c => c.values.forEach(v => {
      const s = String(v);
      valueCounts.set(s, (valueCounts.get(s) || 0) + 1);
    }));

    const formatClueValue = (val: string | number, catId: string) => {
      const cat = categories.find(ct => ct.id === catId);
      let displayVal = String(val);

      if (cat && cat.displayType === 'date') {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          displayVal = new Date(num).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      // If this value string appears in more than one category, disambiguate it
      // We check the raw value 'val' because that's what's shared usually (e.g. "10")
      if ((valueCounts.get(String(val)) || 0) > 1) {
        return `${displayVal} (${catId})`;
      }

      return displayVal;
    };





    return (
      <div
        key="step2"
        className="step-solution" // Added for print
        ref={(el) => { if (el) stepRefs.current[2] = el; }}
        style={{
          backgroundColor: '#2a2a35',
          borderRadius: '12px',
          marginBottom: '100px',
          scrollMarginTop: '20px',
          animation: 'fadeIn 0.5s',
          border: activeStep === 2 ? '1px solid #10b981' : '1px solid transparent'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {puzzleTitle && (
              <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1.5em' }}>{puzzleTitle}</h2>
            )}
            <h3 className="print-hide" style={{ margin: '0 0 5px 0', color: isInteractiveMode ? '#8ec07c' : '#10b981' }}>{isInteractiveMode ? 'Interactive Session' : '3. Clues Generated!'}</h3>
            <div style={{ color: '#aaa', fontSize: '0.9em' }}>
              {useSpecificGoal && puzzle?.targetFact ? (
                <>Goal: Find <strong>{puzzle.targetFact.category2Id}</strong> for <strong>{puzzle.targetFact.value1}</strong> ({puzzle.targetFact.category1Id})</>
              ) : (
                <>Goal: <strong>Fill the entire grid</strong></>
              )}
            </div>
          </div>
          <div className="print-hide">
            {!isInteractiveMode && (
              <>
                <button
                  onClick={() => window.print()} style={{ background: 'none', border: '1px solid #10b981', color: '#10b981', cursor: 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', marginRight: '10px' }}>
                  Print / Save PDF
                </button>
                <button onClick={() => setSelectedStep(-1)} style={{ background: 'none', border: 'none', color: (selectedStep === -1 || (puzzle && selectedStep === puzzle.proofChain.length - 1)) ? '#10b981' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>
                  Show Full Solution
                </button>
              </>
            )}
            {isInteractiveMode && (
              <button className="secondary-button" onClick={() => {
                setActiveStep(1);
                setSession(null);
                setPuzzle(null); // Clean up the puzzle visualization
                setInteractiveSolved(false);
              }} style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>
                Cancel Session
              </button>
            )}
          </div>
        </div>

        {isInteractiveMode && session && (
          <div style={{ padding: '20px', backgroundColor: '#32302f', borderBottom: '1px solid #504945' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#d5c4a1' }}>Generation Controls</h4>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {allowedClueTypes.map(type => {
                const isOrdinalType = [ClueType.ORDINAL, ClueType.SUPERLATIVE, ClueType.UNARY, ClueType.CROSS_ORDINAL].includes(type);
                const hasOrdinalCategory = categories.some(c => c.type === CategoryType.ORDINAL);
                const isDisabled = isOrdinalType && !hasOrdinalCategory;

                return (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#282828', borderRadius: '4px', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={nextClueConstraints.includes(type)}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (isDisabled) return;
                        if (e.target.checked) setNextClueConstraints([...nextClueConstraints, type]);
                        else setNextClueConstraints(nextClueConstraints.filter(t => t !== type));
                      }}
                    />
                    {ClueType[type]} {isDisabled && <span style={{ fontSize: '0.7em', color: '#888' }}>(Req. Ordinal)</span>}
                  </label>
                );
              })}
            </div>
            <button
              onClick={() => {
                const result = session.getNextClue({ allowedClueTypes: nextClueConstraints });
                if (result.clue) {
                  // Append to puzzle state
                  // Use 'any' cast for proof step compatibility since we just need the clue for App.tsx replay logic
                  const newStep = { clue: result.clue } as any;
                  const newProof = [...puzzle.proofChain, newStep];
                  const newClues = [...puzzle.clues, result.clue];

                  setPuzzle({ ...puzzle, clues: newClues, proofChain: newProof });
                  // Auto-advance scrubber
                  setSelectedStep(newProof.length - 1);
                } else {
                  if (result.solved) {
                    showAlert("Puzzle Solved!", "The grid is fully solved!");
                    setInteractiveSolved(true);
                  } else {
                    showAlert("No Clue Found", "Could not generate a clue with these constraints.");
                  }
                }
                if (result.solved) {
                  setInteractiveSolved(true);
                  if (result.clue) showAlert("Puzzle Solved!", "The grid is fully solved!");
                }
              }}
              disabled={interactiveSolved || nextClueConstraints.length === 0}
              style={{ padding: '10px 20px', backgroundColor: '#8ec07c', color: '#282828', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', opacity: (interactiveSolved || nextClueConstraints.length === 0) ? 0.5 : 1 }}
            >
              {interactiveSolved ? 'Session Complete' : 'Generate Next Clue'}
            </button>
            <button
              onClick={() => {
                const result = session.rollbackLastClue();
                if (result.success) {
                  const newProof = puzzle.proofChain.slice(0, -1);
                  const newClues = puzzle.clues.slice(0, -1);
                  setPuzzle({ ...puzzle, clues: newClues, proofChain: newProof });
                  setInteractiveSolved(false);
                  // Move scrubber back logic
                  if (newProof.length === 0) {
                    // If no clues left, go to step 0 (empty grid)
                    setSelectedStep(-2);
                  } else if (selectedStep >= newProof.length) {
                    // If we were at the end, clamp to new end
                    setSelectedStep(newProof.length - 1);
                  }
                }
              }}
              disabled={puzzle.proofChain.length === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: '#d3869b',
                color: '#282828',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 'bold',
                cursor: puzzle.proofChain.length === 0 ? 'not-allowed' : 'pointer',
                opacity: puzzle.proofChain.length === 0 ? 0.5 : 1,
                marginLeft: '10px'
              }}
            >
              Undo Last
            </button>
          </div>
        )}

        {/* Interactive Clue Scrubber */}
        <div className="clue-list" style={{ padding: '0' }}>
          {/* Step 0: Start */}
          <div
            className={!flavorText ? 'print-hide' : ''}
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
                const v1 = formatClueValue(c.val1, c.cat1);
                const v2 = formatClueValue(c.val2, c.cat2);
                desc = `${v1} is ${c.operator === 0 ? '' : 'NOT '} ${v2}`;
              } else if (c.type === 1 || c.type === 'ORDINAL') {
                const v1 = formatClueValue(c.item1Val, c.item1Cat);
                const v2 = formatClueValue(c.item2Val, c.item2Cat);
                let opText = '';
                if (c.operator === 0) opText = 'AFTER';
                else if (c.operator === 1) opText = 'BEFORE';
                else if (c.operator === 2) opText = 'NOT AFTER'; // <=
                else if (c.operator === 3) opText = 'NOT BEFORE'; // >=
                desc = `${v1} is ${opText} ${v2} (${c.ordinalCat})`;
              } else if (c.type === 2 || c.type === 'SUPERLATIVE') {
                const v1 = formatClueValue(c.targetVal, c.targetCat);
                let opText = '';
                if (c.operator === 0) opText = 'LOWEST';
                else if (c.operator === 1) opText = 'HIGHEST';
                else if (c.operator === 2) opText = 'NOT LOWEST';
                else if (c.operator === 3) opText = 'NOT HIGHEST';
                desc = `${v1} is the ${opText} in ${c.ordinalCat}`;
              } else if (c.type === 3 || c.type === 'UNARY') {
                const v1 = formatClueValue(c.targetVal, c.targetCat);
                desc = `${v1} is ${(c.filter === 0 || c.filter === 'IS_ODD') ? 'ODD' : 'EVEN'} (${c.ordinalCat})`;
              } else if (c.type === 4 || c.type === 'CROSS_ORDINAL') {
                const v1 = formatClueValue(c.item1Val, c.item1Cat);
                const v2 = formatClueValue(c.item2Val, c.item2Cat);
                const formatOffset = (offset: number) => {
                  if (offset === 0) return 'same as'; // Should not happen
                  if (offset === -1) return 'immediately BEFORE';
                  if (offset === 1) return 'immediately AFTER';
                  if (offset < 0) return `${Math.abs(offset)} positions BEFORE`;
                  return `${offset} positions AFTER`;
                };
                const isNot = c.operator === 1; // 1 = NOT_MATCH (roughly, check enum)
                const relation = isNot ? 'is NOT' : 'is';
                desc = `The item ${formatOffset(c.offset1)} ${v1} (${c.ordinal1}) ${relation} the item ${formatOffset(c.offset2)} ${v2} (${c.ordinal2})`;
              }
            }

            const isActive = selectedStep === i;
            const isFuture = selectedStep !== -1 && i > selectedStep;

            return (
              <div
                key={i}
                className="clue-row" // Added for print
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
          {!seedInput && !isInteractiveMode && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ padding: '10px 20px', background: 'transparent', color: isGenerating ? '#666' : '#aaa', border: '1px solid #555', borderRadius: '4px', cursor: isGenerating ? 'wait' : 'pointer' }}>
              {isGenerating ? 'Generating...' : 'Reroll with same settings'}
            </button>
          )}
          <button
            className="header-reset-btn"
            onClick={() => setIsResetModalOpen(true)}
            disabled={!canReset}
            style={{ padding: '10px 20px', background: 'transparent', color: !canReset ? '#666' : '#aaa', border: '1px solid #555', borderRadius: '4px', cursor: !canReset ? 'not-allowed' : 'pointer', marginLeft: '10px' }}>
            Reset All
          </button>
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
        onSave={handleQuickSave}
        onManageSaves={() => setIsSavesModalOpen(true)}
        onInfo={() => setIsInfoModalOpen(true)}
        isDirty={isDirty}
      />

      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmReset}
        title="Reset Application"
        message="Are you sure you want to reset everything? This will clear your current puzzle, settings, and saved data. This action cannot be undone."
      />

      <Modal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="About Logic Puzzle Generator"
        type="info"
      >
        <div style={{ color: '#ccc', lineHeight: '1.5', fontSize: '0.95em' }}>
          <p style={{ marginTop: 0 }}>
            <strong>Logic Puzzle Generator</strong> creates solvable logic grid puzzles using a constraint-based engine.
          </p>

          <div style={{ margin: '15px 0', padding: '12px', backgroundColor: '#333', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#fff', fontSize: '0.95em' }}>Open Source & Free (MIT)</div>
            <div style={{ fontSize: '0.9em' }}>
              Free for personal and commercial use (e.g. puzzle books).
            </div>
          </div>

          <p style={{ marginBottom: '8px' }}>Links:</p>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li style={{ marginBottom: '4px' }}><a href="https://github.com/joshhills/logic-puzzle-generator#readme" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Documentation</a></li>
            <li style={{ marginBottom: '4px' }}><a href="https://github.com/joshhills/logic-puzzle-generator/issues" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Report Issues</a></li>
            <li><a href="https://github.com/joshhills/logic-puzzle-generator" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Source Code</a></li>
          </ul>
        </div>
      </Modal>

      <SavedGamesModal
        isOpen={isSavesModalOpen}
        onClose={() => setIsSavesModalOpen(false)}
        saves={savedPuzzles}
        onLoad={handleLoadSave}
        onDelete={handleDeleteRequest}
      />

      {/* Generic Alert Modal */}
      <Modal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => setAlertState({ ...alertState, isOpen: false })}
        type="alert"
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Save?"
        message="Are you sure you want to delete this saved puzzle? This cannot be undone."
        onConfirm={confirmDeleteSave}
        type="confirm"
        confirmText="Delete"
      />

      <div className="main-content">

        {/* Top: Fixed Grid Visualization */}
        <div style={{ padding: '20px', flex: '0 0 auto', borderBottom: '1px solid #333', overflow: 'auto', position: 'relative', zIndex: 10, backgroundColor: '#111' }}>
          <div className="print-hide" style={{ position: 'absolute', top: '10px', right: '10px', color: '#666', fontSize: '0.8em', textTransform: 'uppercase' }}>
            {puzzle ? (selectedStep === -1 ? 'Solution View' : (selectedStep === -2 ? 'Start Setup' : 'Step Preview')) : 'Preview Mode'}
          </div>
          {displayGrid && (
            <div
              className="grid-container"
              style={{
                width: 'fit-content',
                margin: '20px auto',
                padding: '20px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                border: '1px solid #000',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                color: '#333',
                overflowX: 'auto'
              }}>
              {/* Header: Stable grid to prevent button jumping */}
              {puzzle && (
                <div className="print-hide" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  width: '100%',
                  alignItems: 'center',
                  marginBottom: '15px',
                  padding: '0 10px'
                }}>
                  {/* Left Spacer to keep center balanced */}
                  <div></div>

                  {/* Center: Mode Switcher */}
                  <div style={{ display: 'flex', gap: '5px', backgroundColor: '#eee', padding: '4px', borderRadius: '6px' }}>
                    <button
                      onClick={() => setViewMode('play')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        background: viewMode === 'play' ? '#fff' : 'transparent',
                        color: viewMode === 'play' ? '#10b981' : '#666',
                        fontWeight: viewMode === 'play' ? 'bold' : 'normal',
                        boxShadow: viewMode === 'play' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Play Mode
                    </button>
                    <button
                      onClick={() => setViewMode('solution')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        background: viewMode === 'solution' ? '#fff' : 'transparent',
                        color: viewMode === 'solution' ? '#3b82f6' : '#666',
                        fontWeight: viewMode === 'solution' ? 'bold' : 'normal',
                        boxShadow: viewMode === 'solution' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Solution View
                    </button>
                  </div>

                  {/* Right: Check Answers (only in Play Mode) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {viewMode === 'play' && (
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85em',
                        color: '#444',
                        userSelect: 'none'
                      }}>
                        <input
                          type="checkbox"
                          checked={checkAnswers}
                          onChange={(e) => setCheckAnswers(e.target.checked)}
                        />
                        Check Answers
                      </label>
                    )}
                  </div>
                </div>
              )}

              <LogicGridPuzzle
                grid={displayGrid}
                categories={categories}
                targetFact={activeStep >= 1 ? {
                  category1Id: categories[targetCat1Idx]?.id,
                  value1: categories[targetCat1Idx]?.values[targetVal1Idx] as string,
                  category2Id: categories[targetCat2Idx]?.id
                } : undefined}

                // Play Mode Props
                viewMode={viewMode}
                userPlayState={userPlayState}
                checkAnswers={checkAnswers}
                solution={puzzle?.solution}
                // Only allow interaction if we have a puzzle AND we are in the Solution/Play step (Step index 2)
                // We allow playing even during history scrubbing (User Request)
                onInteract={(puzzle && activeStep >= 2) ? handleCellInteraction : undefined}
              />
            </div>
          )}
        </div>

        {/* Bottom: Scrollable Accordion Flow (Natural Page Scroll) */}
        <div style={{ padding: '40px 10%' }}>
          <div className="print-hide" style={{ marginBottom: '20px', color: '#666', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8em' }}>Configuration Steps</div>
          {renderSteps()}

          {/* Spacer */}
          <div style={{ height: '100px' }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
