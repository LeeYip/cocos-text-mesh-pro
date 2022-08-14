import TextMeshPro from "./TextMeshPro";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Main extends cc.Component {

    @property(TextMeshPro)
    text1: TextMeshPro = null;

    @property(TextMeshPro)
    text2: TextMeshPro = null;

    @property(TextMeshPro)
    text3: TextMeshPro = null;

    protected start(): void {
        this.anim1();
        this.anim3();

        this.scheduleOnce(() => {
            for (let i = 0; i < this.text2.string.length; i++) {
                let result: cc.Vec2[] = this.text2.getPosVertices(i);
                this._initPos.push(result);
            }
        }, 0);
    }

    protected update(dt: number): void {
        this._time += dt;
        this.anim2();
    }

    private _time = 0;
    public _fScale: number = 1;
    public _xOffset: number = 0;
    private async anim1(): Promise<void> {
        await this.waitCmpt(this, 1);
        this.text1.string = "这 是 一 段 测 试 文 字aaagghjsa;dzxmc;";
        this.text1.forceUpdateRenderData();

        this.text2.tmpUniform.outlineColor = cc.color(123, 223, 0);
        for (let i = 0; i < this.text1.string.length; i++) {
            this.text1.setVisible(i, false);
        }
        for (let i = 0; i < this.text1.string.length; i++) {
            this.text1.setVisible(i, true);
            if (!this.text1.isVisible(i)) {
                continue;
            }
            let result: cc.Vec2[] = this.text1.getPosVertices(i);
            let center = cc.v2();
            center.x = (result[0].x + result[1].x + result[2].x + result[3].x) / 4;
            center.y = (result[0].y + result[1].y + result[2].y + result[3].y) / 4;
            this._xOffset = -30;

            let updateCall = () => {
                let copy = [];
                copy.push(result[0].clone());
                copy.push(result[1].clone());
                copy.push(result[2].clone());
                copy.push(result[3].clone());
                for (let j = 0; j < 4; j++) {
                    let delta: cc.Vec2 = copy[j].sub(center);
                    delta.mulSelf(this._fScale).addSelf(cc.v2(this._xOffset, 0));
                    copy[j] = center.add(delta);
                }
                this.text1.setPosVertices(i, copy as any);
            };
            cc.tween<Main>(this)
                .to(0.05, { _fScale: 2, _xOffset: -15 }, { onUpdate: updateCall })
                .to(0.05, { _fScale: 1, _xOffset: 0 }, { onUpdate: updateCall })
                .start();
            await this.waitCmpt(this, 0.1);
        }
    }

    private _initPos: cc.Vec2[][] = [];
    private anim2(): void {
        if (this._initPos.length <= 0) {
            return;
        }
        for (let i = 0; i < this.text2.string.length; i++) {
            if (!this.text2.isVisible(i)) {
                continue;
            }
            let result = [];
            for (let j = 0; j < 4; j++) {
                result.push(this._initPos[i][j].clone());
                result[j].y += Math.sin(0.5 * i + this._time * 5) * 10;
            }
            this.text2.setPosVertices(i, result as any);
        }
    }

    public alpha: number = 0;
    private async anim3(): Promise<void> {
        await this.waitCmpt(this, 1);
        this.text3.string = "这 是 一 段 测 试 文 字aaagghjsa;dzxmc;";
        this.text3.forceUpdateRenderData();
        for (let i = 0; i < this.text3.string.length; i++) {
            this.text3.setVisible(i, false);
        }
        let time = 0.1;
        for (let i = 0; i < this.text3.string.length; i++) {
            this.text3.setVisible(i, true);
            if (!this.text3.isVisible(i)) {
                continue;
            }
            this.text3.setVisible(i, false);
            let result = this.text3.getColorExtraVertices(i);
            this.alpha = 0;
            cc.tween<Main>(this)
                .to(time / 2, { alpha: 255 }, {
                    onUpdate: () => {
                        result[0].a = this.alpha;
                        result[2].a = this.alpha;
                        this.text3.setColorExtraVertices(i, result);
                    }
                })
                .call(() => {
                    this.alpha = 0;
                })
                .to(time / 2, { alpha: 255 }, {
                    onUpdate: () => {
                        result[1].a = this.alpha;
                        result[3].a = this.alpha;
                        this.text3.setColorExtraVertices(i, result);
                    }
                })
                .start();

            await this.waitCmpt(this, time);
        }
    }

    /**
     * 异步等待 - cc.Component.scheduleOnce
     */
    public waitCmpt(cmpt: cc.Component, seconds: number): Promise<void> {
        return new Promise((resolve, reject) => {
            cmpt.scheduleOnce(() => {
                resolve();
            }, seconds);
        });
    }
}
