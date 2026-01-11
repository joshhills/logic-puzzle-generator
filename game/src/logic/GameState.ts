import { IntelDevice } from './IntelDevice';

export interface ClueItem {
    id: string;
    text: string;
    origin: 'device' | 'opponent';
    type: 'real' | 'fake' | 'unknown'; // 'unknown' for traded clues
    timestamp: number;
}

export const Player = {
    User: 'You',
    Opponent: 'Rival'
} as const;

export type PlayerType = typeof Player[keyof typeof Player];

export class GameState {
    public device: IntelDevice;
    public turn: PlayerType;
    public userClues: ClueItem[];
    public opponentClues: ClueItem[];
    public turnCount: number;
    public log: string[];
    public gameOver: boolean = false;
    public targetDescription: string = "";

    constructor() {
        this.device = new IntelDevice();
        this.turn = Player.User;
        this.userClues = [];
        this.opponentClues = [];
        this.turnCount = 1;
        this.log = [];
        this.gameOver = false;
        this.targetDescription = this.device.getTarget();

        // Start with some intel so trading is possible
        this.getIntel('real', Player.User);
        this.getIntel('real', Player.Opponent);
    }

    public nextTurn() {
        this.turn = this.turn === Player.User ? Player.Opponent : Player.User;
        this.turnCount++;

        if (this.turn === Player.Opponent) {
            this.playOpponentTurn();
        }
    }

    public getIntel(type: 'real' | 'fake' | 'smart', forPlayer: PlayerType = this.turn): ClueItem {
        let text = "";
        if (type === 'real') {
            text = this.device.getTrueClue();
        } else if (type === 'smart') {
            text = this.device.getSmartClue();
        } else {
            text = this.device.getFakeClue();
        }

        const item: ClueItem = {
            id: Math.random().toString(36).substr(2, 9),
            text,
            origin: 'device',
            type: type === 'fake' ? 'fake' : 'real',
            timestamp: Date.now()
        };

        if (forPlayer === Player.User) {
            this.userClues.push(item);
            this.logAction(`${Player.User} generated intel.`);
        } else {
            this.opponentClues.push(item);
            this.logAction(`${Player.Opponent} generated intel.`);
        }

        return item;
    }

    public attemptSolve(suspect: string, location: string, item: string): boolean {
        const result = this.device.checkSolution(suspect, location, item);
        if (!result) {
            // FAIL state
            this.gameOver = true;
            this.logAction(`${this.turn} made a WRONG ACCUSATION! Game Over.`);
        } else {
            this.logAction(`${this.turn} solved the case!`);
        }
        return result;
    }

    public tradeClue(actor: PlayerType, offerIndex: number): ClueItem | null {
        const actorHand = actor === Player.User ? this.userClues : this.opponentClues;
        const targetHand = actor === Player.User ? this.opponentClues : this.userClues;
        const targetName = actor === Player.User ? Player.Opponent : Player.User;

        if (targetHand.length === 0) return null;
        if (offerIndex < 0 || offerIndex >= actorHand.length) return null;

        // Take from actor (COPY)
        const given = { ...actorHand[offerIndex] };

        // Validation: Can't trade if we already gave this specific card? 
        // For now, allow re-trading but maybe the UI blocks it.

        // Give to target
        targetHand.push(given);

        // SMART RETURN LOGIC:
        // Filter target hand for valid cards to give back.
        // 1. Must not be the card just given (ID check).
        // 2. Should ideally not be a card the actor already has (Text check).

        let available = targetHand.filter(c => c.id !== given.id);

        // Try to find one the actor doesn't have
        const actorTexts = new Set(actorHand.map(c => c.text));
        const useful = available.filter(c => !actorTexts.has(c.text));

        let chosenRef: ClueItem;

        if (useful.length > 0) {
            // Great! Give a useful card.
            const idx = Math.floor(Math.random() * useful.length);
            chosenRef = useful[idx];
        } else if (available.length > 0) {
            // Only have duplicates? Give one anyway (fairness - must give something).
            const idx = Math.floor(Math.random() * available.length);
            chosenRef = available[idx];
        } else {
            // Opponent literally has NO other cards?
            // (Only happens if they had 0 cards, and we just gave them 1).
            // Then we get our own card back? Or nothing?
            // "Boomerang" is the only option if empty.
            chosenRef = given;
        }

        // Copy it
        const received = { ...chosenRef };

        // Modify received metadata
        const receivedForActor: ClueItem = {
            ...received,
            origin: 'opponent',
            type: 'unknown'
        };

        actorHand.push(receivedForActor);
        this.logAction(`${actor} exchanged info with ${targetName}.`);

        return receivedForActor;
    }

