import { _decorator, Component, Node, log, Texture2D, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Test')
export class Test extends Component {
    @property
    public aaa: boolean = false;

    @property({ type: Vec2, visible() { return this.aaa; } })
    public bbb: Vec2[] = [];

    @property({ type: Texture2D, visible() { return this.aaa; } })
    public ccc: Texture2D[] = [];

    resetInEditor() {
        log("reset");
    }
}

