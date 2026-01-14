
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Generator, CategoryConfig, CategoryType, Puzzle, LogicGrid, Solver, ClueType, GenerativeSession, Clue, CrossOrdinalOperator, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, ValueLabel } from '../../src/index';
import { LogicGridPuzzle } from './components/LogicGridPuzzle';
import { Sidebar } from './components/Sidebar';
import { CategoryEditor } from './components/CategoryEditor';
import { Modal } from './components/Modal';

import { usePuzzleTimer } from './hooks/usePuzzleTimer';
import { SavedGamesModal, SavedPuzzle } from './components/SavedGamesModal';
import { AppCategoryConfig, CategoryLabels } from './types';
import { getRecommendedBounds, getRecommendedSweetSpot } from '../../src/engine/DifficultyBounds';
import PuzzleWorker from './worker/puzzle.worker?worker';
import { renderPlainLanguageClue } from './utils/clueRenderer';
import { StoryEditor } from './components/StoryEditor';

// Steps: 0=Structure, 1=Story, 2=Goal, 3=Generate, 4=Solution
const STEPS = ['Structure', 'Story', 'Goal', 'Generate', 'Solution'];

import { APP_DEFAULTS } from './defaults';

// Helper to generate defaults
const generateDefaultCategories = (nCats: number, nItems: number): AppCategoryConfig[] => {
  const newCats: AppCategoryConfig[] = [];

  // Cluedo-esque Defaults (from shared config)
  const defaults = APP_DEFAULTS;

  for (let c = 0; c < nCats; c++) {
    const def = defaults[c];
    const values: string[] = [];

    for (let i = 0; i < nItems; i++) {
      if (def && def.values[i]) {
        values.push(def.values[i]);
      } else {
        // Fallback if nItems > default list (shouldn't happen with max 6, but good safety)
        values.push(`Item ${i + 1} `);
      }
    }

    newCats.push({
      id: def ? def.id : `Category ${c + 1} `,
      values: values,
      type: (def && def.type) ? def.type : CategoryType.NOMINAL,
      labels: (def && def.labels) ? { ...def.labels } : {}
    } as AppCategoryConfig);
  }
  return newCats;
};

// --- Persistence Config ---
const DATA_VERSION = 5;
const STORAGE_KEY = 'logic_puzzle_state';