    public plantEvidence(actor: PlayerType = this.turn): ClueItem | null {
        // 1. Generate Fake Intel
        const fakeText = this.device.getFakeClue();
        const fakeClue: ClueItem = {
            id: Math.random().toString(36).substr(2, 9),
            text: fakeText,
            origin: 'device',
            type: 'fake',
            timestamp: Date.now()
        };

        const targetHand = actor === Player.User ? this.opponentClues : this.userClues;
        const actorHand = actor === Player.User ? this.userClues : this.opponentClues;

        // 2. Add Fake to Target (Additive for them)
        targetHand.push(fakeClue);

        // 3. Steal Random from Target (Copy? Or Theft?)
        // User requested "pointless to remove cards from archive".
        // But for gameplay balance, "Hand" is a resource.
        // If we "Steal", we remove from their tradeable hand. History remains in Log.

        if (targetHand.length <= 1) {
            // If they only have the fake we just gave them (or empty before), we get nothing meaningful?
            // targetHand has at least 'fakeClue' now.
            // We shouldn't steal the card we just gave.
        }

        // Filter out the card we just gave (simplistic check by ID)
        const stealable = targetHand.filter(c => c.id !== fakeClue.id);

        if (stealable.length === 0) {
            this.logAction(`${actor} planted evidence but found nothing to steal.`);
            return null;
        }

        const stealIndex = Math.floor(Math.random() * stealable.length);
        const stolenRef = stealable[stealIndex];

        // Remove from target HAND (Resource loss)
        const realIdx = targetHand.indexOf(stolenRef);
        if (realIdx > -1) targetHand.splice(realIdx, 1);

        // Add to actor HAND
        const receivedForActor: ClueItem = {
            ...stolenRef,
            origin: 'opponent',
            type: 'unknown'
        };
        actorHand.push(receivedForActor);

        if (actor === Player.Opponent) {
            // DECEPTION: The player shouldn't know they were planted on.
            this.logAction(`${Player.Opponent} exchanged info with ${Player.User}.`);
        } else {
            // Player knows what they did
            this.logAction(`${Player.User} planted evidence and stole intel from ${Player.Opponent}!`);
        }
        return receivedForActor;
    }

    private logAction(msg: string) {
        this.log.unshift(msg); // Newest first
        if (this.log.length > 10) this.log.pop();
    }

    public getLog(): string[] {
        return this.log;
    }

    private playOpponentTurn() {
        if (this.gameOver) return;

        // AI Logic: Symmetric & Strategic
        setTimeout(() => {
            const rand = Math.random();
            // Strategies:
            // 40% Gather Real Intel (Basic Progress)
            // 30% Plant Evidence (Aggressive)
            // 10% Trade (If they have "Bad" cards? or just chaos) (Wait, random trade is weak)
            // 20% Gather Fake (Defensive Trap)

            // Let's simplify:
            // 60% Gather Real
            // 40% Plant Evidence (Attack)

            if (rand < 0.6) {
                // Gather
                this.getIntel('real', Player.Opponent);
            } else {
                // Plant (Attack)
                // AI needs to generate a fake and push it.
                // Uses the new symmetric method.
                this.plantEvidence(Player.Opponent);
            }

            this.nextTurn();
        }, 2000);
    }
}
