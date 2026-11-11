import { getSessionId, legacyGet, legacyPost } from '@/utils/legacy-request';

/** 高尔夫收费项目（字典），字段以接口返回为准 */
export interface GolfChargeItem {
  id: number;
  code: string;
  itemName: string;
  machineType: number;
  machineTypeName: string;
  chargeUnit: number;
  chargeUnitName: string;
  originalPrice: number;
  memberPrice: number;
  privilegeDesc: string;
  state: string;
  [key: string]: any;
}

export interface GolfChargeItemResponse {
  error: number;
  message: string;
  itemList: GolfChargeItem[];
}

export function queryGolfChargeItemList() {
  return legacyGet<GolfChargeItemResponse>('/aisports-web/golfChargeItem/getGolfChargeItemList');
}

/** 新增 / 更新高尔夫收费项目：带 id 为更新，不带为新增 */
export interface GolfChargeItemDealParams {
  id?: string | number;
  itemName: string;
  machineType: number | string;
  chargeUnit: number | string;
  originalPrice: number;
  memberPrice: number;
  privilegeDesc?: string;
}

export function dealGolfChargeItem(data: GolfChargeItemDealParams) {
  // 老系统习惯把 isAjax / sessionId 挂在 URL 上，这里 query 和 body（拦截器注入）各带一份
  return legacyPost<{ error: number; message: string }>(
    '/aisports-web/golfChargeItem/dealGolfChargeItem',
    { ...data },
    { params: { isAjax: 'true', sessionId: getSessionId() } }
  );
}
