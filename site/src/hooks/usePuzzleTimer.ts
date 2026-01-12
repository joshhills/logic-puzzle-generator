import { useState, useEffect, useRef } from 'react';

export const usePuzzleTimer = (isActive: boolean) => {
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Persist to localStorage
    useEffect(() => {
        const saved = localStorage.getItem('puzzleTimer');
        if (saved) {
            setSeconds(parseInt(saved, 10));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('puzzleTimer', seconds.toString());
    }, [seconds]);

    useEffect(() => {
        let interval: any = null;
        if (isActive && !isPaused) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        } else if (!isActive && seconds !== 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive, isPaused]);

    const resetTimer = () => {
        setSeconds(0);
        setIsPaused(false);
        localStorage.setItem('puzzleTimer', '0');
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    const formatTime = () => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return { seconds, isPaused, resetTimer, togglePause, formatTime, setSeconds };
};
