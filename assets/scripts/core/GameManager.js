// GameManager.js — Singleton that persists across all scenes
// Manages: hearts, coins, mini-game completion flags, scene transitions, ending logic

cc.Class({
    extends: cc.Component,

    properties: {
        // Maximum heart fragments needed for true love ending
        maxHearts: {
            default: 3,
            type: cc.Integer,
        },
    },

    statics: {
        instance: null,
    },

    onLoad() {
        // Singleton enforcement
        if (GameManager.instance) {
            this.node.destroy();
            return;
        }
        GameManager.instance = this;
        cc.game.addPersistRootNode(this.node);

        this._initState();
    },

    _initState() {
        this.hearts = 0;          // Heart fragments collected (0–3)
        this.coins = 0;           // Coins earned from mini-games
        this.affinityScore = 0;   // 0–100, determines ending branch

        // Track which mini-games have been completed and their best scores
        this.miniGameState = {
            professor: { completed: false, score: 0, stars: 0 },
            niupai:    { completed: false, score: 0, stars: 0 },
            father:    { completed: false, score: 0, stars: 0 },
        };

        // Dialogue choices that affect affinity
        this.dialogueChoices = [];

        // Easter egg flags
        this.easterEggs = {
            fedNiupai3Times: false,
            neverRomantic: false,
            allPerfectScore: false,
        };
    },

    // ─── Hearts ──────────────────────────────────────────────────────────────

    addHeart() {
        this.hearts = Math.min(this.hearts + 1, this.maxHearts);
        this.emit('hearts-changed', this.hearts);
    },

    getHearts() {
        return this.hearts;
    },

    // ─── Coins ───────────────────────────────────────────────────────────────

    addCoins(amount) {
        this.coins += amount;
        this.emit('coins-changed', this.coins);
    },

    getCoins() {
        return this.coins;
    },

    // ─── Affinity ────────────────────────────────────────────────────────────

    addAffinity(delta) {
        this.affinityScore = Math.max(0, Math.min(100, this.affinityScore + delta));
    },

    // ─── Mini-game completion ─────────────────────────────────────────────────

    completeMiniGame(gameKey, score) {
        const state = this.miniGameState[gameKey];
        if (!state) return;

        state.completed = true;
        if (score > state.score) {
            state.score = score;
        }
        state.stars = this._scoreToStars(score);

        // Award heart fragment on first completion
        if (!state._heartAwarded) {
            state._heartAwarded = true;
            this.addHeart();
            this.addAffinity(15);
        }

        this.emit('minigame-completed', { gameKey, score, stars: state.stars });
    },

    _scoreToStars(score) {
        if (score >= 90) return 3;
        if (score >= 60) return 2;
        if (score >= 30) return 1;
        return 0;
    },

    getMiniGameState(gameKey) {
        return this.miniGameState[gameKey] || null;
    },

    allMiniGamesCompleted() {
        return Object.values(this.miniGameState).every(s => s.completed);
    },

    // ─── Dialogue choice tracking ─────────────────────────────────────────────

    recordDialogueChoice(dialogueId, choiceIndex, affinityDelta) {
        this.dialogueChoices.push({ dialogueId, choiceIndex });
        this.addAffinity(affinityDelta);

        // Easter egg: never made a romantic choice
        if (affinityDelta <= 0) {
            const romanticChoices = this.dialogueChoices.filter(c => c.affinityDelta > 0);
            if (romanticChoices.length === 0) {
                this.easterEggs.neverRomantic = true;
            }
        }
    },

    // ─── Easter egg triggers ──────────────────────────────────────────────────

    triggerEasterEgg(key) {
        if (key in this.easterEggs) {
            this.easterEggs[key] = true;
        }
    },

    // ─── Scene transitions ────────────────────────────────────────────────────

    loadScene(sceneName) {
        cc.director.loadScene(sceneName);
    },

    loadMiniGame(gameKey) {
        const sceneMap = {
            professor: 'MiniGame_Professor',
            niupai:    'MiniGame_NiuPai',
            father:    'MiniGame_Father',
        };
        const scene = sceneMap[gameKey];
        if (scene) {
            this._lastScene = cc.director.getScene().name;
            cc.director.loadScene(scene);
        }
    },

    returnToMap() {
        cc.director.loadScene(this._lastScene || 'MainMap');
    },

    // ─── Ending resolution ────────────────────────────────────────────────────

    resolveEnding() {
        // Easter egg: fed Niu Pai 3 times AND all mini-games done with affinity < 20
        if (this.easterEggs.fedNiupai3Times && this.affinityScore < 20) {
            return 'ending_niupai';
        }
        // Easter egg: never made any romantic dialogue choice
        if (this.easterEggs.neverRomantic && this.allMiniGamesCompleted()) {
            return 'ending_eecs_overload';
        }
        // True love ending
        if (this.hearts >= this.maxHearts && this.affinityScore >= 70) {
            return 'ending_true_love';
        }
        // Friend zone / partial success
        if (this.hearts >= 2 || this.affinityScore >= 40) {
            return 'ending_friend_zone';
        }
        // Rejection
        return 'ending_rejected';
    },

    goToEnding() {
        const endingKey = this.resolveEnding();
        this._pendingEnding = endingKey;
        cc.director.loadScene('Ending');
    },

    getPendingEnding() {
        return this._pendingEnding || 'ending_rejected';
    },

    // ─── Event emitter helpers ────────────────────────────────────────────────

    emit(event, data) {
        cc.systemEvent.emit(event, data);
    },
});

// Shorthand global accessor
const GameManager = cc.Class._isCCClass
    ? module.exports
    : (module.exports = cc.Class.get('GameManager'));
