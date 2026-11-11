import Mock from 'mockjs';
import setupMock, { successResponseWrap, failResponseWrap } from './setup-mock';
import type { MockParams } from '@/types/mock';

// 生成内联 SVG 验证码图片，避免请求真实后端接口（/auth/captcha 无 mock 会导致跨域）
const createCaptchaImage = () => {
  const code = String(Mock.Random.natural(1000, 9999));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30" viewBox="0 0 100 30">
<rect width="100" height="30" fill="#f2f3f5"/>
<text x="50" y="22" font-family="monospace" font-size="20" letter-spacing="4" text-anchor="middle" fill="#165dff">${code}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

setupMock({
  setup() {
    // 图片验证码
    Mock.mock(new RegExp('/auth/captcha'), () => {
      return successResponseWrap({
        id: Mock.Random.guid(),
        captcha: createCaptchaImage(),
        type: 'image',
        ttl: 60
      });
    });

    // 获取验证码
    Mock.mock(new RegExp('/api/login/captcha'), (params: MockParams) => {
      const { tel } = JSON.parse(params.body);
      if (!tel) {
        return failResponseWrap(null, '手机号不能为空', 50000);
      }

      // 如果手机号不是1开头的11位数字，返回错误
      if (!/^1\d{10}$/.test(tel)) {
        return failResponseWrap(null, '无效手机号', 50000);
      }

      return successResponseWrap({
        captcha: '996996'
      });
    });
  }
});
