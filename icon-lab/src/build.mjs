// Generates per-layer SVGs from the master X.svg files and rasterizes them.
// Usage: node build.mjs a b c   (concepts)  [--only-icon]
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const lab = 'C:/Users/PC/desktop/TO_DO_APP/icon-lab';
const tmp = path.join(lab, 'src', 'tmp'); fs.mkdirSync(tmp, { recursive: true });
const args = process.argv.slice(2); const concepts = args.filter(a => !a.startsWith('--'));
const jobs = [];
const variants = {
  'icon-1024': { hide: ['mono'], viewBox: '180 180 720 720' },
  'foreground': { hide: ['bg', 'mono'] },
  'background': { hide: ['fg', 'mono'] },
  'monochrome': { hide: ['bg', 'fg'] },
};
for (const c of concepts) {
  const src = fs.readFileSync(path.join(lab, `${c}.svg`), 'utf8');
  for (const [name, v] of Object.entries(variants)) {
    if (args.includes('--only-icon') && name !== 'icon-1024') continue;
    let s = src.replace(/<svg([^>]*)>/, (m, a) => {
      let attrs = a.replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '');
      if (v.viewBox) attrs = attrs.replace(/viewBox="[^"]*"/, `viewBox="${v.viewBox}"`);
      return `<svg${attrs} width="1024" height="1024">\n<style>${v.hide.map(h => '#' + h).join(',')}{display:none}</style>`;
    });
    const svgOut = path.join(lab, 'src', `${c}-${name}.svg`);
    fs.writeFileSync(svgOut, s);
    const html = path.join(tmp, `${c}-${name}.html`);
    fs.writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${s}</body></html>`);
    jobs.push({ url: html, width: 1024, height: 1024, out: path.join(lab, `${c}-${name}.png`), wait: 200 });
  }
}
fs.writeFileSync(path.join(tmp, 'jobs.json'), JSON.stringify(jobs));
execFileSync('node', [path.join(lab, 'src', 'render.mjs'), path.join(tmp, 'jobs.json')], { stdio: 'inherit' });
