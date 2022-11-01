import { Component, tween, Vec3, _decorator } from "cc";
import TextMeshPro from "./TextMeshPro";
import TmpUtils from "./utils/TmpUtils";

const { ccclass, property } = _decorator;

@ccclass
export default class Example1 extends Component {

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
                let result: Vec3[] = this.text2.getPosVertices(i);
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
        await TmpUtils.waitCmpt(this, 1);
        this.text1.string = "这 是 一 段 测 试 文 字aaagghjsa;dzxmc;";
        this.text1.updateRenderData(true);
        for (let i = 0; i < this.text1.string.length; i++) {
            this.text1.setVisible(i, false);
        }
        for (let i = 0; i < this.text1.string.length; i++) {
            this.text1.setVisible(i, true);
            if (!this.text1.isVisible(i)) {
                continue;
            }
            let result: Vec3[] = this.text1.getPosVertices(i);
            let center = new Vec3();
            center.x = (result[0].x + result[1].x + result[2].x + result[3].x) / 4;
            center.y = (result[0].y + result[1].y + result[2].y + result[3].y) / 4;
            this._xOffset = -30;

            let updateCall = () => {
                let copy: Vec3[] = [];
                copy.push(result[0].clone());
                copy.push(result[1].clone());
                copy.push(result[2].clone());
                copy.push(result[3].clone());
                for (let j = 0; j < 4; j++) {
                    let delta: Vec3 = new Vec3();
                    Vec3.subtract(delta, copy[j], center);
                    delta.multiplyScalar(this._fScale).add(new Vec3(this._xOffset, 0));
                    Vec3.add(copy[j], center, delta);
                }
                this.text1.setPosVertices(i, copy as any);
            }

            tween<Example1>(this)
                .to(0.05, { _fScale: 2, _xOffset: -15 }, { onUpdate: updateCall })
                .to(0.05, { _fScale: 1, _xOffset: 0 }, { onUpdate: updateCall })
                .start();
            await TmpUtils.waitCmpt(this, 0.1);
        }
    }

    private _initPos: Vec3[][] = [];
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
        await TmpUtils.waitCmpt(this, 1);
        this.text3.string = "这 是 一 段 测 试 文 字aaagghjsa;dzxmc;";
        this.text3.updateRenderData(true);
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
            tween<Example1>(this)
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

            await TmpUtils.waitCmpt(this, time);
        }
    }
}
