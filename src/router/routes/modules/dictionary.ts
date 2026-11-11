import { DEFAULT_LAYOUT } from '../base';
import type { AppRouteRecordRaw } from '../types';

const DICTIONARY: AppRouteRecordRaw = {
  path: '/dictionary',
  name: 'dictionary',
  component: DEFAULT_LAYOUT,
  meta: {
    locale: '字典配置',
    requiresAuth: true,
    icon: 'icon-settings',
    order: 8
  },
  children: [
    {
      path: 'golf-charge-item',
      name: 'GolfChargeItem',
      component: () => import('@/views/dictionary/golf-charge-item/index.vue'),
      meta: {
        locale: '高尔夫收费项目',
        requiresAuth: true,
        roles: ['*']
      }
    },
    {
      path: 'file-upload',
      name: 'DictionaryFileUpload',
      component: () => import('@/views/dictionary/file-upload/index.vue'),
      meta: {
        locale: '文件上传',
        requiresAuth: true,
        roles: ['*']
      }
    }
  ]
};

export default DICTIONARY;
