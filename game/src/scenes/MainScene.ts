import Phaser from 'phaser';
import { GameState, Player } from '../logic/GameState';
import { ClueCard } from '../objects/ClueCard';

export class MainScene extends Phaser.Scene {
    private gameState: GameState;
    private statusText!: Phaser.GameObjects.Text;
    private logText!: Phaser.GameObjects.Text;
    private cardContainer!: Phaser.GameObjects.Container;
    private selectedCardIndex: number = -1;
    private cards: ClueCard[] = [];
    private currentPage: number = 0;
    private cardsPerPage: number = 4;

    // Selections
    private selectedSuspect: string | null = null;
    private selectedLocation: string | null = null;
    private selectedItem: string | null = null;
    private dossierItems: Map<string, Phaser.GameObjects.Text> = new Map();

    // Trade Mode
    private isTrading: boolean = false;
    private tradeButtonText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'MainScene' });
        this.gameState = new GameState();
    }

    create() {
        const { width, height } = this.scale;

        // Background (Dark Noir)
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x1a1a1a, 0x1a1a1a, 0x000000, 0x000000, 1);
        graphics.fillRect(0, 0, width, height);

        // Table Area
        graphics.fillStyle(0x3e2723, 1);
        graphics.fillCircle(width / 2, height + 400, 600);

        // Header
        this.add.text(20, 20, 'Noir Detective', {
            fontFamily: 'Courier',
            fontSize: '32px',
            color: '#aaaaaa'
        });

        // Status text
        this.statusText = this.add.text(width - 20, 20, `Turn: ${this.gameState.turn}`, {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(1, 0);

        // Action Log (Left Side)
        this.add.text(20, 80, 'Investigation Log:', { fontSize: '18px', color: '#888' });
        this.logText = this.add.text(20, 110, '', {
            fontFamily: 'Courier',
            fontSize: '14px',
            color: '#00ff00',
            wordWrap: { width: 300 }
        });

        // Dossier / Info Panel (Center/Right mid)
        // Dynamic from Generator
        // Dossier / Info Panel (Center/Right mid)
        // Dynamic & Interactive
        const categories = this.gameState.device.getCategories();
        let startY = 100;
        const startX = width / 2 - 100;

        this.add.text(startX, startY, '[ DOSSIER ]', { fontSize: '18px', color: '#ffff00' });
        startY += 30;

        categories.forEach(cat => {
            this.add.text(startX, startY, `${cat.id}s:`, { fontSize: '14px', color: '#888' });
            startY += 20;

            cat.values.forEach(val => {
                const labelStr = ` - ${val}`;
                const textObj = this.add.text(startX, startY, labelStr, {
                    fontFamily: 'Courier',
                    fontSize: '14px',
                    color: '#aaaaaa'
                })
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.handleDossierSelect(cat.id, String(val)));

                this.dossierItems.set(`${cat.id}:${val}`, textObj);
                startY += 18;
            });
            startY += 10;
        });

        // Target (Below Dossier)
        this.add.text(startX, startY + 10, `TARGET: ${this.gameState.targetDescription}`, {
            fontFamily: 'Courier', fontSize: '12px', color: '#ffff00',
            wordWrap: { width: 400 }
        });

        // Card Container (Bottom)
        this.cardContainer = this.add.container(0, height - 250);
        this.add.existing(this.cardContainer);

        // Buttons (Right Side)
        const btnX = width - 120;
        this.createButton(btnX, 100, 'Ask Real Intel', () => this.handleAction('real'));
        this.createButton(btnX, 170, 'Plant Evidence', () => this.handlePlant());

        // Trade Button (Dynamic)
        this.createButton(btnX, 240, 'Trade Intel', () => this.toggleTradeMode(), (textObj) => {
            this.tradeButtonText = textObj;
        });

        this.createButton(btnX, 310, 'Solve Puzzle', () => this.handleSolve());

        // Game Loop Update
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => this.updateUI()
        });

        this.updateCards();
    }

    private createButton(x: number, y: number, label: string, onClick: () => void, onTextCreate?: (text: Phaser.GameObjects.Text) => void) {
        const bg = this.add.rectangle(x, y, 200, 50, 0x444444)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', onClick)
            .on('pointerover', () => bg.setFillStyle(0x666666))
            .on('pointerout', () => bg.setFillStyle(0x444444));

        const text = this.add.text(x, y, label, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
        if (onTextCreate) onTextCreate(text);
    }

    private handleAction(type: 'real') {
        if (this.gameState.turn !== Player.User || this.gameState.gameOver) return;

        this.gameState.getIntel(type);
        this.gameState.nextTurn();
        this.updateCards();
        this.updateUI();
    }

    private handlePlant() {
        if (this.gameState.turn !== Player.User || this.gameState.gameOver) return;

        this.gameState.plantEvidence();
        this.gameState.nextTurn();
        this.updateCards();
        this.updateUI();
    }

    private toggleTradeMode() {
        if (this.gameState.turn !== Player.User || this.gameState.gameOver) return;

        this.isTrading = !this.isTrading;

        if (this.isTrading) {
            this.tradeButtonText.setText("[ Cancel Trade ]");
            this.logText.setText(this.logText.text + "\n> Select a card to trade...");
        } else {
            this.tradeButtonText.setText("Trade Intel");
        }

        this.updateCards();
    }

    private performTrade(cardIndex: number) {
        if (!this.isTrading) return;

        const result = this.gameState.tradeClue(Player.User, cardIndex);
        if (result) {
            // Trade successful
            this.isTrading = false;
            this.tradeButtonText.setText("Trade Intel");
            this.gameState.nextTurn();
            this.updateCards();
            this.updateUI();
        } else {
            alert("Trade failed! (Opponent has no clues?)");
            this.toggleTradeMode(); // Reset
        }
    }

    private handleSolve() {
        if (this.gameState.turn !== Player.User || this.gameState.gameOver) return;

        if (!this.selectedSuspect || !this.selectedLocation || !this.selectedItem) {
            alert("Selections Incomplete! Select 1 Suspect, 1 Location, and 1 Item from the Dossier.");
            return;
        }

        const confirm = window.confirm(`ACCUSE: ${this.selectedSuspect} in ${this.selectedLocation} with ${this.selectedItem}?`);
        if (confirm) {
            this.gameState.attemptSolve(this.selectedSuspect, this.selectedLocation, this.selectedItem);
            this.updateUI();
        }
    }

    private changePage(delta: number) {
        const maxPage = Math.ceil(this.gameState.userClues.length / this.cardsPerPage) - 1;
        this.currentPage += delta;

        if (this.currentPage < 0) this.currentPage = 0;
        if (this.currentPage > maxPage) this.currentPage = maxPage;

        this.updateCards();
    }

    private updateCards() {
        // Clear existing cards
        this.cardContainer.removeAll(true);
        this.cards = [];

        const startX = 120;
        const gap = 220;

        // Paginate logic
        if (this.gameState.userClues.length > 0) {
            const maxPage = Math.max(0, Math.ceil(this.gameState.userClues.length / this.cardsPerPage) - 1);
            if (this.currentPage > maxPage) this.currentPage = maxPage;
        } else {
            this.currentPage = 0;
        }

        const startIndex = this.currentPage * this.cardsPerPage;
        const endIndex = startIndex + this.cardsPerPage;
        const pageClues = this.gameState.userClues.slice(startIndex, endIndex);

        pageClues.forEach((clue, i) => {
            const globalIndex = startIndex + i;
            const card = new ClueCard(this, startX + (i * gap), 100, clue);

            // Trade Logic Eligibility
            // If trading: 
            // - Cannot trade cards from 'opponent'.
            // - (Optional) Cannot trade cards we already traded? (Not tracked yet).
            let isEligible = true;
            if (this.isTrading) {
                if (clue.origin === 'opponent') isEligible = false;
            }

            if (this.isTrading && !isEligible) {
                card.setAlpha(0.5); // Grey out
            }

            // Interactive
            card.setInteractive();
            card.on('pointerdown', () => {
                if (this.isTrading) {
                    if (isEligible) {
                        this.performTrade(globalIndex);
                    } else {
                        // Feedback for invalid
                        this.tweens.add({
                            targets: card,
                            x: card.x + 10,
                            duration: 50,
                            yoyo: true,
                            repeat: 3
                        });
                    }
                } else {
                    this.selectedCardIndex = globalIndex;
                    this.highlightCard(globalIndex);
                }
            });

            this.cardContainer.add(card);
            this.cards.push(card);
        });

        // Restore highlight
        this.highlightCard(this.selectedCardIndex);

        // Draw Pagination Controls if needed
        if (this.gameState.userClues.length > this.cardsPerPage) {
            const leftArrow = this.add.text(20, 100, '<', { fontSize: '32px', color: '#fff' })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.changePage(-1));

            const rightArrow = this.add.text(startX + (this.cardsPerPage * gap), 100, '>', { fontSize: '32px', color: '#fff' })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.changePage(1));

            const pageInd = this.add.text(startX + ((this.cardsPerPage * gap) / 2) - 50, 200,
                `Page ${this.currentPage + 1}/${Math.ceil(this.gameState.userClues.length / this.cardsPerPage)}`,
                { fontSize: '16px', color: '#aaa' });

            this.cardContainer.add([leftArrow, rightArrow, pageInd]);
        }
    }

    private highlightCard(globalIndex: number) {
        // Find if this card is currently visible
        const startIndex = this.currentPage * this.cardsPerPage;
        const endIndex = startIndex + this.cardsPerPage;

        if (globalIndex >= startIndex && globalIndex < endIndex) {
            // It is on this page
            const localIndex = globalIndex - startIndex;
            if (this.cards[localIndex]) {
                this.cards.forEach(c => c.setHighlight(false));
                this.cards[localIndex].setHighlight(true);
            }
        } else {
            // Not visible
            this.cards.forEach(c => c.setHighlight(false));
        }
    }

    private handleDossierSelect(category: string, value: string) {
        if (category === 'Suspect') this.selectedSuspect = value;
        if (category === 'Location') this.selectedLocation = value;
        if (category === 'Item') this.selectedItem = value;
        this.updateDossierHighlight();
    }

    private updateDossierHighlight() {
        this.dossierItems.forEach((textObj, key) => {
            const [cat, val] = key.split(':');
            let isSelected = false;

            if (cat === 'Suspect' && this.selectedSuspect === val) isSelected = true;
            if (cat === 'Location' && this.selectedLocation === val) isSelected = true;
            if (cat === 'Item' && this.selectedItem === val) isSelected = true;

            textObj.setColor(isSelected ? '#00ff00' : '#aaaaaa');
            textObj.setStyle({ fontWeight: isSelected ? 'bold' : 'normal' });
        });
    }

    private updateUI() {
        this.statusText.setText(`Turn: ${this.gameState.turn}`);

        // Update Log
        const logs = this.gameState.getLog();
        this.logText.setText(logs.join('\n'));

        if (this.gameState.gameOver) {
            this.statusText.setText("GAME OVER");
            this.statusText.setColor('#ff0000');
        } else if (this.gameState.turn !== Player.User) {
            // Opponent active... logic handled in GameState
        }

        // Auto-refresh cards not needed for now as we act on events
    }
}
