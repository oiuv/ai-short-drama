import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // 工作台会在切换项目/分集后，把服务端草稿同步进可编辑的本地状态。
      'react-hooks/set-state-in-effect': 'off',
      // 素材由本机媒体路由提供，保留原始文件，不经过 Next 图片代理和重编码。
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'data/**',
    'next-env.d.ts',
  ]),
])
