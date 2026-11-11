import type { LegacyResponse } from '@/utils/legacy-request';
import { LEGACY_BASE_URL, getSessionId } from '@/utils/legacy-request';

/**
 * 老系统文件上传接口：
 * - UPLOAD_PATH：注意必须带 aisports-web 前缀（实测 /upload/storeFile 直接 404，
 *   /aisports-web/upload/storeFile 才会进到应用里）
 * - UPLOAD_FIELD_NAME：后端接收文件的字段名（file / multipartFile / upload ...）
 */
export const UPLOAD_PATH = '/aisports-web/upload/storeFile';
export const UPLOAD_FIELD_NAME = 'file';

export interface UploadOptions {
  /** 上传进度，0 ~ 100 的整数 */
  onProgress?: (percent: number) => void;
  /** 取消上传 */
  signal?: AbortSignal;
}

export interface UploadResult extends LegacyResponse {
  /** 后端若直接返回地址，按常见字段名兼容一下 */
  url?: string;
  path?: string;
  fileName?: string;
}

/**
 * 这里刻意不用 axios：
 * main.ts 无条件引入了 src/mock（mockjs），它把 window.XMLHttpRequest 换成了
 * MockXMLHttpRequest，而它的 upload 是个空对象（mock.js:8352 `upload: {}`）。
 * axios 只要设置 onUploadProgress，就会执行 request.upload.addEventListener(...)
 * （axios/lib/adapters/xhr.js:166），于是抛 "upload.addEventListener is not a function"，
 * xhr.send() 根本没执行，表现就是"没发起请求"。生产环境同样会命中。
 * mockjs 把原生构造器备份在 window._XMLHttpRequest（mock.js:8146），这里取回来用。
 */
function getNativeXHR(): typeof XMLHttpRequest {
  const backup = (window as unknown as { _XMLHttpRequest?: typeof XMLHttpRequest })._XMLHttpRequest;
  return backup || window.XMLHttpRequest;
}

const parseBody = (xhr: XMLHttpRequest): UploadResult | string => {
  const { responseText } = xhr;
  if (!responseText) return '';
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
};

export function uploadFile(file: File, options: UploadOptions = {}) {
  const sessionId = getSessionId();
  const form = new FormData();
  form.append(UPLOAD_FIELD_NAME, file, file.name);
  // 与 legacy 拦截器保持一致：body 里也带一份
  form.append('isAjax', 'true');
  form.append('sessionId', sessionId);

  const query = new URLSearchParams({ isAjax: 'true', sessionId });
  const url = `${LEGACY_BASE_URL}${UPLOAD_PATH}?${query.toString()}`;

  return new Promise<UploadResult>((resolve, reject) => {
    const NativeXHR = getNativeXHR();
    const xhr = new NativeXHR();

    xhr.open('POST', url, true);
    xhr.withCredentials = false;
    // jQuery 默认带、axios 不带；跨域请求会因此触发预检，需要后端放行该头
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    xhr.upload.addEventListener('progress', event => {
      // event.total 个别浏览器可能为空，用文件自身大小兜底
      const total = event.total || file.size;
      if (!total) return;
      options.onProgress?.(Math.round((event.loaded / total) * 100));
    });

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`上传失败（HTTP ${xhr.status}）`));
        return;
      }

      const body = parseBody(xhr);
      // 未登录时后端会 302 到登录页，XHR 跟随后拿到的是 HTML
      if (typeof body === 'string') {
        reject(new Error('接口未返回 JSON，可能是 sessionId 失效被重定向到了登录页'));
        return;
      }

      if (body && typeof body === 'object' && 'error' in body && Number(body.error) !== 0) {
        const error = new Error(body.message || '上传失败') as Error & { data?: UploadResult };
        error.data = body;
        reject(error);
        return;
      }

      resolve(body);
    };

    xhr.onerror = () => reject(new Error('网络异常，上传失败'));
    xhr.ontimeout = () => reject(new Error('上传超时'));
    // 取消时不弹错误提示，由调用方根据 signal.aborted 决定
    xhr.onabort = () => reject(new Error('已取消上传'));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(form);
  });
}
