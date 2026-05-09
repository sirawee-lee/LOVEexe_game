// MiniGameBase.js — Abstract base class for all 3 mini-games
// Handles: countdown timer, score tracking, life/HP system, result screen
// Each mini-game extends this and overrides: onGameStart, onGameUpdate, onGameEnd

cc.Class({
    extends: cc.Component,

    properties: {
        // ── Inspector-assignable UI nodes ──────────────────────────────────────
        timerLabel: {
            default: null,
            type: cc.Label,
            tooltip: 'Shows remaining time',
        },
        scoreLabel: {
            default: null,
            type: cc.Label,
        },
        livesContainer: {
            default: null,
            type: cc.Node,
            tooltip: 'Parent node holding life icon nodes',
        },
        resultPanel: {
            default: null,
            type: cc.Node,
            tooltip: 'Shown on win/lose with score summary',
        },
        resultTitleLabel: {
            default: null,
            type: cc.Label,
        },
        resultScoreLabel: {
            default: null,
            type: cc.Label,
        },
        countdownPanel: {
            default: null,
            type: cc.Node,
        },
        countdownLabel: {
            default: null,
            type: cc.Label,
        },

        // ── Game config (override in subclass properties block) ────────────────
        gameDuration: {
            default: 60,
            type: cc.Float,
            tooltip: 'Total time in seconds',
        },
        maxLives: {
            default: 3,
            type: cc.Integer,
        },
        gameKey: {
            default: 'professor',
            tooltip: 'Must match GameManager.miniGameState key',
        },
    },

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    onLoad() {
        this._score = 0;
        this._lives = this.maxLives;
        this._timeLeft = this.gameDuration;
        this._running = false;

        if (this.resultPanel) this.resultPanel.active = false;
        if (this.countdownPanel) this.countdownPanel.active = false;

        this._startCountdown();
    },

    update(dt) {
        if (!this._running) return;

        this._timeLeft -= dt;
        this._updateTimerLabel();

        if (this._timeLeft <= 0) {
            this._timeLeft = 0;
            this._updateTimerLabel();
            this._endGame(true);  // time-up = success path
            return;
        }

        this.onGameUpdate(dt);
    },

    // ─── Countdown before game starts ─────────────────────────────────────────

    _startCountdown() {
        if (!this.countdownPanel) {
            this._beginGame();
            return;
        }
        this.countdownPanel.active = true;
        let count = 3;
        if (this.countdownLabel) this.countdownLabel.string = `${count}`;

        this.schedule(() => {
            count--;
            if (count > 0) {
                if (this.countdownLabel) this.countdownLabel.string = `${count}`;
            } else {
                this.countdownPanel.active = false;
                this._beginGame();
            }
        }, 1, 3);
    },

    _beginGame() {
        this._running = true;
        this.onGameStart();
    },

    // ─── Score API (call from subclass) ──────────────────────────────────────

    addScore(points) {
        this._score += points;
        if (this.scoreLabel) this.scoreLabel.string = `Score: ${this._score}`;
    },

    getScore() {
        return this._score;
    },

    // ─── Lives API ────────────────────────────────────────────────────────────

    loseLife() {
        this._lives = Math.max(0, this._lives - 1);
        this._updateLivesUI();
        if (this._lives <= 0) {
            this._endGame(false);
        }
    },

    _updateLivesUI() {
        if (!this.livesContainer) return;
        const icons = this.livesContainer.children;
        icons.forEach((node, i) => {
            node.active = i < this._lives;
        });
    },

    // ─── Timer UI ─────────────────────────────────────────────────────────────

    _updateTimerLabel() {
        if (!this.timerLabel) return;
        const secs = Math.ceil(this._timeLeft);
        this.timerLabel.string = `${secs}`;
        // Flash red when under 10 seconds
        this.timerLabel.node.color = secs <= 10 ? cc.Color.RED : cc.Color.WHITE;
    },

    // ─── End game ─────────────────────────────────────────────────────────────

    _endGame(won) {
        if (!this._running) return;
        this._running = false;
        this.onGameEnd(won);

        // Notify GameManager
        const gmNode = cc.find('GameManager');
        if (gmNode) {
            const gm = gmNode.getComponent('GameManager');
            if (won) {
                gm.completeMiniGame(this.gameKey, this._score);
                gm.addCoins(Math.floor(this._score / 10));
            }
        }

        this._showResult(won);
    },

    _showResult(won) {
        if (!this.resultPanel) {
            this.scheduleOnce(() => {
                const gmNode = cc.find('GameManager');
                if (gmNode) gmNode.getComponent('GameManager').returnToMap();
            }, 2);
            return;
        }

        this.resultPanel.active = true;
        if (this.resultTitleLabel) {
            this.resultTitleLabel.string = won ? 'SUCCESS!' : 'GAME OVER';
        }
        if (this.resultScoreLabel) {
            this.resultScoreLabel.string = `Score: ${this._score}`;
        }
    },

    // Called by "Return to Map" button in result panel (wire up in Inspector)
    onReturnToMap() {
        const gmNode = cc.find('GameManager');
        if (gmNode) gmNode.getComponent('GameManager').returnToMap();
    },

    // Called by "Retry" button
    onRetry() {
        cc.director.loadScene(cc.director.getScene().name);
    },

    // ─── Abstract methods — override in subclass ──────────────────────────────

    onGameStart() {
        // Override: spawn enemies, reset board, etc.
    },

    onGameUpdate(dt) {
        // Override: per-frame game logic
    },

    onGameEnd(won) {
        // Override: cleanup, stop spawners, etc.
    },
});
