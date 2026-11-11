<template>
  <div class="container">
    <Breadcrumb :items="['字典配置', '高尔夫收费项目']" />
    <a-card class="general-card" title="字典配置">
      <template #extra>
        <div class="api-tip">
          <a-typography-text type="secondary">
            GET /aisports-web/golfChargeItem/getGolfChargeItemList
          </a-typography-text>
          <a-typography-text type="secondary">
            POST /aisports-web/golfChargeItem/dealGolfChargeItem
          </a-typography-text>
        </div>
      </template>

      <a-row :gutter="16" style="margin-bottom: 16px" align="center">
        <a-col :span="14">
          <a-input v-model="sessionId" placeholder="粘贴老系统 sessionId" allow-clear>
            <template #prepend>sessionId</template>
          </a-input>
        </a-col>
        <a-col :span="10">
          <a-space>
            <a-button type="primary" :loading="loading" @click="saveAndQuery">
              <template #icon>
                <icon-search />
              </template>
              保存并查询
            </a-button>
            <a-button :loading="loading" @click="fetchData">
              <template #icon>
                <icon-refresh />
              </template>
              刷新
            </a-button>
            <a-button type="outline" @click="openCreate">
              <template #icon>
                <icon-plus />
              </template>
              新增项目
            </a-button>
          </a-space>
        </a-col>
      </a-row>

      <a-alert
        v-if="errorMessage"
        type="warning"
        :content="errorMessage"
        style="margin-bottom: 16px"
      />

      <a-table :loading="loading" :columns="columns" :data="rows" :bordered="false">
        <template #index="{ rowIndex }">{{ rowIndex + 1 }}</template>
        <template #actions="{ record }">
          <a-button type="text" size="small" @click="openEdit(record)">编辑</a-button>
        </template>
        <template #empty>
          <a-empty description="暂无数据" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:visible="formVisible"
      :title="form.id ? '编辑收费项目' : '新增收费项目'"
      :width="560"
      :on-before-ok="handleSubmit"
      :ok-loading="submitting"
      :mask-closable="false"
      unmount-on-close
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item v-if="form.id" label="ID">
          <a-typography-text code>{{ form.id }}</a-typography-text>
        </a-form-item>

        <a-form-item field="itemName" label="项目名称">
          <a-input v-model="form.itemName" placeholder="如：测试时长" allow-clear />
        </a-form-item>

        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item field="machineType" label="机型编码（machineType）">
              <a-input-number
                v-model="form.machineType"
                :precision="0"
                placeholder="如：1"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="chargeUnit" label="计费单位编码（chargeUnit）">
              <a-input-number
                v-model="form.chargeUnit"
                :precision="0"
                placeholder="如：2"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item field="originalPrice" label="原价（originalPrice）">
              <a-input-number v-model="form.originalPrice" :precision="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="memberPrice" label="会员价（memberPrice）">
              <a-input-number v-model="form.memberPrice" :precision="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item field="privilegeDesc" label="权益说明（privilegeDesc）">
          <a-input v-model="form.privilegeDesc" placeholder="如：时长" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { FormInstance } from '@arco-design/web-vue/es/form';
import type { FieldRule } from '@arco-design/web-vue/es/form/interface';
import useLoading from '@/hooks/useLoading';
import { getSessionId, setSessionId as cacheSessionId } from '@/utils/legacy-request';
import { dealGolfChargeItem, queryGolfChargeItemList } from '@/api/dictionary';
import type { TableColumnData } from '@arco-design/web-vue/es/table/interface';

type Row = Record<string, any>;

// 老系统字段名 -> 列标题，未列出的字段会自动追加到后面
const COLUMN_TITLES: Record<string, string> = {
  itemName: '项目名称',
  code: '编码',
  machineTypeName: '适用机型',
  machineType: '机型编码',
  chargeUnitName: '计费单位',
  chargeUnit: '计费单位编码',
  originalPrice: '原价',
  memberPrice: '会员价',
  privilegeDesc: '权益说明',
  state: '状态',
  id: 'ID'
};

const { loading, setLoading } = useLoading(false);
const sessionId = ref(getSessionId());
const rows = ref<Row[]>([]);
const errorMessage = ref('');

