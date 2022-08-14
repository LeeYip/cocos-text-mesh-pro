import { assetManager, warn } from "cc";
import { EDITOR } from "cc/env";

export default class TmpUtils {
    /**
     * 编辑器模式下加载资源
     * @param url db://assets/
     */
    public static load<T>(url: string): Promise<T> {
        // log(url);
        return new Promise<T>((resolve, reject) => {
            if (!EDITOR) {
                resolve(null);
                return;
            }
            //@ts-ignore
            Editor.Message.request("asset-db", "query-uuid", `db://assets/${url}`).then((uuid) => {
                // log(uuid);
                if (!uuid) {
                    resolve(null);
                    warn(`[EditorTool.load] uuid查询失败 url: ${url}`);
                    return;
                }
                assetManager.loadAny(uuid, (error: any, result: T) => {
                    // log(error);
                    // log(result);
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
}
