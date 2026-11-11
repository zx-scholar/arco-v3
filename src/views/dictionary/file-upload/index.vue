<template>
  <div class="container">
    <Breadcrumb :items="['字典配置', '文件上传']" />
    <a-card class="general-card" title="文件上传">
      <template #extra>
        <a-typography-text type="secondary">POST {{ UPLOAD_PATH }}</a-typography-text>
      </template>

      <a-alert type="info" style="margin-bottom: 16px">
        <template #title>上传接口</template>
        <a-typography-text code>POST {{ UPLOAD_PATH }}</a-typography-text>
        ，表单格式
        <a-typography-text code>multipart/form-data</a-typography-text>
        ，文件字段名
        <a-typography-text code>{{ UPLOAD_FIELD_NAME }}</a-typography-text>
        。字段名或地址需要调整时，改
        <a-typography-text code>src/api/upload.ts</a-typography-text>
        即可，本页无需改动。
      </a-alert>

      <a-row :gutter="16" style="margin-bottom: 16px" align="center">
        <a-col :span="14">
          <a-input v-model="sessionId" placeholder="粘贴老系统 sessionId" allow-clear>
            <template #prepend>sessionId</template>
          </a-input>
        </a-col>
        <a-col :span="10">
          <a-space>
            <a-button type="primary" @click="saveSession">
              <template #icon>
                <icon-save />
              </template>
              保存 sessionId
            </a-button>
            <a-button :disabled="!fileList.length" @click="clearAll">
              <template #icon>
                <icon-delete />
              </template>
              清空列表
            </a-button>
          </a-space>
        </a-col>
      </a-row>

      <a-upload
        v-model:file-list="fileList"
        draggable
        multiple
        :limit="MAX_COUNT"
        :accept="ACCEPT"
        :tip="tipText"
        :custom-request="customRequest"
        :on-before-upload="beforeUpload"
        @exceed-limit="handleExceed"
      />

      <a-divider orientation="left">最近一次上传结果</a-divider>

      <a-empty v-if="!lastResult" description="上传完成后在这里显示接口返回，方便核对字段" />

      <div v-else class="result">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="文件名">{{ lastResult.name }}</a-descriptions-item>
          <a-descriptions-item label="大小">{{ lastResult.size }}</a-descriptions-item>
          <a-descriptions-item label="结果">
            <a-tag :color="lastResult.success ? 'green' : 'red'">
              {{ lastResult.success ? '成功' : '失败' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="时间">{{ lastResult.time }}</a-descriptions-item>
          <a-descriptions-item v-if="lastResult.error" label="错误信息" :span="2">
            {{ lastResult.error }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="json">
          <div class="json-header">
            <span>响应体</span>
            <a-button size="mini" type="text" @click="copyJson">
              <template #icon>
                <icon-copy />
              </template>
              复制
            </a-button>
          </div>
          <pre class="json-body">{{ lastResult.body }}</pre>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { FileItem, RequestOption } from '@arco-design/web-vue/es/upload/interfaces';
import { getSessionId, setSessionId as cacheSessionId } from '@/utils/legacy-request';
import { UPLOAD_FIELD_NAME, UPLOAD_PATH, uploadFile } from '@/api/upload';

/** 上传限制，按后端要求调整 */
const MAX_SIZE_MB = 20;
const MAX_COUNT = 10;
/**
 * 默认不限制类型（空字符串）。
 * 注意：arco 拖拽时按 accept 过滤且"不匹配就静默丢弃"，不弹任何提示，
 * 白名单收窄后容易出现"拖了文件没反应、也没有请求"。
 * 后端确定只收某几类文件时，再填 '.jpg,.png,.pdf' 这种形式。
 */
const ACCEPT = '';
const ACCEPT_TEXT = '不限类型';
const tipText = `点击或拖拽文件到此处，${ACCEPT_TEXT}，单个不超过 ${MAX_SIZE_MB}MB，最多 ${MAX_COUNT} 个`;

interface LastResult {
  name: string;
  size: string;
  success: boolean;
  time: string;
  body: string;
  error?: string;
}

const sessionId = ref(getSessionId());
const fileList = ref<FileItem[]>([]);
const lastResult = ref<LastResult | null>(null);

/** uid -> 取消函数，清空列表时中断进行中的上传 */
const abortMap = new Map<string, () => void>();

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const now = () => new Date().toLocaleString('zh-CN', { hour12: false });

const saveSession = () => {
  cacheSessionId(sessionId.value.trim());
  Message.success('sessionId 已保存');
};

const beforeUpload = (file: File) => {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    Message.error(`${file.name} 超过 ${MAX_SIZE_MB}MB，已跳过`);
    return false;
  }
  return true;
};

const handleExceed = () => {
  Message.warning(`最多同时上传 ${MAX_COUNT} 个文件`);
};

const customRequest = (option: RequestOption) => {
  const { fileItem, onProgress, onSuccess, onError } = option;
  const file = fileItem.file as File;

  const controller = new AbortController();
  abortMap.set(fileItem.uid, () => controller.abort());

  uploadFile(file, {
    signal: controller.signal,
    // 组件内部按 0~1 的比例算进度
    onProgress: percent => onProgress(percent / 100)
  })
    .then(response => {
      onSuccess(response);
      lastResult.value = {
        name: file.name,
        size: formatSize(file.size),
        success: true,
        time: now(),
        body: JSON.stringify(response ?? {}, null, 2)
      };
      Message.success(`${file.name} 上传成功`);
    })
    .catch(error => {
      const message = (error as Error)?.message || '上传失败';
      onError(error);
      lastResult.value = {
        name: file.name,
        size: formatSize(file.size),
        success: false,
        time: now(),
        // 失败时把后端返回体一并展示，方便判断是鉴权、字段名还是业务校验问题
        body: JSON.stringify((error as any)?.data ?? { message }, null, 2),
        error: message
      };
      // 取消上传不当作失败提示
      if (!controller.signal.aborted) Message.error(`${file.name} ${message}`);
    })
    .finally(() => {
      abortMap.delete(fileItem.uid);
    });

  return {
    abort: () => controller.abort()
  };
};

const clearAll = () => {
  abortMap.forEach(abort => abort());
  abortMap.clear();
  fileList.value = [];
};

const copyJson = async () => {
  if (!lastResult.value) return;
  try {
    await navigator.clipboard.writeText(lastResult.value.body);
    Message.success('已复制到剪贴板');
  } catch {
    Message.warning('当前环境不支持自动复制，请手动选中');
  }
};

onBeforeUnmount(() => {
  abortMap.forEach(abort => abort());
  abortMap.clear();
});
</script>

<script lang="ts">
export default {
  name: 'DictionaryFileUpload'
};
</script>

<style scoped lang="less">
.container {
  padding: 0 20px 20px;
}

.result {
  .json {
    margin-top: 16px;
    overflow: hidden;
    background: var(--color-fill-1);
    border: 1px solid var(--color-border-2);
    border-radius: var(--border-radius-medium);
  }

  .json-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 12px;
    color: var(--color-text-3);
    border-bottom: 1px solid var(--color-border-2);
  }

  .json-body {
    max-height: 320px;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-1);
    word-break: break-all;
    white-space: pre-wrap;
  }
}
</style>
