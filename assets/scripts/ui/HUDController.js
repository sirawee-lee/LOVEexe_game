// HUDController.js — Top-bar HUD showing hearts and coins, auto-updates via events

cc.Class({
    extends: cc.Component,

    properties: {
        heartNodes: {
            default: [],
            type: [cc.Node],
            tooltip: 'Assign 3 heart icon nodes in order',
        },
        heartFullFrame: {
            default: null,
            type: cc.SpriteFrame,
        },
        heartEmptyFrame: {
            default: null,
            type: cc.SpriteFrame,
        },
        coinLabel: {
            default: null,
            type: cc.Label,
        },
    },

    onEnable() {
        cc.systemEvent.on('hearts-changed', this._onHeartsChanged, this);
        cc.systemEvent.on('coins-changed', this._onCoinsChanged, this);
    },

    onDisable() {
        cc.systemEvent.off('hearts-changed', this._onHeartsChanged, this);
        cc.systemEvent.off('coins-changed', this._onCoinsChanged, this);
    },

    start() {
        // Sync with current GameManager state on scene load
        const gmNode = cc.find('GameManager');
        if (!gmNode) return;
        const gm = gmNode.getComponent('GameManager');
        this._onHeartsChanged(gm.getHearts());
        this._onCoinsChanged(gm.getCoins());
    },

    _onHeartsChanged(count) {
        this.heartNodes.forEach((node, i) => {
            const sprite = node.getComponent(cc.Sprite);
            if (!sprite) return;
            sprite.spriteFrame = i < count ? this.heartFullFrame : this.heartEmptyFrame;
        });
    },

    _onCoinsChanged(count) {
        if (this.coinLabel) {
            this.coinLabel.string = `x${count}`;
        }
    },
});
