'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const output = path.join(root, 'docs');
const { catalogue } = require('../src/catalogue.cjs');
const plannerSource = fs.readFileSync(path.join(root, 'src', 'planner.cjs'), 'utf8');
const exportLine = 'module.exports = { plan, travel, normalizeScenario };';
if (!plannerSource.includes(exportLine)) throw new Error('Planner export changed; static build must be reviewed.');

fs.mkdirSync(output, { recursive: true });
for (const file of ['app.js', 'style.css', 'tokens.css'])
  fs.copyFileSync(path.join(root, 'public', file), path.join(output, file));

const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
  .replaceAll('href="/tokens.css"', 'href="./tokens.css"')
  .replaceAll('href="/style.css"', 'href="./style.css"')
  .replaceAll('src="/app.js"', 'src="./static-engine.js" defer></script>\n  <script src="./app.js"')
  .replace('href="/" aria-label', 'href="./" aria-label');
fs.writeFileSync(path.join(output, 'index.html'), html);

const engine = `// Generated from src/planner.cjs. All catalogue facts are synthetic.
(() => {
  'use strict';
  const catalogue = ${JSON.stringify(catalogue)};
  ${plannerSource.replace(exportLine, '')}
  window.RainRouteStatic = Object.freeze({
    catalogue,
    runPlan(scenario) {
      const result = plan(scenario, catalogue);
      return {
        ...result,
        explanation: result.status === 'no-solution'
          ? '当前硬约束下没有三站可行路线，请调整条件后重试。'
          : \`找到 \${result.feasibleCount} 条满足所有硬约束的合成路线，展示前 \${result.routes.length} 条。\`,
        trace: ['resolve:synthetic-theme', 'discover:synthetic-catalogue',
          'verify:synthetic-demo-only', 'replan:hard-constraints', 'explain:source-bound'],
        agentFramework: 'Static planner preview'
      };
    }
  });
})();
`;
fs.writeFileSync(path.join(output, 'static-engine.js'), engine);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
process.stdout.write(`Built static demo in ${output}\n`);
