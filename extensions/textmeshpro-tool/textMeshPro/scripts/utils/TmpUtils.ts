import { assetManager, Component, warn } from "cc";
import { EDITOR } from "cc/env";

const WORD_REG = /([a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôûа-яА-ЯЁё]+|\S)/;
// eslint-disable-next-line no-useless-escape
const SYMBOL_REG = /^[!,.:;'}\]%\?>、‘“》？。，！]/;
const LAST_WORD_REG = /([a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôûаíìÍÌïÁÀáàÉÈÒÓòóŐőÙÚŰúűñÑæÆœŒÃÂãÔõěščřžýáíéóúůťďňĚŠČŘŽÁÍÉÓÚŤżźśóńłęćąŻŹŚÓŃŁĘĆĄ-яА-ЯЁёáàảạãăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệiíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢẠÃĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆIÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]+|\S)$/;
const LAST_ENGLISH_REG = /[a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôûаíìÍÌïÁÀáàÉÈÒÓòóŐőÙÚŰúűñÑæÆœŒÃÂãÔõěščřžýáíéóúůťďňĚŠČŘŽÁÍÉÓÚŤżźśóńłęćąŻŹŚÓŃŁĘĆĄ-яА-ЯЁёáàảạãăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệiíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢẠÃĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆIÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]+$/;
const FIRST_ENGLISH_REG = /^[a-zA-Z0-9ÄÖÜäöüßéèçàùêâîôûаíìÍÌïÁÀáàÉÈÒÓòóŐőÙÚŰúűñÑæÆœŒÃÂãÔõěščřžýáíéóúůťďňĚŠČŘŽÁÍÉÓÚŤżźśóńłęćąŻŹŚÓŃŁĘĆĄ-яА-ЯЁёáàảạãăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệiíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢẠÃĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆIÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]/;
const WRAP_INSPECTION = true;

// in case truncate a character on the Supplementary Multilingual Plane
// test case: a = '😉🚗'
// _safeSubstring(a, 1) === '😉🚗'
// _safeSubstring(a, 0, 1) === '😉'
// _safeSubstring(a, 0, 2) === '😉'
// _safeSubstring(a, 0, 3) === '😉'
// _safeSubstring(a, 0, 4) === '😉🚗'
// _safeSubstring(a, 1, 2) === _safeSubstring(a, 1, 3) === '😉'
// _safeSubstring(a, 2, 3) === _safeSubstring(a, 2, 4) === '🚗'
function _safeSubstring(targetString, startIndex, endIndex?) {
    let newStartIndex = startIndex;
    let newEndIndex = endIndex;
    const startChar = targetString[startIndex];
    // lowSurrogateRex
    if (startChar >= '\uDC00' && startChar <= '\uDFFF') {
        newStartIndex--;
    }
    if (endIndex !== undefined) {
        if (endIndex - 1 !== startIndex) {
            const endChar = targetString[endIndex - 1];
            // highSurrogateRex
            if (endChar >= '\uD800' && endChar <= '\uDBFF') {
                newEndIndex--;
            }
        } else if (startChar >= '\uD800' && startChar <= '\uDBFF') {
            // highSurrogateRex
            newEndIndex++;
        }
    }
    return targetString.substring(newStartIndex, newEndIndex) as string;
}

export default class TmpUtils {
    /** TextMeshPro组件默认材质路径 */
    public static readonly TMP_MAT: string = "textMeshPro/resources/shader/materials/textMeshPro.mtl";

    /**
     * 编辑器模式下加载资源
     * @param url db://assets/
     */
    public static load<T>(url: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!EDITOR) {
                resolve(null);
                return;
            }
            Editor.Message.request("asset-db", "query-uuid", `db://assets/${url}`).then((uuid) => {
                if (!uuid) {
                    resolve(null);
                    warn(`[EditorTool.load] uuid查询失败 url: ${url}`);
                    return;
                }
                assetManager.loadAny(uuid, (error: any, result: T) => {
                    if (error || !result) {
                        resolve(null);
                        warn(`[EditorTool.load] 资源加载失败 url: ${url}`);
                        return;
                    }
                    resolve(result);
                });
            });
        });
    }

    /**
     * 异步等待 - cc.Component.scheduleOnce
     */
    public static waitCmpt(cmpt: Component, seconds: number): Promise<void> {
        return new Promise((resolve, reject) => {
            cmpt.scheduleOnce(() => {
                resolve();
            }, seconds);
        });
    }

    public static isUnicodeCJK(ch: string) {
        const __CHINESE_REG = /^[\u4E00-\u9FFF\u3400-\u4DFF]+$/;
        const __JAPANESE_REG = /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g;
        const __KOREAN_REG = /^[\u1100-\u11FF]|[\u3130-\u318F]|[\uA960-\uA97F]|[\uAC00-\uD7AF]|[\uD7B0-\uD7FF]+$/;
        return __CHINESE_REG.test(ch) || __JAPANESE_REG.test(ch) || __KOREAN_REG.test(ch);
    }

    // Checking whether the character is a whitespace
    public static isUnicodeSpace(ch: string) {
        const chCode = ch.charCodeAt(0);
        return ((chCode >= 9 && chCode <= 13)
            || chCode === 32
            || chCode === 133
            || chCode === 160
            || chCode === 5760
            || (chCode >= 8192 && chCode <= 8202)
            || chCode === 8232
            || chCode === 8233
            || chCode === 8239
            || chCode === 8287
            || chCode === 12288);
    }

    public static getEnglishWordPartAtFirst(stringToken: string) {
        const result = FIRST_ENGLISH_REG.exec(stringToken);
        return result;
    }

    public static getEnglishWordPartAtLast(stringToken: string) {
        const result = LAST_ENGLISH_REG.exec(stringToken);
        return result;
    }

    public static fragmentText(stringToken: string, allWidth: number, maxWidth: number, measureText: (string: string) => number) {
        // check the first character
        const wrappedWords: string[] = [];
        // fast return if strArr is empty
        if (stringToken.length === 0 || maxWidth < 0) {
            wrappedWords.push('');
            return wrappedWords;
        }

        let text = stringToken;
        while (allWidth > maxWidth && text.length > 1) {
            let fuzzyLen = text.length * (maxWidth / allWidth) | 0;
            let tmpText = _safeSubstring(text, fuzzyLen);
            let width = allWidth - measureText(tmpText);
            let sLine = tmpText;
            let pushNum = 0;

            let checkWhile = 0;
            const checkCount = 100;

            // Exceeded the size
            while (width > maxWidth && checkWhile++ < checkCount) {
                fuzzyLen *= maxWidth / width;
                fuzzyLen |= 0;
                tmpText = _safeSubstring(text, fuzzyLen);
                width = allWidth - measureText(tmpText);
            }

            checkWhile = 0;

            // Find the truncation point
            // if the 'tempText' which is truncated from the next line content equals to '',
            // we should break this loop because there is no available character in the next line.
            while (tmpText && width <= maxWidth && checkWhile++ < checkCount) {
                const exec = WORD_REG.exec(tmpText);
                pushNum = exec ? exec[0].length : 1;
                sLine = tmpText;

                fuzzyLen += pushNum;
                tmpText = _safeSubstring(text, fuzzyLen);
                width = allWidth - measureText(tmpText);
            }

            fuzzyLen -= pushNum;
            // in case maxWidth cannot contain any characters, need at least one character per line
            if (fuzzyLen === 0) {
                fuzzyLen = 1;
                sLine = _safeSubstring(text, 1);
            } else if (fuzzyLen === 1 && text[0] >= '\uD800' && text[0] <= '\uDBFF') {
                // highSurrogateRex
                fuzzyLen = 2;
                sLine = _safeSubstring(text, 2);
            }

            let sText = _safeSubstring(text, 0, fuzzyLen);
            let result;

            // Symbols cannot be the first character in a new line.
            // In condition that a symbol appears at the beginning of the new line, we will move the last word of this line to the new line.
            // If there is only one word in this line, we will keep the first character of this word and move the rest of characters to the new line.
            if (WRAP_INSPECTION) {
                if (SYMBOL_REG.test(sLine || tmpText)) {
                    result = LAST_WORD_REG.exec(sText);
                    fuzzyLen -= result ? result[0].length : 0;
                    if (fuzzyLen === 0) { fuzzyLen = 1; }

                    sLine = _safeSubstring(text, fuzzyLen);
                    sText = _safeSubstring(text, 0, fuzzyLen);
                }
            }

            // To judge whether a English words are truncated
            // If it starts with an English word in the next line and it ends with an English word in this line,
            // we consider that a complete word is truncated into two lines. The last word without symbols of this line will be moved to the next line.
            if (FIRST_ENGLISH_REG.test(sLine)) {
                result = LAST_ENGLISH_REG.exec(sText);
                if (result && (sText !== result[0])) {
                    fuzzyLen -= result[0].length;
                    sLine = _safeSubstring(text, fuzzyLen);
                    sText = _safeSubstring(text, 0, fuzzyLen);
                }
            }

            // The first line And do not wrap should not remove the space
            if (wrappedWords.length === 0) {
                wrappedWords.push(sText);
            } else {
                sText = sText.trim();
                if (sText.length > 0) {
                    wrappedWords.push(sText);
                }
            }
            text = sLine || tmpText;
            allWidth = measureText(text);
        }

        if (wrappedWords.length === 0) {
            wrappedWords.push(text);
        } else {
            text = text.trim();
            if (text.length > 0) {
                wrappedWords.push(text);
            }
        }
        return wrappedWords;
    }
}
