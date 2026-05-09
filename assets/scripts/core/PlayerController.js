// PlayerController.js — WASD movement + NPC interaction for MainMap scene

cc.Class({
    extends: cc.Component,

    properties: {
        moveSpeed: {
            default: 150,
            type: cc.Float,
            tooltip: 'Pixels per second',
        },
        // Sprite for animation — assign in Inspector
        anim: {
            default: null,
            type: cc.Animation,
        },
    },

    onLoad() {
        this._velocity = cc.v2(0, 0);
        this._facing = 'down';  // 'up' | 'down' | 'left' | 'right'
        this._isMoving = false;
        this._canInteract = false;
        this._nearbyBooth = null;

        // Register interaction key
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
    },

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
    },

    update(dt) {
        this._readInput();
        this._applyMovement(dt);
        this._updateAnimation();
    },

    _readInput() {
        let x = 0;
        let y = 0;

        if (cc.macro.KEY) {
            // Cocos Creator 2.4.8 key polling via cc.macro.KEY
            const keys = cc.macro.KEY;
            if (cc.director.getScene()) {
                // Use stored key state updated in _onKeyDown / KEY_UP
            }
        }

        // Key state tracked manually (most reliable in CC 2.4.8)
        if (this._keys) {
            if (this._keys['w'] || this._keys['up'])    { y =  1; this._facing = 'up'; }
            if (this._keys['s'] || this._keys['down'])  { y = -1; this._facing = 'down'; }
            if (this._keys['a'] || this._keys['left'])  { x = -1; this._facing = 'left'; }
            if (this._keys['d'] || this._keys['right']) { x =  1; this._facing = 'right'; }
        }

        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            x *= 0.707;
            y *= 0.707;
        }

        this._velocity.x = x * this.moveSpeed;
        this._velocity.y = y * this.moveSpeed;
        this._isMoving = (x !== 0 || y !== 0);
    },

    _applyMovement(dt) {
        if (this._isMoving) {
            const newX = this.node.x + this._velocity.x * dt;
            const newY = this.node.y + this._velocity.y * dt;
            this.node.setPosition(newX, newY);
        }
    },

    _updateAnimation() {
        if (!this.anim) return;
        if (this._isMoving) {
            const clipName = `walk_${this._facing}`;
            if (this.anim.currentClip && this.anim.currentClip.name !== clipName) {
                this.anim.play(clipName);
            } else if (!this.anim.currentClip) {
                this.anim.play(clipName);
            }
        } else {
            const clipName = `idle_${this._facing}`;
            if (this.anim.currentClip && this.anim.currentClip.name !== clipName) {
                this.anim.play(clipName);
            } else if (!this.anim.currentClip) {
                this.anim.play(clipName);
            }
        }
    },

    // Called by cc.SystemEvent KEY_DOWN
    _onKeyDown(event) {
        if (!this._keys) this._keys = {};
        const keyMap = {
            [cc.macro.KEY.w]: 'w',       [cc.macro.KEY.up]:    'up',
            [cc.macro.KEY.s]: 's',       [cc.macro.KEY.down]:  'down',
            [cc.macro.KEY.a]: 'a',       [cc.macro.KEY.left]:  'left',
            [cc.macro.KEY.d]: 'd',       [cc.macro.KEY.right]: 'right',
            [cc.macro.KEY.space]: 'space',
            [cc.macro.KEY.e]: 'e',
        };
        const key = keyMap[event.keyCode];
        if (key) this._keys[key] = true;

        // Interact with nearby booth
        if ((key === 'space' || key === 'e') && this._nearbyBooth) {
            this._interact();
        }
    },

    // Must also register KEY_UP to clear keys
    onEnable() {
        if (!this._keys) this._keys = {};
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
    },

    onDisable() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
    },

    _onKeyUp(event) {
        const keyMap = {
            [cc.macro.KEY.w]: 'w',       [cc.macro.KEY.up]:    'up',
            [cc.macro.KEY.s]: 's',       [cc.macro.KEY.down]:  'down',
            [cc.macro.KEY.a]: 'a',       [cc.macro.KEY.left]:  'left',
            [cc.macro.KEY.d]: 'd',       [cc.macro.KEY.right]: 'right',
            [cc.macro.KEY.space]: 'space',
            [cc.macro.KEY.e]: 'e',
        };
        const key = keyMap[event.keyCode];
        if (key) this._keys[key] = false;
    },

    // ─── Booth interaction ────────────────────────────────────────────────────

    setNearbyBooth(boothNode) {
        this._nearbyBooth = boothNode;
        this._canInteract = !!boothNode;
    },

    _interact() {
        if (!this._nearbyBooth) return;
        const booth = this._nearbyBooth.getComponent('BoothTrigger');
        if (booth) {
            booth.onPlayerInteract();
        }
    },
});
