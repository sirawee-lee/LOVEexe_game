// DialogueSystem.js — Data-driven dialogue box, reusable for all NPCs
// Reads dialogue trees from game-data.json via Resources
// Supports: sequential lines, choices (with affinity delta), typewriter effect

cc.Class({
    extends: cc.Component,

    properties: {
        panel: {
            default: null,
            type: cc.Node,
            tooltip: 'Root panel node (hidden when no dialogue)',
        },
        speakerLabel: {
            default: null,
            type: cc.Label,
        },
        bodyLabel: {
            default: null,
            type: cc.Label,
        },
        avatarSprite: {
            default: null,
            type: cc.Sprite,
        },
        choiceContainer: {
            default: null,
            type: cc.Node,
            tooltip: 'Parent node for choice buttons (use Layout component)',
        },
        choiceButtonPrefab: {
            default: null,
            type: cc.Prefab,
            tooltip: 'Prefab with a Button + Label child',
        },
        typewriterSpeed: {
            default: 0.04,
            type: cc.Float,
            tooltip: 'Seconds per character',
        },
    },

    onLoad() {
        this._dialogueData = null;
        this._currentTree = null;
        this._lineIndex = 0;
        this._isTyping = false;
        this._onComplete = null;

        if (this.panel) this.panel.active = false;

        // Load game-data.json from Resources folder
        cc.loader.loadRes('game-data', (err, data) => {
            if (!err) {
                this._dialogueData = data.json || data;
            } else {
                cc.warn('DialogueSystem: could not load game-data.json', err);
            }
        });
    },

    // ─── Public API ───────────────────────────────────────────────────────────

    startDialogue(treeId, onComplete) {
        if (!this._dialogueData) {
            cc.warn('DialogueSystem: data not loaded yet');
            if (onComplete) onComplete();
            return;
        }

        const tree = this._dialogueData.dialogues[treeId];
        if (!tree) {
            cc.warn(`DialogueSystem: tree "${treeId}" not found`);
            if (onComplete) onComplete();
            return;
        }

        this._currentTree = tree;
        this._lineIndex = 0;
        this._onComplete = onComplete || null;

        if (this.panel) this.panel.active = true;
        this._showLine();
    },

    // Advance or skip typewriter on mouse click / space
    advance() {
        if (this._isTyping) {
            this._skipTypewriter();
        } else {
            this._nextLine();
        }
    },

    // ─── Internal ─────────────────────────────────────────────────────────────

    _showLine() {
        this._clearChoices();
        const lines = this._currentTree.lines;
        if (this._lineIndex >= lines.length) {
            this._endDialogue();
            return;
        }

        const line = lines[this._lineIndex];

        if (this.speakerLabel) this.speakerLabel.string = line.speaker || '';
        if (this.avatarSprite && line.avatar) {
            cc.loader.loadRes(`textures/characters/${line.avatar}`, cc.SpriteFrame, (err, sf) => {
                if (!err && this.avatarSprite) this.avatarSprite.spriteFrame = sf;
            });
        }

        // If this line has choices, show them instead of advancing
        if (line.choices && line.choices.length > 0) {
            if (this.bodyLabel) this.bodyLabel.string = line.text || '';
            this._showChoices(line.choices);
        } else {
            this._typewrite(line.text || '');
        }
    },

    _typewrite(text) {
        if (this.bodyLabel) this.bodyLabel.string = '';
        this._isTyping = true;
        this._fullText = text;
        this._charIndex = 0;
        this.unschedule(this._typewriteStep);
        this.schedule(this._typewriteStep, this.typewriterSpeed);
    },

    _typewriteStep() {
        this._charIndex++;
        if (this.bodyLabel) {
            this.bodyLabel.string = this._fullText.substring(0, this._charIndex);
        }
        if (this._charIndex >= this._fullText.length) {
            this._isTyping = false;
            this.unschedule(this._typewriteStep);
        }
    },

    _skipTypewriter() {
        this.unschedule(this._typewriteStep);
        this._isTyping = false;
        if (this.bodyLabel) this.bodyLabel.string = this._fullText || '';
    },

    _nextLine() {
        this._lineIndex++;
        this._showLine();
    },

    _showChoices(choices) {
        if (!this.choiceContainer || !this.choiceButtonPrefab) return;
        this._clearChoices();
        this.choiceContainer.active = true;

        choices.forEach((choice, i) => {
            const btn = cc.instantiate(this.choiceButtonPrefab);
            this.choiceContainer.addChild(btn);

            const label = btn.getComponentInChildren(cc.Label);
            if (label) label.string = choice.text;

            btn.on('click', () => {
                this._onChoiceSelected(choice);
            });
        });
    },

    _onChoiceSelected(choice) {
        this._clearChoices();

        // Record affinity change in GameManager
        const gm = cc.find('GameManager') && cc.find('GameManager').getComponent('GameManager');
        if (gm && choice.affinityDelta !== undefined) {
            gm.recordDialogueChoice(this._currentTree.id, choice.index, choice.affinityDelta);
        }

        // Jump to a different sub-tree or just advance
        if (choice.jumpTo) {
            this.startDialogue(choice.jumpTo, this._onComplete);
        } else {
            this._lineIndex++;
            this._showLine();
        }
    },

    _clearChoices() {
        if (this.choiceContainer) {
            this.choiceContainer.removeAllChildren();
            this.choiceContainer.active = false;
        }
    },

    _endDialogue() {
        if (this.panel) this.panel.active = false;
        this._currentTree = null;
        if (this._onComplete) {
            const cb = this._onComplete;
            this._onComplete = null;
            cb();
        }
    },
});
