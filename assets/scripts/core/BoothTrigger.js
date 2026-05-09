// BoothTrigger.js — Attach to any mini-game booth collider node on the map
// When player enters the trigger area, shows "Press E to play" prompt
// When player interacts, loads the corresponding mini-game scene

cc.Class({
    extends: cc.Component,

    properties: {
        gameKey: {
            default: 'professor',
            type: cc.Enum({ professor: 0, niupai: 1, father: 2 }),
            tooltip: 'Which mini-game does this booth launch?',
        },
        promptLabel: {
            default: null,
            type: cc.Node,
            tooltip: 'Node with a Label showing "Press E to play"',
        },
    },

    onLoad() {
        this._playerInRange = false;
        if (this.promptLabel) {
            this.promptLabel.active = false;
        }

        // Register physics collision callbacks
        const collider = this.node.getComponent(cc.BoxCollider);
        if (collider) {
            cc.director.getCollisionManager().enabled = true;
        }
    },

    onCollisionEnter(other) {
        if (other.node.getComponent('PlayerController')) {
            this._playerInRange = true;
            if (this.promptLabel) this.promptLabel.active = true;
            other.node.getComponent('PlayerController').setNearbyBooth(this.node);
        }
    },

    onCollisionExit(other) {
        if (other.node.getComponent('PlayerController')) {
            this._playerInRange = false;
            if (this.promptLabel) this.promptLabel.active = false;
            other.node.getComponent('PlayerController').setNearbyBooth(null);
        }
    },

    onPlayerInteract() {
        if (!this._playerInRange) return;

        const keyMap = { 0: 'professor', 1: 'niupai', 2: 'father' };
        const key = keyMap[this.gameKey] || 'professor';

        const gm = cc.find('GameManager').getComponent('GameManager');
        if (gm) {
            gm.loadMiniGame(key);
        }
    },
});
