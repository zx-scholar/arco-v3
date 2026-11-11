import axios from 'axios';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import { Message } from '@arco-design/web-vue';
import queryString from 'query-string';
import type { StringifyOptions } from 'query-string';
import { isObject } from '@/utils/is';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 是否注入老系统约定参数 isAjax / sessionId，默认 true */
    legacyExtra?: boolean;
  }
}

/**
 * 老系统（aisports-web）统一响应体：error === 0 表示成功，
 * 业务数据字段各接口不统一（list / data / rows ...），因此这里不拆包
 */
export interface LegacyResponse<T = unknown> {
  error: number;
  message: string;
  list?: T[];
  [key: string]: any;
}

const SESSION_ID_KEY = 'legacy_session_id';

/**
 * sessionId 取值优先级：URL query > localStorage > 老页面隐藏域 #sessionId
 * 新系统里没有隐藏域，登录后需调用 setSessionId 写入
 */
export function getSessionId(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('sessionId');
  if (fromQuery) return fromQuery;

  const cached = localStorage.getItem(SESSION_ID_KEY);
  if (cached) return cached;

  const input = document.getElementById('sessionId') as HTMLInputElement | null;
  return input?.value || '';
}

export function setSessionId(sessionId: string) {
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_ID_KEY);
}

/**
 * 表单序列化，与 $.param 对齐：
 * - 数组走 a=1&a=2（arrayFormat: 'none' 即重复拼接），后端要 a[]=1 就改成 'bracket'
 * - 嵌套对象走 a[b]=1、数字/空串保留、null / undefined 丢弃
 * - 空格编码成 +（query-string 默认是 %20，这里换成 jQuery 的写法）
 */
const STRINGIFY_OPTIONS: StringifyOptions = {
  arrayFormat: 'none',
  skipNull: true,
  sort: false
};

/**
 * query-string 不支持嵌套对象和 Date（会输出 [object Object] / 本地时间字符串），
 * 先展平成 a[b]=1 并对 Date 取 ISO，保持与原 qs 实现一致
 */
function flattenParams(
  params: Record<string, any>,
  prefix = '',
  target: Record<string, any> = {}
): Record<string, any> {
  Object.keys(params).forEach(key => {
    const value = params[key];
    const field = prefix ? `${prefix}[${key}]` : key;

    if (value === undefined || value === null) return;

    if (value instanceof Date) {
      target[field] = value.toISOString();
      return;
    }

    if (Array.isArray(value)) {
      const items = value.filter(item => item !== undefined && item !== null);
      if (items.every(item => !isObject(item) && !(item instanceof Date))) {
        // 基本类型数组交给 query-string 按 a=1&a=2 重复拼接
        target[field] = items;
        return;
      }
      items.forEach((item, index) => {
        if (item instanceof Date) target[`${field}[${index}]`] = item.toISOString();
        else flattenParams(item, `${field}[${index}]`, target);
      });
      return;
    }

    if (isObject(value)) {
      flattenParams(value, field, target);
      return;
    }

    target[field] = value;
  });

  return target;
}

const serialize = (params: Record<string, any>): string =>
  queryString.stringify(flattenParams(params), STRINGIFY_OPTIONS).replace(/%20/g, '+');

/** 无请求体的方法，约定参数只能走 query */
const BODYLESS_METHODS = ['get', 'head', 'delete'];

/** 老系统接口基地址：开发走 vite 代理（老系统未开 CORS），生产用 .env 配置，为空则同源 */
export const LEGACY_BASE_URL = import.meta.env.DEV
  ? '/legacy-api'
  : import.meta.env.VITE_LEGACY_BASE_URL || '';

const legacyHttp = axios.create({
  baseURL: LEGACY_BASE_URL,
  timeout: 60000,
  // sessionId 走参数传递，不依赖 Cookie；
  // 若后端改为依赖 Cookie，这里要给 true，且后端需放行 Cookie 与预检请求
  withCredentials: false
});

// jQuery 默认带、axios 不带；跨域请求会因此触发预检，需要后端放行该头
legacyHttp.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// 请求拦截器：注入 isAjax / sessionId（等价 $.ajaxSetup 做的事）
legacyHttp.interceptors.request.use(config => {
  if (config.legacyExtra === false) return config;

  const extra = {
    isAjax: 'true',
    sessionId: getSessionId()
  };

  const method = (config.method || 'get').toLowerCase();

  // GET / HEAD / DELETE 没有 body，约定参数放 query
  if (BODYLESS_METHODS.includes(method)) {
    const params =
      config.params instanceof URLSearchParams
        ? Object.fromEntries(config.params.entries())
        : config.params;
    config.params = { ...params, ...extra };
    if (!config.paramsSerializer) {
      config.paramsSerializer = { serialize };
    }
  }

  const { data } = config;
  if (!data) return config;

  if (data instanceof FormData) {
    Object.entries(extra).forEach(([key, value]) => {
      if (!data.has(key)) data.append(key, value);
    });
    return config;
  }

  if (data instanceof URLSearchParams) {
    Object.entries(extra).forEach(([key, value]) => data.set(key, value));
    return config;
  }

  // 文件流不能当表单串处理，Content-Type 交给浏览器
  if (data instanceof Blob || data instanceof ArrayBuffer) return config;

  const contentType = String(config.headers.get('Content-Type') || '');

  // 调用方显式指定了非表单类型（如 application/json），保留对象交给 axios
  if (contentType && !contentType.includes('application/json')) {
    if (isObject(data)) config.data = { ...data, ...extra };
    return config;
  }

  // 后端只认表单参数，不能走默认的 JSON body
  config.headers.set('Content-Type', 'application/x-www-form-urlencoded');
  config.data =
    typeof data === 'string'
      ? `${data}&${serialize(extra)}`
      : serialize({ ...(isObject(data) ? data : {}), ...extra });

  return config;
});

// 响应拦截器：error !== 0 统一 reject（不弹提示，由调用方决定）
legacyHttp.interceptors.response.use(
  (response: AxiosResponse<LegacyResponse>): any => {
    const { config, data } = response;

    // 文件流接口不解析业务结构
    if (config.responseType === 'blob' || config.responseType === 'arraybuffer') {
      return response;
    }

    if (isObject(data) && 'error' in data && Number(data.error) !== 0) {
      const error = new Error(data.message || '请求失败') as Error & { data?: LegacyResponse };
      error.data = data;
      return Promise.reject(error);
    }

    return data;
  },
  error => {
    const response = error.response as AxiosResponse<LegacyResponse> | undefined;

    if (response?.status === 401) {
      // 老系统与当前系统是两套登录态：这里不能清当前 token / 刷新页面，
      // 否则老系统的 401 会把当前系统的登录态一起踢掉
      Message.warning({
        id: 'legacyUnauthorized',
        content: '老系统登录状态失效，请重新获取 sessionId',
        duration: 3000
      });
    }

    // 透出后端 message，例如 {"status":401,"message":"Unauthorized"}
    if (isObject(response?.data) && response?.data.message) {
      error.message = response.data.message;
    }

    return Promise.reject(error);
  }
);

export const legacyGet = <T = unknown>(
  url: string,
  params?: Record<string, any>,
  config?: AxiosRequestConfig
) => legacyHttp.get<T>(url, { params, ...config });

export const legacyPost = <T = unknown>(
  url: string,
  data?: Record<string, any> | FormData,
  config?: AxiosRequestConfig
) => legacyHttp.post<T>(url, data, config);

export default legacyHttp;
