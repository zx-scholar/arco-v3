/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [1, 'always'],
    'header-max-length': [2, 'always', 108],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新特性：新增功能、新增页面/组件
        'fix', // bug 修复：修掉已存在的问题
        'perf', // 性能优化：渲染、首屏、包体积
        'style', // 代码风格：格式、缩进、分号（不影响逻辑）
        'docs', // 文档：README、注释、使用说明
        'test', // 测试：新增或调整测试用例
        'refactor', // 重构：不新增功能、不修 bug 的代码调整
        'build', // 构建/依赖：vite、pnpm、依赖版本、打包配置
        'ci', // CI 配置：.github/workflows、流水线脚本
        'chore', // 杂项：脚手架、配置、分支合并等琐碎改动
        'revert', // 回滚：撤销此前的某次提交
        'enhance', // 功能增强：在已有功能上做交互/体验改进
        'workflow', // 工作流程：协作流程、发布流程、模板
        'types', // TS 类型：类型定义、interface、d.ts 更新
        'release' // 版本发布：版本号与发版相关提交
      ]
    ]
  }
};
