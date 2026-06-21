import { scanCatalog } from './scanner/index.mjs';

const result = await scanCatalog(process.cwd());
console.log(`扫描完成：${result.summary.total} 个扩展，异常 ${result.summary.abnormal} 个，已写入 data/extensions.json`);
