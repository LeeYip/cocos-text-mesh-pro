/**
 * 编辑器工具类
 */
export default class EditorTool {
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
}
