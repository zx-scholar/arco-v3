const debug = import.meta.env.MODE !== 'production';

export default ({ mock, setup }: { mock?: boolean; setup: () => void }) => {
  if (mock !== false && debug) setup();
};

// 需与 src/utils/request.ts 的响应拦截器契约保持一致：status === 'success' 且 code 为 0/200
// success / msg 保留仅为兼容旧用法
export const successResponseWrap = (data: unknown) => {
  return {
    data,
    status: 'success',
    success: true,
    message: '请求成功',
    msg: '请求成功',
    code: 200
  };
};

export const failResponseWrap = (data: unknown, msg: string, code = 50000) => {
  return {
    data,
    status: 'error',
    success: false,
    message: msg,
    msg,
    code
  };
};
