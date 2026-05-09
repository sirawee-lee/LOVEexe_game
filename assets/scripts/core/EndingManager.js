// EndingManager.js — Reads ending config from game-data.json and drives the Ending scene
// Attach to a node in the "Ending" scene

cc.Class({
    extends: cc.Component,

    properties: {
        endingTitleLabel: {
            default: null,
            type: cc.Label,
        },
        endingBodyLabel: {
            default: null,
            type: cc.Label,
        },
        endingImage: {
            default: null,
            type: cc.Sprite,
        },
        // Each ending can have multiple slides; use Next button to advance
        nextButton: {
            default: null,
            type: cc.Node,
        },
        creditsNode: {
            default: null,
            type: cc.Node,
            tooltip: 'Rolling credits node — shown after true love ending',
        },
    },

    onLoad() {
        this._slides = [];
        this._slideIndex = 0;

        cc.loader.loadRes('game-data', (err, data) => {
            if (err) {
                cc.warn('EndingManager: failed to load game-data.json', err);
                return;
            }
            this._endingData = (data.json || data).endings;
            this._init();
        });
    },

    _init() {
        const gmNode = cc.find('GameManager');
        if (!gmNode) return;
        const gm = gmNode.getComponent('GameManager');
        const key = gm.getPendingEnding();

        const config = this._endingData[key];
        if (!config) {
            cc.warn(`EndingManager: no config for ending "${key}"`);
            return;
        }

        this._slides = config.slides || [];
        this._slideIndex = 0;

        // Show credits roll for true love ending
        if (this.creditsNode) {
            this.creditsNode.active = (key === 'ending_true_love');
        }

        this._showSlide();
    },

    _showSlide() {
        if (this._slideIndex >= this._slides.length) {
            this._finish();
            return;
        }

        const slide = this._slides[this._slideIndex];

        if (this.endingTitleLabel) {
            this.endingTitleLabel.string = slide.title || '';
        }
        if (this.endingBodyLabel) {
            this.endingBodyLabel.string = slide.body || '';
        }
        if (this.endingImage && slide.image) {
            cc.loader.loadRes(`textures/endings/${slide.image}`, cc.SpriteFrame, (err, sf) => {
                if (!err && this.endingImage) this.endingImage.spriteFrame = sf;
            });
        }

        // Auto-advance for last slide after 3s if no next button
        if (!this.nextButton && this._slideIndex === this._slides.length - 1) {
            this.scheduleOnce(() => this._finish(), 4);
        }
    },

    // Wired to "Next" button in Inspector
    onNext() {
        this._slideIndex++;
        this._showSlide();
    },

    _finish() {
        // Return to title screen
        cc.director.loadScene('Title');
    },
});
