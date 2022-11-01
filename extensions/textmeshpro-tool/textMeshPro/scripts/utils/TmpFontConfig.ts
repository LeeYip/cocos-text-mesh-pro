import { js, Texture2D } from "cc";

/**
 * 字体配置JSON
 */
export interface TmpFontJson {
    size: number;
    bold: number;
    italic: number;
    padding: [number, number, number, number];
    spacing: [number, number];
    outline: number;
    lineHeight: number;
    base: number;
    scaleW: number;
    scaleH: number;
    pages: number;
    packed: number;
    alphaChnl: number;
    redChnl: number;
    greenChnl: number;
    blueChnl: number;
    pageData: Array<{ id: number, file: string }>;
    charData: Array<any>;
}

/**
 * BitmapFont字符数据
 */
export class TmpFontLetter {
    public u: number = 0;
    public v: number = 0;
    public w: number = 0;
    public h: number = 0;
    public offsetX: number = 0;
    public offsetY: number = 0;
    public textureId: number = 0;
    public valid: boolean = false;
    public xAdvance: number = 0;
}

/**
 * BitmapFont配置管理类
 */
export default class TmpFontConfig {
    private _letterDefinitions: { [id: number]: TmpFontLetter } = {};
    private _textures: { [id: number]: Texture2D } = {};
    private _json: TmpFontJson = null;
    public get json(): TmpFontJson { return this._json; }

    public constructor(json: any, textures: Texture2D[]) {
        this._json = json;
        textures.forEach((v, id) => {
            this._textures[id] = v;
        });

        json.charData.forEach((v) => {
            let letter = new TmpFontLetter();

            letter.offsetX = v.xoffset;
            letter.offsetY = v.yoffset;
            letter.w = v.width;
            letter.h = v.height;
            letter.u = v.x;
            letter.v = v.y;
            letter.textureId = v.page;
            letter.valid = true;
            letter.xAdvance = v.xadvance;

            this.addLetterDefinitions(v.id, letter);
        });
    }

    public addTexture(id: number, texture: Texture2D): void {
        this._textures[id] = texture;
    }

    public addLetterDefinitions(letter: number, letterDefinition: TmpFontLetter): void {
        this._letterDefinitions[letter] = letterDefinition;
    }

    public cloneLetterDefinition(): { [id: number]: TmpFontLetter } {
        let copyLetterDefinitions = {};
        for (let key in this._letterDefinitions) {
            let value = new TmpFontLetter();
            js.mixin(value, this._letterDefinitions[key]);
            copyLetterDefinitions[key] = value;
        }
        return copyLetterDefinitions;
    }

    public getTexture(id: number): Texture2D {
        return this._textures[id];
    }

    public getLetter(key: string): TmpFontLetter {
        return this._letterDefinitions[key];
    }

    public getLetterDefinitionForChar(char: string): TmpFontLetter {
        let key = char.charCodeAt(0);
        let hasKey = this._letterDefinitions.hasOwnProperty(key);
        let letter;
        if (hasKey) {
            letter = this._letterDefinitions[key];
        } else {
            letter = null;
        }
        return letter;
    }

    public clear(): void {
        this._letterDefinitions = {};
    }
}
