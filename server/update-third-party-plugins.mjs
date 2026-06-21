import { updateThirdPartyPlugins } from './plugin-updater.mjs';

const dryRun = process.argv.includes('--dry-run');
const report = await updateThirdPartyPlugins(process.cwd(), { dryRun });
console.log(`第三方插件更新检查完成：候选 ${report.summary.candidates} 个，更新 ${report.summary.updated} 个，无变化 ${report.summary.checkedNoChange} 个，失败 ${report.summary.failed} 个，跳过自建 ${report.summary.skippedSelfBuilt} 个。`);
