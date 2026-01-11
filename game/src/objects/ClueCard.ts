import Phaser from 'phaser';
import type { ClueItem } from '../logic/GameState';

export class ClueCard extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Rectangle;
    private text: Phaser.GameObjects.Text;
    private border: Phaser.GameObjects.Rectangle;

    constructor(scene: Phaser.Scene, x: number, y: number, public clue: ClueItem) {
        super(scene, x, y);

        const width = 200;
        const height = 120; // Aspect ratio of a wide card

        // Determine color
        let color = 0xcccccc; // Default Grey
        let strokeColor = 0x000000;

        if (clue.origin === 'opponent') {
            color = 0xffcccc; // Light Red
        } else {
            if (clue.type === 'real') {
                color = 0xccccff; // Light Blue
            } else if (clue.type === 'fake') {
                color = 0xeeeeee; // Grey (Known Fake)
            }
        }

        // Shadow
        const shadow = scene.add.rectangle(4, 4, width, height, 0x000000, 0.3);
        this.add(shadow);

        // Background
        this.bg = scene.add.rectangle(0, 0, width, height, color);
        this.add(this.bg);

        // Border
        this.border = scene.add.rectangle(0, 0, width, height);
        this.border.setStrokeStyle(2, strokeColor);
        this.add(this.border);

        // Text
        this.text = scene.add.text(0, 0, clue.text, {
            fontFamily: 'Courier',
            fontSize: '12px',
            color: '#000000',
            wordWrap: { width: width - 20 }
        }).setOrigin(0.5);
        this.add(this.text);

        // Interactivity
        this.setSize(width, height);
        this.setInteractive();

        scene.add.existing(this);
    }

    public setHighlight(highlight: boolean) {
        if (highlight) {
            this.border.setStrokeStyle(4, 0xffff00);
        } else {
            this.border.setStrokeStyle(2, 0x000000);
        }
    }
}
