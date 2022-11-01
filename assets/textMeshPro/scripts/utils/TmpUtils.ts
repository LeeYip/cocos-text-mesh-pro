export default class TmpUtils {
    /** TextMeshPro组件默认材质路径 */
    public static readonly TMP_MAT: string = "textMeshPro/resources/shader/materials/textMeshPro.mtl";

    /**
     * 编辑器模式下加载资源
     * @param url db://assets/
     */
    public static load<T>(url: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!CC_EDITOR) {
                resolve(null);
                return;
            }
            Editor.assetdb.queryUuidByUrl(`db://assets/${url}`, (error: any, uuid: string) => {
                if (error || !uuid) {
                    resolve(null);
                    cc.warn(`[EditorTool.load] uuid查询失败 url: ${url}`);
                    return;
                }
                //@ts-ignore
                cc.resources.load({ type: "uuid", uuid: uuid }, (error: any, result: T) => {
                    if (error || !result) {
                        resolve(null);
                        cc.warn(`[EditorTool.load] 资源加载失败 url: ${url}`);
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
    public static waitCmpt(cmpt: cc.Component, seconds: number): Promise<void> {
        return new Promise((resolve, reject) => {
            cmpt.scheduleOnce(() => {
                resolve();
            }, seconds);
        });
    }
}