// 已知字段按约定顺序展示，未知字段追加在后面
const columns = computed<TableColumnData[]>(() => {
  const keys = Object.keys(rows.value[0] || {});
  const known = Object.keys(COLUMN_TITLES).filter(key => keys.includes(key));
  const unknown = keys.filter(key => !(key in COLUMN_TITLES));
  const dataKeys = keys.length ? [...known, ...unknown] : Object.keys(COLUMN_TITLES);

  return [
    { title: '#', dataIndex: 'index', slotName: 'index', width: 60 },
    ...dataKeys.map(key => ({
      title: COLUMN_TITLES[key] || key,
      dataIndex: key,
      ellipsis: true,
      tooltip: true
    })),
    { title: '操作', dataIndex: 'actions', slotName: 'actions', width: 80, fixed: 'right' }
  ];
});

const extractRows = (body: any): Row[] => {
  if (!body) return [];
  if (Array.isArray(body)) return body;

  const preferred = ['itemList', 'list', 'data', 'rows', 'result'].find(key =>
    Array.isArray(body[key])
  );
  if (preferred) return body[preferred];

  // 兜底：取第一个数组类型的字段
  const fallback = Object.values(body).find(value => Array.isArray(value));
  return (fallback as Row[]) || [];
};

const fetchData = async () => {
  setLoading(true);
  errorMessage.value = '';
  try {
    const body: any = await queryGolfChargeItemList();
    // 未登录时后端会 302 到登录页，XHR 跟随后拿到的是 HTML
    if (!body || typeof body !== 'object') {
      rows.value = [];
      errorMessage.value = '接口未返回 JSON，可能是 sessionId 失效被重定向到了登录页';
      return;
    }
    rows.value = extractRows(body);
  } catch (error) {
    rows.value = [];
    errorMessage.value = (error as Error)?.message || '请求失败';
  } finally {
    setLoading(false);
  }
};

const saveAndQuery = () => {
  cacheSessionId(sessionId.value.trim());
  fetchData();
};

/* ------------------------------ 新增 / 编辑 ------------------------------ */

interface EditForm {
  id?: string | number;
  itemName: string;
  machineType?: number | string;
  chargeUnit?: number | string;
  originalPrice?: number;
  memberPrice?: number;
  privilegeDesc?: string;
}

const createEmptyForm = (): EditForm => ({
  id: undefined,
  itemName: '',
  machineType: undefined,
  chargeUnit: undefined,
  originalPrice: undefined,
  memberPrice: undefined,
  privilegeDesc: ''
});

/** 老系统返回的编码/价格可能是字符串，转成数字喂给 a-input-number */
const toNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const formRef = ref<FormInstance>();
const form = reactive<EditForm>(createEmptyForm());
const formVisible = ref(false);
const submitting = ref(false);

const rules: Record<string, FieldRule[]> = {
  itemName: [{ required: true, message: '请输入项目名称' }],
  machineType: [{ required: true, message: '请输入机型编码' }],
  chargeUnit: [{ required: true, message: '请输入计费单位编码' }],
  originalPrice: [{ required: true, message: '请输入原价' }],
  memberPrice: [{ required: true, message: '请输入会员价' }]
};

const openCreate = () => {
  Object.assign(form, createEmptyForm());
  formRef.value?.clearValidate();
  formVisible.value = true;
};

const openEdit = (record: Row) => {
  Object.assign(form, {
    id: record.id,
    itemName: record.itemName ?? '',
    machineType: toNumber(record.machineType),
    chargeUnit: toNumber(record.chargeUnit),
    originalPrice: toNumber(record.originalPrice),
    memberPrice: toNumber(record.memberPrice),
    privilegeDesc: record.privilegeDesc ?? ''
  });
  formRef.value?.clearValidate();
  formVisible.value = true;
};

const handleSubmit = async () => {
  const errors = await formRef.value?.validate();
  if (errors) return false;

  submitting.value = true;
  try {
    // id 为空即新增；legacyPost 会补上 isAjax / sessionId
    await dealGolfChargeItem({
      id: form.id,
      itemName: form.itemName,
      machineType: form.machineType as number,
      chargeUnit: form.chargeUnit as number,
      originalPrice: form.originalPrice as number,
      memberPrice: form.memberPrice as number,
      privilegeDesc: form.privilegeDesc
    });
    Message.success(form.id ? '修改成功' : '新增成功');
    await fetchData();
    return true;
  } catch (error) {
    Message.error((error as Error)?.message || '保存失败');
    return false;
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  // 开发环境由 vite 代理注入 SESSION Cookie，sessionId 可留空先拉一次
  fetchData();
});
</script>

<script lang="ts">
export default {
  name: 'GolfChargeItem'
};
</script>

<style scoped lang="less">
.container {
  padding: 0 20px 20px;
}

.api-tip {
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  :deep(.arco-typography) {
    margin-bottom: 0;
    font-size: 12px;
    line-height: 18px;
  }
}
</style>