function App() {
  const [activeStep, setActiveStep] = useState(0);

  // --- Step 1: Structure State ---
  const [numCats, setNumCats] = useState(3);
  const [numItems, setNumItems] = useState(4);
  const [categories, setCategories] = useState<AppCategoryConfig[]>(() => generateDefaultCategories(3, 4));

  // Async Generation State
  const workerRef = useRef<Worker | null>(null);

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

  // UI Modals
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isTimerResetModalOpen, setIsTimerResetModalOpen] = useState(false);

  const [isSavesModalOpen, setIsSavesModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string }>({ isOpen: false, title: '', message: '' });

  // Clue Removal Modal
  const [clueToRemoveIndex, setClueToRemoveIndex] = useState<number | null>(null);
  const isRemoveModalOpen = clueToRemoveIndex !== null;



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
  const [targetCat1Idx, setTargetCat1Idx] = useState(1);
  const [targetVal1Idx, setTargetVal1Idx] = useState(0);
  const [targetCat2Idx, setTargetCat2Idx] = useState(0);

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
  const [session, setSession] = useState<GenerativeSession | null>(null);

  const [interactiveSolved, setInteractiveSolved] = useState(false);
  const [nextClueConstraints, setNextClueConstraints] = useState<ClueType[]>([]);
  const [includeSubjectsInput, setIncludeSubjectsInput] = useState<string[]>([]);
  const [excludeSubjectsInput, setExcludeSubjectsInput] = useState<string[]>([]);
  const [minDeductionsInput, setMinDeductionsInput] = useState<number>(1);
  const [maxDeductionsInput, setMaxDeductionsInput] = useState<number | undefined>(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ clue: Clue, score: number, deductions: number, updates: number, isDirectAnswer: boolean, percentComplete: number }[]>([]);
  // We'll initialize nextClueConstraints with allowedClueTypes when entering mode.
  const [expandedClueIndex, setExpandedClueIndex] = useState<number | null>(null);
  // We'll initialize nextClueConstraints with allowedClueTypes when entering mode.

  // --- Step 3: Solution State ---
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  // --- Step 4: Play Mode State ---
  const [viewMode, setViewMode] = useState<'solution' | 'play'>('play');
  const [userPlayState, setUserPlayState] = useState<Record<string, 'T' | 'F'>>({});
  const [checkAnswers, setCheckAnswers] = useState(false);

  // Interactive Mode State
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);

  // Timer Hook
  // Active if in Interactive Gen Session OR if in Standard Mode 'Play Mode'
  // Timer Logic:
  // - Standard Mode: Active if puzzle exists and in Play Mode.
  // - Interactive Mode: Active ONLY if puzzle is SOLVED (session complete) AND in Play Mode.
  // Actually, user wants: "in the generative session the timer should not advance until there is a complete puzzle"
  // This implies: isInteractiveMode AND interactiveSolved.
  const isTimerActive = (isInteractiveMode ? interactiveSolved : !!puzzle) && viewMode === 'play';
  const { seconds, isPaused, resetTimer, togglePause, formatTime, setSeconds } = usePuzzleTimer(isTimerActive);

  // Scroll refs
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Derived State (for visualization)
  const [selectedStep, setSelectedStep] = useState<number>(-1); // -1 = Final Solution, -2 = Start
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [displayGrid, setDisplayGrid] = useState<LogicGrid | null>(null);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  // Live Search Update
  useEffect(() => {
    if (isInteractiveMode && session && isSearchOpen) {
      try {
        const results = session.getScoredMatchingClues({
          allowedClueTypes: nextClueConstraints,
          includeSubjects: includeSubjectsInput.length > 0 ? includeSubjectsInput : undefined,
          excludeSubjects: excludeSubjectsInput.length > 0 ? excludeSubjectsInput : undefined,
          minDeductions: minDeductionsInput,
          maxDeductions: maxDeductionsInput
        }, 50); // limit 50
        setSearchResults(results);
      } catch (e) {
        // If config is invalid (e.g. min > max), just clear results or log
        // We could also set an error state to display to user, but clearing lists avoids crash.
        console.warn("Search error:", e);
        setSearchResults([]);
      }
    }
  }, [isInteractiveMode, session, isSearchOpen, nextClueConstraints, includeSubjectsInput, excludeSubjectsInput, minDeductionsInput, maxDeductionsInput, puzzle]); // Update when constraints or puzzle state changes
  // Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, timeLeft]);
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
          setTargetCat1Idx(data.config.targetCat1Idx ?? 0);
          setTargetVal1Idx(data.config.targetVal1Idx ?? 0);
          setTargetCat2Idx(data.config.targetCat2Idx ?? 1);
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
            if (data.timerSeconds !== undefined) setSeconds(data.timerSeconds);
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
        userPlayState,
        timerSeconds: seconds // Save timer state
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);

    return () => clearTimeout(timer);
  }, [
    activeStep, maxReachedStep, selectedStep,
    categories, savedPuzzles, isDarkMode, useSpecificGoal, puzzleTitle,
    puzzle, viewMode, userPlayState, isInteractiveMode, seconds
  ]);

  // Check for Share Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        const json = atob(shareData);
        const config = JSON.parse(json);

        if (config.categories) {
          setCategories(config.categories);
          // Update Counts
          setNumCats(config.categories.length);
          setNumItems(config.categories[0]?.values.length || 4);
        }
        if (config.seed) setSeedInput(config.seed);

        // Restore target fact logic if possible
        if (config.targetFact) {
          setUseSpecificGoal(true);
          // Need to set indices based on IDs, but might be fragile if IDs changed.
          // For now, minimal support.
        }

        showAlert("Shared Puzzle Loaded", "Configuration loaded from share link.");

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);

      } catch (e) {
        console.error("Failed to parse share link", e);
        showAlert("Error", "Invalid share link.");
      }
    }
  }, []);

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
    if (targetCat2Idx >= nC) setTargetCat2Idx(nC > 1 ? 1 : 0);

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
    resetTimer(); // Reset timer on structure change
  };


  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  // --- Save / Load Logic ---
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
      puzzle,
      timerSeconds: seconds
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
    categories, puzzle, seconds
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
      setSeconds(data.timerSeconds || 0); // Restore timer

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
        puzzle: data.puzzle || null,
        timerSeconds: data.timerSeconds || 0
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

  const handleRenameSave = (id: string, newTitle: string) => {
    const newSaves = savedPuzzles.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setSavedPuzzles(newSaves);
    localStorage.setItem('saved_puzzles_list', JSON.stringify(newSaves));
  };

  const handleShare = () => {
    const shareConfig = {
      categories: categories,
      seed: seedInput,
      targetFact: useSpecificGoal ? {
        c1: categories[targetCat1Idx]?.id,
        c2: categories[targetCat2Idx]?.id,
        val: categories[targetCat1Idx]?.values[targetVal1Idx]
      } : undefined
    };

    const json = JSON.stringify(shareConfig);
    const b64 = btoa(json);
    const url = `${window.location.origin}${window.location.pathname}?share=${b64}`;

    navigator.clipboard.writeText(url).then(() => {
      showAlert("Link Copied!", "Share link copied to clipboard. Send it to a friend!");
    }).catch(() => {
      showAlert("Error", "Failed to copy link.");
    });
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

    // --- Auto-Completion Check ---
    if (puzzle && puzzle.solution) {
      // Check if grid is full
      const totalCells = categories.length * (categories.length - 1) / 2 * Math.pow(categories[0].values.length, 2);
      // Wait, calculation is tricky.
      // Logic: For every unique pair of categories (C1, C2), there are N*N cells.
      // Number of pairs = K*(K-1)/2. Total Cells = Pairs * N^2.
      // BUT `userPlayState` only stores explicitly marked cells (T or F).
      // A "Full" grid means every cell has a mark? Or just every "True" is found?
      // User said: "fills in the entire play board".
      // Usually implies every cell has T/F.

      // Let's assume completeness based on "All Truths Found" is better UX?
      // Or literally every cell filled?
      // Most users play by eliminating.
      // Let's check if the number of entries in `newState` == Total Cells.

      // Calculate Total Expected Keys
      let expectedKeys = 0;
      const N = categories[0].values.length;
      const numCats = categories.length;
      const totalPairs = (numCats * (numCats - 1)) / 2;
      const totalGridCells = totalPairs * N * N;

      if (Object.keys(newState).length === totalGridCells) {
        // Check Correctness
        let isCorrect = true;
        for (const [k, v] of Object.entries(newState)) {
          const [cA, cB, vA, vB] = k.split(':');

          // Solution is Record<CatId, Record<BaseId, Value>>
          const sol = puzzle.solution;
          const catAMap = sol[cA] || {};
          const catBMap = sol[cB] || {};

          // Find base ID for vA and vB
          // Value could be string or number, ensure strict comparison or string normalization?
          // App usually normalizes to string for UI but values are stored as string|number.
          // catAMap values are valueLabels.

          const getBaseId = (map: Record<string, string | number>, val: string) => {
            return Object.entries(map).find(([_, v]) => String(v) === val)?.[0];
          };

          const baseA = getBaseId(catAMap, vA);
          const baseB = getBaseId(catBMap, vB);

          // If either value is not in solution (shouldn't happen), assume incorrect?
          if (baseA === undefined || baseB === undefined) {
            isCorrect = false;
            break;
          }

          const shouldMatch = baseA === baseB;
          if (v === 'T' && !shouldMatch) isCorrect = false;
          if (v === 'F' && shouldMatch) isCorrect = false;

          if (!isCorrect) break;
        }

        if (isCorrect) {
          togglePause(); // Stop timer
          showAlert("Congratulations!", "Puzzle completed correctly!");
        } else {
          // Show "Something doesn't look right"
          showAlert("Check Solution", "Something doesn't look right. Keep trying!");
        }
      }
    }
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleGenerate = () => {
    // Prevent double clicking
    if (isGenerating) return;

    setIsGenerating(true);
    setTimeLeft(180); // 3 minutes (Sync with timeoutMs)

    const ordinalCount = categories.filter(c => c.type === CategoryType.ORDINAL).length;

    // Check for valid Unary category (mixed odd/even in at least one ordinal category)
    const hasValidUnaryCategory = categories.some(cat => {
      if (cat.type !== CategoryType.ORDINAL) return false;
      const numericValues = cat.values.map(v => Number(v)).filter(v => !isNaN(v));
      const hasOdd = numericValues.some(v => v % 2 !== 0);
      const hasEven = numericValues.some(v => v % 2 === 0);
      return hasOdd && hasEven;
    });

    const filteredAllowedClueTypes = allowedClueTypes.filter(type => {
      if (type === ClueType.CROSS_ORDINAL) return ordinalCount >= 2;
      if (type === ClueType.UNARY) return hasValidUnaryCategory; // Must have mixed odd/even
      if ([ClueType.ORDINAL, ClueType.SUPERLATIVE].includes(type)) return ordinalCount >= 1;
      return true;
    });

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
        const ss = gen.startSession(categories, targetFact);
        setSession(ss);
        setInteractiveSolved(false);

        setNextClueConstraints(filteredAllowedClueTypes);

        setPuzzle({
          solution: ss.getSolution(),
          clues: [],
          proofChain: [],
          categories: categories,
          targetFact: targetFact as any
        } as any);
        setUserPlayState({}); // Reset play board on reroll
        resetTimer(); // Reset timer on new generation

        setSelectedStep(-2);
        setActiveStep(4);
        setMaxReachedStep(4);
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
          // Logger removed
        } else if (type === 'done') {
          const { puzzle } = e.data;
          setPuzzle(puzzle);
          resetTimer(); // Reset timer on new generation

          if (useTargetClueCount && puzzle.clues.length !== targetClueCount) {
            showAlert(
              "Target Missed",
              `Could not generate exact puzzle with ${targetClueCount} clues within the time limit.\n\nGenerated a valid puzzle with ${puzzle.clues.length} clues instead.`
            );
          }

          setSelectedStep(-2);
          setActiveStep(4);
          setMaxReachedStep(4);
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
          timeoutMs: 180000,
          constraints: { allowedClueTypes: filteredAllowedClueTypes },
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

  const maxStep = puzzle ? 4 : Math.min(maxReachedStep, 3);

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
      puzzle,
      timerSeconds: seconds
    };

    const jsonStr = JSON.stringify(state, null, 2);
    const fileName = `logic - puzzle - ${new Date().toISOString().slice(0, 10)}.json`;

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
          setSeconds(data.timerSeconds || 0); // Restore timer

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
        <h3 className="step-header" style={{ margin: 0, color: '#fff' }}>1. Define the structure</h3>
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

          {activeStep === 0 && (
            <div className="step-nav" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                onClick={() => setActiveStep(1)}
              >
                Next: Tell the Story
                <span>&rarr;</span>
              </button>
            </div>
          )}
          <div style={{ clear: 'both' }}></div>
        </div>
      )}
    </div>
  );

  const renderStoryStep = () => {
    return (
      <div
        key="step1"
        className="step-story"
        ref={(el) => { if (el) stepRefs.current[1] = el; }}
        onClick={() => activeStep > 1 && jumpToStep(1)}
        style={{
          backgroundColor: '#2a2a35',
          borderRadius: '12px',
          marginBottom: '20px',
          scrollMarginTop: '20px',
          opacity: activeStep < 1 ? 0.5 : 1,
          cursor: activeStep > 1 ? 'pointer' : 'default',
          transition: 'all 0.3s',
          border: activeStep === 1 ? '1px solid #3b82f6' : '1px solid transparent'
        }}
      >
        <div style={{ padding: '20px', borderBottom: activeStep === 1 ? '1px solid #333' : 'none' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>2. Tell the Story</h3>
        </div>

        {activeStep === 1 && (
          <div style={{ padding: '0 20px 20px 20px' }}>
            <p className="step-desc">Refine how the clues will read. Set unit names, possessive relationships, and natural language prefixes.</p>
            <StoryEditor
              categories={categories}
              onLabelChange={(idx, field, val) => {
                const newCats = [...categories];
                newCats[idx] = { ...newCats[idx], labels: { ...newCats[idx].labels, [field]: val } };
                setCategories(newCats);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', gap: '12px' }}>
              <button
                onClick={() => setActiveStep(0)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#aaa',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#666'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
              >
                &larr; Back
              </button>
              <button
                onClick={() => setActiveStep(2)}
                style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                Continue to Goal
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGoalStep = () => (
    <div
      key="step2"
      className="step-goal"
      ref={(el) => { if (el) stepRefs.current[2] = el; }}
      onClick={() => activeStep > 2 && jumpToStep(2)}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        scrollMarginTop: '20px',
        opacity: activeStep < 2 ? 0.5 : 1,
        cursor: activeStep > 2 ? 'pointer' : 'default',
        transition: 'all 0.3s',
        border: activeStep === 2 ? '1px solid #3b82f6' : '1px solid transparent'
      }}
    >
      <div style={{ padding: '20px', borderBottom: activeStep === 2 ? '1px solid #333' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>3. Set the Goal</h3>
        {activeStep !== 2 && activeStep > 2 && <div style={{ color: '#aaa' }}>{useSpecificGoal ? 'Specific Target' : 'Full Grid'}</div>}
      </div>

      {activeStep === 2 && (
        <div style={{ padding: '20px', color: '#ccc' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Puzzle Title (Optional)</label>
            <input
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
                  }}
                  style={{
                    padding: '8px',
                    paddingRight: '32px',
                    borderRadius: '4px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #444',
                    fontWeight: 'bold',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={i}>{c.id}</option>
                  ))}
                </select>
                <span>is</span>
                <select
                  value={targetVal1Idx}
                  onChange={e => setTargetVal1Idx(Number(e.target.value))}
                  style={{
                    padding: '8px',
                    paddingRight: '32px',
                    borderRadius: '4px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #444',
                    fontWeight: 'bold',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center'
                  }}
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
                  }}
                  style={{
                    padding: '8px',
                    paddingRight: '32px',
                    borderRadius: '4px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #444',
                    fontWeight: 'bold',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3Csvg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center'
                  }}
                >
                  {categories.map((c, i) => (
                    <option key={i} value={i}>{c.id}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ color: '#aaa', fontStyle: 'italic' }}>Figure out the whole board.</div>
            )}

            {useSpecificGoal && targetCat1Idx === targetCat2Idx && (
              <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.9em' }}>
                Error: The target category and the grouping category must be different.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', gap: '12px' }}>
            <button
              onClick={() => setActiveStep(1)}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#aaa',
                border: '1px solid #444',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#666'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
            >
              &larr; Back
            </button>
            <button
              onClick={() => setActiveStep(3)}
              disabled={useSpecificGoal && targetCat1Idx === targetCat2Idx}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: (useSpecificGoal && targetCat1Idx === targetCat2Idx) ? 'not-allowed' : 'pointer',
                opacity: (useSpecificGoal && targetCat1Idx === targetCat2Idx) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)'
              }}
              onMouseEnter={(e) => { if (!(useSpecificGoal && targetCat1Idx === targetCat2Idx)) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { if (!(useSpecificGoal && targetCat1Idx === targetCat2Idx)) e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              Continue to Generate
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderGenerateStep = () => (
    <div
      key="step3"
      className="step-generate"
      ref={(el) => { if (el) stepRefs.current[3] = el; }}
      onClick={() => activeStep > 3 && jumpToStep(3)}
      style={{
        backgroundColor: '#2a2a35',
        borderRadius: '12px',
        marginBottom: '20px',
        scrollMarginTop: '20px',
        opacity: activeStep < 3 ? 0.5 : 1,
        cursor: activeStep > 3 ? 'pointer' : 'default',
        transition: 'all 0.3s',
        border: activeStep === 3 ? '1px solid #8ec07c' : '1px solid transparent'
      }}
    >
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>4. Generate clues</h3>
        {activeStep !== 3 && activeStep > 3 && <div style={{ color: '#aaa' }}>{isInteractiveMode ? 'Interactive' : (useTargetClueCount ? `${targetClueCount} Clues` : 'Full Puzzle')}</div>}
      </div>

      {activeStep === 3 && (
        <div style={{ padding: '0 20px 20px 20px', color: '#ccc' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2em', fontWeight: 'bold', color: '#8ec07c' }}>
              <input
                type="checkbox"
                checked={isInteractiveMode}
                onChange={(e) => {
                  setIsInteractiveMode(e.target.checked);
                  setPuzzle(null);
                  setSession(null);
                  setInteractiveSolved(false);
                  resetTimer(); // Reset timer when switching interactive mode
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
                  <span>Target Clue Count ({getRecommendedBounds(numCats, numItems).min} - {getRecommendedBounds(numCats, numItems).max})</span>
                </label>
              </div>
              {useTargetClueCount && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={getRecommendedBounds(numCats, numItems).min}
                    max={getRecommendedBounds(numCats, numItems).max}
                    value={targetClueCount}
                    onChange={(e) => setTargetClueCount(parseInt(e.target.value))}
                    style={{ flex: 1, marginRight: '10px' }}
                  />
                  <span style={{ fontWeight: 'bold', width: '30px', textAlign: 'center' }}>{targetClueCount}</span>
                </div>
              )}
              {useTargetClueCount && (
                <div style={{ fontSize: '0.85em', color: '#f97316', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span>
                  <span>
                    Exact clue targets may take longer to generate or timeout.
                    (Recommended Sweet Spot: {getRecommendedSweetSpot(numCats, numItems).min} - {getRecommendedSweetSpot(numCats, numItems).max})
                  </span>
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
                { title: 'Core Clues (Standalone)', types: [ClueType.BINARY, ClueType.ORDINAL, ClueType.CROSS_ORDINAL] },
                { title: 'Positional / Relative', types: [ClueType.ADJACENCY, ClueType.BETWEEN] },
                { title: 'Supplemental (Requires Core)', types: [ClueType.SUPERLATIVE, ClueType.UNARY] }
              ].map((group) => (
                <div key={group.title} style={{ marginRight: '20px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>{group.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {group.types.map(type => {
                      const opt = [
                        { type: ClueType.BINARY, label: 'Binary (Is/Not)' },
                        { type: ClueType.ORDINAL, label: 'Ordinal (Before/After)' },
                        { type: ClueType.SUPERLATIVE, label: 'Superlative (First/Last)' },
                        { type: ClueType.UNARY, label: 'Unary (Values)' },
                        { type: ClueType.CROSS_ORDINAL, label: 'Cross-Ordinal' },
                        { type: ClueType.ADJACENCY, label: 'Adjacency (Next to)' },
                        { type: ClueType.BETWEEN, label: 'Between' }
                      ].find(o => o.type === type)!;
                      const isOrdinalDependent = [ClueType.ORDINAL, ClueType.SUPERLATIVE, ClueType.UNARY, ClueType.CROSS_ORDINAL, ClueType.ADJACENCY, ClueType.BETWEEN].includes(opt.type);
                      const ordinalCount = categories.filter(c => c.type === CategoryType.ORDINAL).length;

                      const hasValidUnaryCategory = categories.some(cat => {
                        if (cat.type !== CategoryType.ORDINAL) return false;
                        const numericValues = cat.values.map(v => Number(v)).filter(v => !isNaN(v));
                        const hasOdd = numericValues.some(v => v % 2 !== 0);
                        const hasEven = numericValues.some(v => v % 2 === 0);
                        return hasOdd && hasEven;
                      });

                      const isUnaryUnsupported = opt.type === ClueType.UNARY && !hasValidUnaryCategory && ordinalCount > 0;
                      const isCrossOrdinalUnsupported = opt.type === ClueType.CROSS_ORDINAL && ordinalCount < 2 && ordinalCount > 0;
                      const isDisabled = (isOrdinalDependent && ordinalCount === 0) || isUnaryUnsupported || isCrossOrdinalUnsupported;
                      const isChecked = allowedClueTypes.includes(opt.type) && !isDisabled;

                      return (
                        <label key={opt.type} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: isDisabled ? 'not-allowed' : 'pointer', color: isDisabled ? '#666' : '#ccc', opacity: isDisabled ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) => {
                              let newAllowed = e.target.checked ? [...allowedClueTypes, opt.type] : allowedClueTypes.filter(t => t !== opt.type);
                              const strongTypes = [ClueType.BINARY, ClueType.ORDINAL, ClueType.CROSS_ORDINAL, ClueType.ADJACENCY, ClueType.BETWEEN];
                              const hasStrong = newAllowed.some(t => strongTypes.includes(t));
                              if (newAllowed.length === 0 || !hasStrong) {
                                showAlert("Invalid Configuration", "Ambiguous Constraint Set: Please allow at least one identity-resolving clue type (Core Clues).");
                                return;
                              }
                              setAllowedClueTypes(newAllowed);
                            }}
                          />
                          {opt.label}
                          {isOrdinalDependent && ordinalCount === 0 && <span style={{ fontSize: '0.8em' }}>(Requires Ordinal Category)</span>}
                          {isUnaryUnsupported && <span style={{ fontSize: '0.8em', color: '#f97316', marginLeft: '4px' }} title="Unary clues (Even/Odd) require at least one Ordinal category to contain both odd and even values.">⚠️ Need mix of odd/even values</span>}
                          {isCrossOrdinalUnsupported && <span style={{ fontSize: '0.8em', color: '#f97316', marginLeft: '4px' }} title="Cross-Ordinal clues require at least two separate Ordinal categories.">⚠️ Need 2+ Ordinal categories</span>}
                        </label>
                      );

                    })}
                  </div>
                </div>
              ))}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveStep(2)}
              disabled={isGenerating}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: isGenerating ? '#444' : '#aaa',
                border: `1px solid ${isGenerating ? '#222' : '#444'} `,
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.borderColor = '#666'; }}
              onMouseLeave={(e) => { if (!isGenerating) e.currentTarget.style.borderColor = '#444'; }}
            >
              &larr; Back
            </button>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isGenerating && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                  style={{ padding: '12px 24px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                disabled={isGenerating}
                style={{
                  padding: '12px 26px',
                  backgroundColor: isGenerating ? '#1f4c3a' : '#10b981',
                  color: isGenerating ? '#444' : '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isGenerating ? 'wait' : 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  boxShadow: isGenerating ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
                onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = '#059669'; }}
                onMouseLeave={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = '#10b981'; }}
              >
                {isGenerating ? `Working... (${timeLeft}s)` : (isInteractiveMode ? 'Start Session' : 'Generate Puzzle')}
              </button>
            </div>
          </div>

          {isGenerating && (
            <div style={{ marginTop: '10px', color: '#8ec07c', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', border: '2px solid #8ec07c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Generating puzzle...
            </div>
          )}
        </div>
      )}
    </div>
  );



  // --- Clue Removal (Interactive) ---
  const handleRemoveClue = (index: number) => {
    if (!session || !puzzle) return;

    // session.removeClueAt handles the logic of removing and replaying
    if (session.removeClueAt(index)) {
      const chain = session.getProofChain();

      // Reconstruct puzzle state from session
      // We map the session clues (which have metadata attached) to ProofSteps
      const newProof = chain.map(c => ({
        clue: c,
        deductions: (c as any).deductions
      }));

      setPuzzle({
        ...puzzle,
        proofChain: newProof,
        clues: chain
      });

      // Update interactiveSolved state
      // Let's just set interactiveSolved to false for safety unless we check.
      setInteractiveSolved(false);

      // Reset selection to the end
      if (selectedStep >= newProof.length) {
        setSelectedStep(newProof.length - 1);
      }
    }
  };

  // Drag and Drop State for Clues
  const [draggedClueIndex, setDraggedClueIndex] = useState<number | null>(null);

  // Generation Controls State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleClueDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedClueIndex(index);
  };

  const handleClueDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleClueDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedClueIndex === null || draggedClueIndex === targetIndex) return;

    handleMoveClue(draggedClueIndex, targetIndex);
    setDraggedClueIndex(null);
  };

  const handleClueDragEnd = () => {
    setDraggedClueIndex(null);
  };

  const handleMoveClue = (fromIndex: number, toIndex: number) => {
    if (!session || !puzzle) return;
    if (session.moveClue(fromIndex, toIndex)) {
      const chain = session.getProofChain();
      const newProof = chain.map(c => ({
        clue: c,
        deductions: (c as any).deductions
      }));

      setPuzzle({
        ...puzzle,
        proofChain: newProof,
        clues: chain
      });

      if (selectedStep === fromIndex) setSelectedStep(toIndex);
    }
  };

  const confirmRemoveClue = () => {
    if (clueToRemoveIndex !== null) {
      handleRemoveClue(clueToRemoveIndex);
      setClueToRemoveIndex(null);
    }
  };

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
        key="step4"
        className="step-solution" // Added for print
        ref={(el) => { if (el) stepRefs.current[4] = el; }}
        style={{
          backgroundColor: '#2a2a35',
          borderRadius: '12px',
          marginBottom: '100px',
          scrollMarginTop: '20px',
          animation: 'fadeIn 0.5s',
          border: activeStep === 4 ? '1px solid #10b981' : '1px solid transparent'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            {puzzleTitle && (
              <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1.5em' }}>{puzzleTitle}</h2>
            )}
            <h3 className="print-hide" style={{ margin: '0 0 5px 0', color: isInteractiveMode ? '#8ec07c' : '#10b981' }}>{isInteractiveMode ? 'Interactive Session' : '5. Clues Generated!'}</h3>
            <button
              style={{ width: '100%', marginBottom: '10px', padding: '10px', background: 'transparent', border: '1px solid #444', color: '#10b981', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={handleShare}
            >
              Share Configuration 🔗
            </button>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem' }}>
              {useSpecificGoal && puzzle?.targetFact ? (
                <>Goal: Find <strong>{puzzle.targetFact.category2Id}</strong> for <strong>{puzzle.targetFact.value1}</strong> ({puzzle.targetFact.category1Id})</>
              ) : (
                <>Goal: <strong>Fill the entire grid</strong></>
              )}
          </div>
        </div>
        <div className="print-hide" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(!isInteractiveMode || interactiveSolved) && (
            <>
              <button
                onClick={() => window.print()}
                style={{
                  background: 'transparent',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => {
                  setSelectedStep(-1);
                  setViewMode('solution');
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: (selectedStep === -1 || (puzzle && selectedStep === puzzle.proofChain.length - 1)) ? '#10b981' : '#888',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#666'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; }}
              >
                Show Full Solution
              </button>
            </>
          )}

        </div>

      </div>

        {
      isInteractiveMode && session && (
        <div className="print-hide" style={{ padding: '20px', backgroundColor: '#32302f', borderBottom: '1px solid #504945' }}>
          {/* Generation Controls Header (Collapsible Trigger) */}
          {/* Generation Controls Header (Collapsible Trigger) */}
          <div
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            style={{
              display: 'flex',
              justifyContent: 'flex-start', // Changed to flex-start
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: '#32302f',
              borderRadius: '5px',
              userSelect: 'none'
            }}
          >
            <div style={{ color: '#aaa', marginRight: '10px', fontSize: '1.2em', width: '20px', textAlign: 'center' }}>
              {isSettingsOpen ? '▼' : '▶'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, color: '#d5c4a1' }}>Generation Controls</h4>
              <span style={{ fontSize: '0.8em', color: '#888' }}>({session.getTotalClueCount()} clues)</span>
            </div>
          </div>

          {/* Collapsible Content */}
          {isSettingsOpen && (
            <div style={{ animation: 'fadeIn 0.2s' }}>

              <div style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                {[
                  { title: 'Core Clues (Standalone)', types: [ClueType.BINARY, ClueType.ORDINAL, ClueType.CROSS_ORDINAL] },
                  { title: 'Positional / Relative', types: [ClueType.ADJACENCY, ClueType.BETWEEN] },
                  { title: 'Complex Logic', types: [ClueType.OR, ClueType.ARITHMETIC] },
                  { title: 'Supplemental (Requires Core)', types: [ClueType.SUPERLATIVE, ClueType.UNARY] }
                ].map((group) => (
                  <div key={group.title} style={{ minWidth: '200px' }}>
                    <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>{group.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {group.types.map(type => {
                        const ordinalCount = categories.filter(c => c.type === CategoryType.ORDINAL).length;
                        const hasValidUnaryCategory = categories.some(cat => {
                          if (cat.type !== CategoryType.ORDINAL) return false;
                          const numericValues = cat.values.map(v => Number(v)).filter(v => !isNaN(v));
                          const hasOdd = numericValues.some(v => v % 2 !== 0);
                          const hasEven = numericValues.some(v => v % 2 === 0);
                          return hasOdd && hasEven;
                        });

                        let isDisabled = false;
                        let disabledReason = '';

                        if (type === ClueType.CROSS_ORDINAL) {
                          if (ordinalCount < 2) {
                            isDisabled = true;
                            disabledReason = '(Req. 2+ Ordinal Cats)';
                          }
                        } else if (type === ClueType.UNARY) {
                          if (!hasValidUnaryCategory) {
                            isDisabled = true;
                            disabledReason = '(Req. Mixed Odd/Even)';
                          }
                        } else if ([ClueType.ORDINAL, ClueType.SUPERLATIVE, ClueType.ADJACENCY, ClueType.BETWEEN, ClueType.ARITHMETIC].includes(type)) {
                          if (ordinalCount < 1) {
                            isDisabled = true;
                            disabledReason = '(Req. Ordinal Cat)';
                          }
                        }

                        // Only show types that are globally allowed
                        if (!allowedClueTypes.includes(type)) return null;

                        const isSelected = nextClueConstraints.includes(type);

                        return (
                          <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#282828', borderRadius: '4px', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }}>
                            <input
                              type="checkbox"
                              checked={isSelected && !isDisabled}
                              disabled={isDisabled}
                              onChange={(e) => {
                                if (isDisabled) return;
                                let newAllowed = e.target.checked ? [...nextClueConstraints, type] : nextClueConstraints.filter(t => t !== type);

                                // Validation: Ensure at least one Core type is selected
                                const strongTypes = [ClueType.BINARY, ClueType.ORDINAL, ClueType.CROSS_ORDINAL, ClueType.ADJACENCY, ClueType.BETWEEN];
                                const hasStrong = newAllowed.some(t => strongTypes.includes(t));

                                if (newAllowed.length > 0 && !hasStrong) {
                                  showAlert("Invalid Configuration", "Ambiguous Constraint Set: Please allow at least one Core Clue type (Binary, Ordinal, etc.) to ensure the puzzle is solvable.");
                                  return;
                                }

                                setNextClueConstraints(newAllowed);
                              }}
                            />
                            {ClueType[type]} {isDisabled && <span style={{ fontSize: '0.7em', color: '#888' }}>{disabledReason}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: '15px', color: '#ccc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  {/* Include Subjects */}
                  <div style={{ backgroundColor: '#202020', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: '#8ec07c' }}>Include Subjects (Allowlist)</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {categories.map((cat, i) => (
                        <div key={i}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '4px', color: '#aaa', borderBottom: '1px solid #333' }}>{cat.id}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {cat.values.map((val, vIdx) => {
                              const valStr = String(val);
                              const isSelected = includeSubjectsInput.includes(valStr);
                              const isDisabled = excludeSubjectsInput.includes(valStr);
                              return (
                                <label key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em', cursor: isDisabled ? 'not-allowed' : 'pointer', backgroundColor: isSelected ? '#324a3e' : '#282828', padding: '2px 6px', borderRadius: '4px', border: isSelected ? '1px solid #8ec07c' : '1px solid #444', opacity: isDisabled ? 0.4 : 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={(e) => {
                                      if (e.target.checked) setIncludeSubjectsInput([...includeSubjectsInput, valStr]);
                                      else setIncludeSubjectsInput(includeSubjectsInput.filter(s => s !== valStr));
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  {valStr}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exclude Subjects */}
                  <div style={{ backgroundColor: '#202020', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: '#fb4934' }}>Exclude Subjects (Disallowlist)</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {categories.map((cat, i) => (
                        <div key={i}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '4px', color: '#aaa', borderBottom: '1px solid #333' }}>{cat.id}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {cat.values.map((val, vIdx) => {
                              const valStr = String(val);
                              const isSelected = excludeSubjectsInput.includes(valStr);
                              const isDisabled = includeSubjectsInput.includes(valStr);
                              return (
                                <label key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em', cursor: isDisabled ? 'not-allowed' : 'pointer', backgroundColor: isSelected ? '#5a2c2c' : '#282828', padding: '2px 6px', borderRadius: '4px', border: isSelected ? '1px solid #fb4934' : '1px solid #444', opacity: isDisabled ? 0.4 : 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={(e) => {
                                      if (e.target.checked) setExcludeSubjectsInput([...excludeSubjectsInput, valStr]);
                                      else setExcludeSubjectsInput(excludeSubjectsInput.filter(s => s !== valStr));
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  {valStr}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '1px' }}>Min Ded</span>
                    <input
                      type="number"
                      min="0"
                      value={minDeductionsInput}
                      onChange={(e) => setMinDeductionsInput(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#282828', color: '#fff', width: '100%', minWidth: '70px' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '1px' }}>Max Ded</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="∞"
                      value={maxDeductionsInput === undefined ? '' : maxDeductionsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') setMaxDeductionsInput(undefined);
                        else setMaxDeductionsInput(Math.max(0, parseInt(val)));
                      }}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#282828', color: '#fff', width: '100%', minWidth: '70px' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}


          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            {/* Search Toggle */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              disabled={interactiveSolved}
              style={{
                padding: '10px 15px',
                backgroundColor: isSearchOpen ? '#504945' : '#32302f',
                color: isSearchOpen ? '#fff' : '#aaa',
                border: '1px solid #504945',
                borderRadius: '5px',
                cursor: interactiveSolved ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                display: 'flex', alignItems: 'center', gap: '8px',
                minWidth: '200px',
                justifyContent: 'center'
              }}
            >
              {isSearchOpen ? 'Hide Search' : 'Find Matching Clues'}
              <span style={{ backgroundColor: '#282828', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em', color: '#aaa' }}>
                {session.getMatchingClueCount({
                  allowedClueTypes: nextClueConstraints,
                  includeSubjects: includeSubjectsInput.length > 0 ? includeSubjectsInput : undefined,
                  excludeSubjects: excludeSubjectsInput.length > 0 ? excludeSubjectsInput : undefined,
                  minDeductions: minDeductionsInput,
                  maxDeductions: maxDeductionsInput
                })}
              </span>
            </button>

            {/* Generate Button */}
            <button
              onClick={() => {
                try {
                  const result = session.getNextClue({
                    allowedClueTypes: nextClueConstraints,
                    includeSubjects: includeSubjectsInput.length > 0 ? includeSubjectsInput : undefined,
                    excludeSubjects: excludeSubjectsInput.length > 0 ? excludeSubjectsInput : undefined,
                    minDeductions: minDeductionsInput,
                    maxDeductions: maxDeductionsInput
                  });

                  if (result.clue) {
                    const newStep = { clue: result.clue } as any;
                    const newProof = [...puzzle.proofChain, newStep];
                    const newClues = [...puzzle.clues, result.clue];
                    setPuzzle({ ...puzzle, clues: newClues, proofChain: newProof });
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
                } catch (e: any) {
                  showAlert("Generation Error", e.message || "An error occurred.");
                }
              }}
              disabled={interactiveSolved || nextClueConstraints.length === 0}
              style={{
                flex: 1,
                padding: '10px 20px',
                backgroundColor: '#8ec07c',
                color: '#282828',
                border: 'none',
                borderRadius: '5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: (interactiveSolved || nextClueConstraints.length === 0) ? 0.5 : 1
              }}
            >
              {interactiveSolved ? 'Session Complete' : 'Generate Next Clue'}
            </button>

            {/* Undo Button */}
            <button
              onClick={() => {
                const result = session.rollbackLastClue();
                if (result.success) {
                  const newProof = puzzle.proofChain.slice(0, -1);
                  const newClues = puzzle.clues.slice(0, -1);
                  setPuzzle({ ...puzzle, clues: newClues, proofChain: newProof });
                  setInteractiveSolved(false);
                  if (newProof.length === 0) {
                    setSelectedStep(-2);
                  } else if (selectedStep >= newProof.length) {
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
                opacity: puzzle.proofChain.length === 0 ? 0.5 : 1
              }}
            >
              Undo Last
            </button>
          </div>

          {/* Search Results Panel */}
          {isSearchOpen && (
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: '#1d2021',
              border: '1px solid #3c3836',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '15px'
            }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#665c54', fontStyle: 'italic' }}>
                  No matching clues found. Try relaxing constraints.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {searchResults.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '15px', padding: '8px',
                      backgroundColor: item.isDirectAnswer ? '#1d2021' : '#282828',
                      borderRadius: '4px',
                      border: item.isDirectAnswer ? '1px dashed #fb4934' : '1px solid #333',
                      opacity: item.isDirectAnswer ? 0.7 : 1
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9em', color: item.isDirectAnswer ? '#fb4934' : '#dbdbdb', lineHeight: '1.4' }}>{renderPlainLanguageClue(item.clue, categories)}</span>
                        {item.isDirectAnswer && <span style={{ fontSize: '0.75em', color: '#cc241d', fontStyle: 'italic' }}>⚠️ Direct Answer</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.75em', color: '#888', minWidth: '60px' }}>
                        <span title="Heuristic Score">Sc: <span style={{ color: '#d79921' }}>{Math.round(item.score)}</span></span>
                        <span title="Visual Updates">Upd: <span style={{ color: '#98971a' }}>{item.updates !== undefined ? item.updates : item.deductions}</span></span>
                        <span title="Projected Completion">%: <span style={{ color: '#8ec07c' }}>{Math.round(item.percentComplete)}%</span></span>
                      </div>
                      <button
                        onClick={() => {
                          try {
                            const result = session?.useClue(item.clue);
                            if (result && session && puzzle) {
                              const newStep = { clue: item.clue } as any;
                              const newProof = [...puzzle.proofChain, newStep];
                              const newClues = [...puzzle.clues, item.clue];
                              setPuzzle({ ...puzzle, clues: newClues, proofChain: newProof });
                              setSelectedStep(newProof.length - 1);
                              if (result.solved) {
                                showAlert("Puzzle Solved!", "The grid is fully solved!");
                                setInteractiveSolved(true);
                              }
                            }
                          } catch (e: any) {
                            showAlert("Cannot Add Clue", e.message || "An error occurred.");
                          }
                        }}
                        disabled={item.isDirectAnswer}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: item.isDirectAnswer ? '#3c3836' : '#689d6a',
                          color: item.isDirectAnswer ? '#7c6f64' : '#282828',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: item.isDirectAnswer ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.8em'
                        }}
                      >
                        {item.isDirectAnswer ? 'Solved' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    {/* Interactive Clue Scrubber */ }
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
                desc = `${v1} (${c.cat1}) is ${c.operator === 0 ? '' : 'NOT '} ${v2} (${c.cat2})`;
              } else if (c.type === 1 || c.type === 'ORDINAL') {
                const v1 = formatClueValue(c.item1Val, c.item1Cat);
                const v2 = formatClueValue(c.item2Val, c.item2Cat);
                let opText = '';
                if (c.operator === 0) opText = 'AFTER';
                else if (c.operator === 1) opText = 'BEFORE';
                else if (c.operator === 2) opText = 'NOT AFTER'; // <=
                else if (c.operator === 3) opText = 'NOT BEFORE'; // >=
                desc = `${v1} (${c.item1Cat}) is ${opText} ${v2} (${c.item2Cat}) in ${c.ordinalCat}`;
              } else if (c.type === 2 || c.type === 'SUPERLATIVE') {
                const v1 = formatClueValue(c.targetVal, c.targetCat);
                let opText = '';
                if (c.operator === 0) opText = 'LOWEST';
                else if (c.operator === 1) opText = 'HIGHEST';
                else if (c.operator === 2) opText = 'NOT LOWEST';
                else if (c.operator === 3) opText = 'NOT HIGHEST';
                desc = `${v1} (${c.targetCat}) is the ${opText} in ${c.ordinalCat} `;
              } else if (c.type === 3 || c.type === 'UNARY') {
                const v1 = formatClueValue(c.targetVal, c.targetCat);
                desc = `${v1} (${c.targetCat}) is ${(c.filter === 0 || c.filter === 'IS_ODD') ? 'ODD' : 'EVEN'} (${c.ordinalCat})`;
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
                const isNot = c.operator === 1; // 1 = NOT_MATCH
                const relation = isNot ? 'is NOT' : 'is';
                // "Revolver (Weapon)'s Rank in Age matches..."
                desc = `The item ${formatOffset(c.offset1)} ${v1} (${c.item1Cat}) in ${c.ordinal1} ${relation} the item ${formatOffset(c.offset2)} ${v2} (${c.item2Cat}) in ${c.ordinal2}`;
              } else if (c.type === 5 || c.type === 'BETWEEN') {
                const t = formatClueValue(c.targetVal, c.targetCat);
                const l = formatClueValue(c.lowerVal, c.lowerCat);
                const h = formatClueValue(c.upperVal, c.upperCat);
                desc = `${t} (${c.targetCat}) is between ${l} (${c.lowerCat}) and ${h} (${c.upperCat}) in ${c.ordinalCat}`;
              } else if (c.type === 6 || c.type === 'ADJACENCY') {
                const v1 = formatClueValue(c.item1Val, c.item1Cat);
                const v2 = formatClueValue(c.item2Val, c.item2Cat);
                desc = `${v1} (${c.item1Cat}) is next to ${v2} (${c.item2Cat}) in ${c.ordinalCat}`;
              } else if (c.type === 7 || c.type === 'OR') {
                const c1Type = (c.clue1 as any).type;
                const c2Type = (c.clue2 as any).type;
                desc = `Either [Type ${c1Type}] OR [Type ${c2Type}]`;
              } else if (c.type === 8 || c.type === 'ARITHMETIC') {
                const v1 = formatClueValue(c.item1Val, c.item1Cat);
                const v2 = formatClueValue(c.item2Val, c.item2Cat);
                const v3 = formatClueValue(c.item3Val, c.item3Cat);
                const v4 = formatClueValue(c.item4Val, c.item4Cat);
                desc = `Diff(${v1} (${c.item1Cat}), ${v2} (${c.item2Cat})) == Diff(${v3} (${c.item3Cat}), ${v4} (${c.item4Cat})) in ${c.ordinalCat}`;
              }
            }



            const isActive = selectedStep === i;
            const isFuture = selectedStep !== -1 && i > selectedStep;
            const isDragging = draggedClueIndex === i;

            return (
              <React.Fragment key={i}>
                <div
                  className="clue-row" // Added for print
                  draggable={isInteractiveMode}
                  onDragStart={(e) => handleClueDragStart(e, i)}
                  onDragOver={handleClueDragOver}
                  onDrop={(e) => handleClueDrop(e, i)}
                  onDragEnd={handleClueDragEnd}
                  onClick={() => setSelectedStep(i)}
                  style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid #333',
                    backgroundColor: isActive ? '#333' : 'transparent',
                    opacity: isDragging ? 0.3 : (isFuture ? 0.3 : 1),
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    color: '#ddd'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Remove/Drag Controls (Interactive Mode Only) */}
                    {isInteractiveMode && (
                      <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                        <div
                          style={{
                            width: '24px',
                            flexShrink: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            cursor: 'grab',
                            color: '#555',
                            fontSize: '1.2em',
                            marginRight: '8px'
                          }}
                          title="Drag to reorder clue"
                        >
                          ⋮⋮
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClueToRemoveIndex(i);
                          }}
                          style={{
                            marginRight: '10px',
                            background: 'transparent',
                            border: 'none',
                            color: '#fb4934',
                            cursor: 'pointer',
                            fontSize: '1em',
                            fontWeight: 'bold',
                            padding: '0 5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove Clue"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <span style={{
                      color: isActive ? '#fff' : '#666',
                      marginRight: '10px',
                      fontWeight: isActive ? 'bold' : 'normal',
                      fontFamily: 'monospace',
                      width: '30px',
                      textAlign: 'right',
                      display: 'inline-block'
                    }}>
                      {i + 1}.
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '1.1em', color: '#fff' }}>
                        {renderPlainLanguageClue(step.clue, categories)}
                      </div>
                      {/* Only show raw description and metadata in Solution View (all steps valid) or if interactive finished? 
                        User asked: "ONLY show that when the solution view is selected"
                        By solution view, they likely mean the "Show Full Solution" mode where selectedStep == -1 (or effectively all shown).
                        However, this function 'renderSolutionStep' is used FOR the solution view list.
                        BUT, this list is visible in both "Play" and "Solution" modes? No.
                        Actually, renderSolutionStep is called ONLY when puzzle exists.
                        Wait, let's distinguish "Solution View" vs "Play View".
                        Play mode: User adds clues interactively. List grows.
                        Solution mode: User clicked "Show Full Solution" (selectedStep = -1).
                        Actually, the user can toggle steps.
                        Let's verify what "Solution View" means.
                        "when the solution view is selected" -> probably when `selectedStep === -1` OR generally when viewing the solution list vs the interactive session panel?
                        NO, the user says "the small text underneath each clue... I want to ONLY show that when the solution view is selected."
                        AND "ONLY when the solution view is selected: The number of deductions... etc".
                        
                        This implies there's a boolean or state for "Solution View".
                        In `App.tsx`, we have `selectedStep`. If `selectedStep === -1`, we usually show the final state.
                        But the user might mean "When we are NOT in interactive mode"?
                        Or maybe they mean the toggle button "Show Full Solution".
                        
                        Let's assume "Solution View" == Interactive Mode is NOT active OR puzzle is fully solved/revealed?
                        Actually, looking at the UI, there isn't a strict "Solution View" variable.
                        But there is `renderSolutionStep` function.
                        Wait, is `renderSolutionStep` ONLY used for the sidebar list? Yes.
                        
                        Let's assume "Solution View" = `!isInteractiveMode`? No, because we can have a generated puzzle without interactive mode.
                        
                        Let's assume "Solution View" is when the user intentionally reveals the solution?
                        Or maybe the user means just the sidebar vs the main area?
                        
                        Re-reading request: "Ok so you know how we have the solution view and the play view?"
                        This likely refers to the "Interactive Session" (Play View) vs the static "Generator" (Solution View) or just the fact that in Interactive Mode we hide the proof chain until added?
                        
                        Actually, `selectedStep` controls what's shown on the grid.
                        
                        Let's look for a prop or state that distinguishes these.
                        Ah, `isInteractiveMode` is a major switch.
                        If `isInteractiveMode` is TRUE, we are "Playing".
                        If `isInteractiveMode` is FALSE, we are likely in "Solution View" (Standard Generator).
                        
                        So:
                        1. If `isInteractiveMode`, HIDE raw desc and HIDE metadata.
                        2. If `!isInteractiveMode`, SHOW raw desc and SHOW metadata.
                        
                        Wait, can we review `isInteractiveMode` again?
                        When we verify: `startSession` sets `isInteractiveMode(true)`.
                        So `!isInteractiveMode` IS the Solution View.
                     */}

                      {/* Only show raw description and metadata in Solution View */}
                      {viewMode === 'solution' && (
                        <>
                          <div className="print-hide" style={{ fontSize: '0.8em', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
                            {desc}
                          </div>
                          <div style={{ marginTop: '5px', display: 'flex', gap: '10px', fontSize: '0.75em' }}>
                            {/* Deductions */}
                            <span style={{
                              color: (c.deductions === 0) ? '#fb4934' : '#fabd2f',
                              fontWeight: 'bold'
                            }}>
                              {((c as any).updates !== undefined ? (c as any).updates : (c.deductions ?? 0))} {((c as any).updates !== undefined ? (c as any).updates : (c.deductions ?? 0)) === 1 ? 'update' : 'updates'}
                            </span>

                            {/* % Complete */}
                            <span style={{ color: '#8ec07c' }}>
                              {Math.round(c.percentComplete ?? 0)}% complete
                            </span>


                            {/* Explanation Toggle */}
                            {((c as any).reasons && (c as any).reasons.length > 0) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedClueIndex(expandedClueIndex === i ? null : i); }}
                                title="Explain Logic"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '1em',
                                  padding: '0 5px',
                                  color: '#83a598',
                                  opacity: 0.8
                                }}
                              >
                                {expandedClueIndex === i ? '▼' : 'ℹ'}
                              </button>
                            )}
                          </div>

                          {/* Explanation List */}
                          {expandedClueIndex === i && (c as any).reasons && (
                            <div style={{
                              marginTop: '5px',
                              padding: '5px 10px',
                              backgroundColor: '#3c3836',
                              borderRadius: '4px',
                              fontSize: '0.75em',
                              color: '#ebdbb2',
                              boxShadow: 'inset 0 0 5px rgba(0,0,0,0.2)'
                            }}>
                              {(c as any).reasons.map((r: any, idx: number) => (
                                <div key={idx} style={{ marginBottom: '4px', borderBottom: idx < (c as any).reasons.length - 1 ? '1px solid #504945' : 'none', paddingBottom: '2px' }}>
                                  <span style={{
                                    color: r.type === 'elimination' ? '#fb4934' :
                                      r.type === 'confirmation' ? '#b8bb26' :
                                        r.type === 'uniqueness' ? '#d3869b' :
                                          r.type === 'transitivity' ? '#fabd2f' : '#83a598',
                                    fontWeight: 'bold',
                                    textTransform: 'capitalize'
                                  }}>
                                    {r.type}:
                                  </span> {r.description}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Redundancy Indicator (Visual styling) */}
                          {c.deductions === 0 && (
                            <div style={{
                              marginTop: '2px',
                              height: '2px',
                              backgroundColor: '#fb4934',
                              width: '100%',
                              opacity: 0.5
                            }} />
                          )}
                        </>
                      )}

                      {/* Target Revealed Marker (Inline) */}
                      {session && session.getTargetSolvedStepIndex() === i && viewMode === 'solution' && (
                        <div className="print-hide" style={{
                          marginTop: '8px',
                          display: 'inline-block',
                          alignSelf: 'flex-start',
                          padding: '4px 8px',
                          backgroundColor: 'rgba(215, 153, 33, 0.15)',
                          border: '1px solid #d79921',
                          borderRadius: '4px',
                          color: '#d79921',
                          fontSize: '0.8em',
                          fontWeight: 'bold',
                          animation: 'fadeIn 0.5s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          Target Fact Revealed
                        </div>
                      )}
                    </div>
                  </div>
                </div>


              </React.Fragment>
            );
          })}

        </div >
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            style={{ padding: '10px 20px', background: 'transparent', color: !canReset ? '#666' : '#aaa', border: '1px solid #555', borderRadius: '4px', cursor: !canReset ? 'not-allowed' : 'pointer' }}>
            Reset All
          </button>
        </div>
      </div >
    );
    );
};

const handleRenameSave = (id: string, newTitle: string) => {
  const newSaves = savedPuzzles.map(s => s.id === id ? { ...s, title: newTitle } : s);
  setSavedPuzzles(newSaves);
  localStorage.setItem('saved_puzzles_list', JSON.stringify(newSaves));
};

const handleShare = () => {
  const shareConfig = {
    categories: categories,
    seed: seedInput,
    targetFact: useSpecificGoal ? {
      c1: categories[targetCat1Idx]?.id,
      c2: categories[targetCat2Idx]?.id,
      val: categories[targetCat1Idx]?.values[targetVal1Idx]
    } : undefined
  };

  const json = JSON.stringify(shareConfig);
  const b64 = btoa(json);
  const url = `${window.location.origin}${window.location.pathname}?share=${b64}`;

  navigator.clipboard.writeText(url).then(() => {
    showAlert("Link Copied!", "Share link copied to clipboard. Send it to a friend!");
  }).catch(() => {
    showAlert("Error", "Failed to copy link.");
  });
};

const renderSteps = () => {
  const items = [];
  // Solution (Step 4)
  if (activeStep >= 4) items.push(renderSolutionStep());

  // Generate (Step 3)
  if (activeStep >= 3) items.push(renderGenerateStep());

  // Goal (Step 2)
  if (activeStep >= 2) items.push(renderGoalStep());

  // Story (Step 1)
  if (activeStep >= 1) items.push(renderStoryStep());

  // Structure (Step 0) - Always visible
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
      isOpen={isTimerResetModalOpen}
      onClose={() => setIsTimerResetModalOpen(false)}
      onConfirm={() => {
        resetTimer();
        setIsTimerResetModalOpen(false);
      }}
      title="Reset Timer"
      message="Are you sure you want to reset the puzzle timer? This will set it back to 00:00."
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
      onRename={handleRenameSave}
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
      message="Are you sure you want to delete this save? This cannot be undone."
      onConfirm={confirmDeleteSave}
      type="confirm"
      confirmText="Delete"
    />



    {/* Clue Removal Confirmation Modal */}
    <Modal
      isOpen={isRemoveModalOpen}
      onClose={() => setClueToRemoveIndex(null)}
      title="Remove Clue?"
      message={`Are you sure you want to remove clue #${(clueToRemoveIndex ?? 0) + 1}? All subsequent deductions will be recalculated.`}
      onConfirm={confirmRemoveClue}
      type="confirm"
      confirmText="Remove"
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

            {/* Timer & Controls */}
            {isTimerActive && (
              <div className="print-hide" style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 100,
                backgroundColor: '#282828',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #504945',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                <div style={{ fontFamily: 'monospace', fontSize: '1.2em', color: '#ebdbb2', fontWeight: 'bold' }}>
                  {formatTime()}
                </div>
                <button
                  onClick={togglePause}
                  title={isPaused ? "Resume" : "Pause"}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fabd2f',
                    cursor: 'pointer',
                    fontSize: '1em'
                  }}
                >
                  {isPaused ? '▶' : '⏸'}
                </button>
                <button
                  onClick={() => setIsTimerResetModalOpen(true)}
                  title="Reset Timer"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fb4934',
                    cursor: 'pointer',
                    fontSize: '1em'
                  }}
                >
                  ↺
                </button>
              </div>
            )}

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
              targetFact={(activeStep >= 1 && useSpecificGoal) ? {
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
              onInteract={(puzzle && activeStep >= 3) ? handleCellInteraction : undefined}
            />
          </div>
        )}
      </div>

      {/* Bottom: Scrollable Accordion Flow (Natural Page Scroll) */}
      <div className="step-container">
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
