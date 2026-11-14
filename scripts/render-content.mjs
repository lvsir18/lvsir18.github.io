#!/usr/bin/env node
/**
 * 从 data/*.json 生成 index.html 的「项目与作品」「推荐项目」区块。
 *
 * 用法：
 *   node scripts/render-content.mjs                 生成全部区块
 *   node scripts/render-content.mjs --only starred  只生成推荐项目
 *   node scripts/render-content.mjs --only projects 只生成项目与作品
 *   node scripts/render-content.mjs --check         检查页面是否与配置一致（不写入）
 *
 * data/projects.json
 *   - hidden: true  隐藏项目（保留配置，随时可恢复）
 *   - 展示顺序即数组顺序
 *
 * data/starred.json
 *   - hidden: true  隐藏项目（保留配置，随时可恢复）
 *   - 展示顺序按 stars 从高到低自动排列
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');

const ARROW_SVG =
  '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12L12 4M6 4h6v6"/></svg>';
const STAR_SVG =
  '<svg class="star" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.94 4.05 4.44.62-3.22 3.09.78 4.4L8 11.67l-3.94 2.09.78-4.4L1.62 6.27l4.44-.62z"/></svg>';

const numberFormat = new Intl.NumberFormat('en-US');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fail(message) {
  console.error(`render-content: ${message}`);
  process.exit(1);
}

function readConfig(file) {
  const path = join(root, file);
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`无法读取 ${file}：${error.message}`);
  }
  if (!config || !Array.isArray(config.items)) fail(`${file} 缺少 items 数组`);
  return config;
}

function checkString(value, where, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${where}.${field} 不能为空`);
}

function checkOptionalString(value, where, field) {
  if (value !== undefined) checkString(value, where, field);
}

function checkHidden(value, where) {
  if (value !== undefined && typeof value !== 'boolean') fail(`${where}.hidden 必须是布尔值`);
}

/* ---------------- starred ---------------- */

function validateStarredItem(item, index) {
  const where = `data/starred.json items[${index}]`;
  if (!item || typeof item !== 'object') fail(`${where} 不是对象`);
  if (typeof item.repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(item.repo)) {
    fail(`${where}.repo 必须是 "owner/name" 形式`);
  }
  checkString(item.description, where, 'description');
  checkString(item.language, where, 'language');
  if (typeof item.languageColor !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(item.languageColor)) {
    fail(`${where}.languageColor 必须是十六进制颜色，例如 "#3572A5"`);
  }
  if (!Number.isInteger(item.stars) || item.stars < 0) fail(`${where}.stars 必须是非负整数`);
  checkHidden(item.hidden, where);
}

function renderStarredItem(item) {
  const [owner, name] = item.repo.split('/');
  return `        <li class="starred reveal">
          <a href="https://github.com/${esc(item.repo)}" target="_blank" rel="noopener">
            <span class="starred-title"><span class="starred-owner">${esc(owner)} /</span> ${esc(name)}</span>
            <span class="starred-desc">${esc(item.description)}</span>
            <span class="starred-meta">
              <span class="starred-lang"><span class="lang-dot" style="--dot: ${esc(item.languageColor)}"></span>${esc(item.language)}</span>
              <span class="starred-stars">${STAR_SVG}<span class="sr-only">GitHub stars</span>${numberFormat.format(item.stars)}</span>
            </span>
          </a>
        </li>`;
}

function renderStarred() {
  const config = readConfig('data/starred.json');
  config.items.forEach(validateStarredItem);

  const hidden = config.items.filter((item) => item.hidden === true).map((item) => item.repo);
  const visible = config.items
    .filter((item) => item.hidden !== true)
    .sort((a, b) => b.stars - a.stars || a.repo.localeCompare(b.repo));

  if (!visible.length) console.warn('render-content: 警告：推荐项目没有可展示的条目');

  const list = visible.length
    ? `      <ul class="starred-list">\n${visible.map(renderStarredItem).join('\n\n')}\n      </ul>`
    : '      <ul class="starred-list"></ul>';

  return { list, visible: visible.length, hidden };
}

/* ---------------- projects ---------------- */

function validateProjectItem(item, index) {
  const where = `data/projects.json items[${index}]`;
  if (!item || typeof item !== 'object') fail(`${where} 不是对象`);
  checkString(item.name, where, 'name');
  checkOptionalString(item.badge, where, 'badge');
  checkString(item.meta, where, 'meta');
  checkString(item.description, where, 'description');
  if (!Array.isArray(item.tags)) fail(`${where}.tags 必须是数组`);
  item.tags.forEach((tag, tagIndex) => checkString(tag, where, `tags[${tagIndex}]`));
  if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url)) {
    fail(`${where}.url 必须是 http(s) 地址`);
  }
  checkHidden(item.hidden, where);
}

function renderProjectItem(item) {
  const badge = item.badge ? `<span class="badge">${esc(item.badge)}</span>` : '';
  const tags = item.tags.length
    ? `\n          <p class="tags">${item.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</p>`
    : '';

  return `        <li class="project reveal">
          <div class="project-top">
            <h3>${esc(item.name)}${badge}</h3>
            <span class="project-meta">${esc(item.meta)}</span>
          </div>
          <p class="project-desc">
            ${esc(item.description)}
          </p>${tags}
          <a class="project-link" href="${esc(item.url)}" target="_blank" rel="noopener">
            查看仓库
            ${ARROW_SVG}
          </a>
        </li>`;
}

function renderProjects() {
  const config = readConfig('data/projects.json');
  config.items.forEach(validateProjectItem);

  const hidden = config.items.filter((item) => item.hidden === true).map((item) => item.name);
  const visible = config.items.filter((item) => item.hidden !== true);

  if (!visible.length) console.warn('render-content: 警告：项目与作品没有可展示的条目');

  const list = visible.length
    ? `      <ol class="project-list">\n${visible.map(renderProjectItem).join('\n\n')}\n      </ol>`
    : '      <ol class="project-list"></ol>';

  return { list, visible: visible.length, hidden };
}

/* ---------------- 区块替换 ---------------- */

const sections = {
  starred: {
    file: 'data/starred.json',
    start: '<!-- starred:start -->',
    end: '<!-- starred:end -->',
    render: renderStarred,
  },
  projects: {
    file: 'data/projects.json',
    start: '<!-- projects:start -->',
    end: '<!-- projects:end -->',
    render: renderProjects,
  },
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applySection(html, section) {
  const regex = new RegExp(`${escapeRegExp(section.start)}[\\s\\S]*?${escapeRegExp(section.end)}`, 'g');
  const matches = html.match(regex) || [];
  if (matches.length !== 1) {
    fail(`index.html 中应恰好有一对 ${section.start} / ${section.end} 标记，实际找到 ${matches.length} 对`);
  }

  const { list, visible, hidden } = section.render();
  const block = `${section.start}
      <!-- 本区块由 scripts/render-content.mjs 根据 ${section.file} 生成，请勿手动编辑 -->
${list}
      ${section.end}`;

  return {
    html: html.replace(regex, () => block),
    visible,
    hidden,
  };
}

/* ---------------- 入口 ---------------- */

const args = process.argv.slice(2);
const check = args.includes('--check');
const onlyIndex = args.indexOf('--only');
let names = Object.keys(sections);

if (onlyIndex !== -1) {
  const name = args[onlyIndex + 1];
  if (!name || !sections[name]) fail(`--only 只支持 ${Object.keys(sections).join(' / ')}`);
  names = [name];
}

const extra = args.filter((arg, index) => {
  if (arg === '--check') return false;
  if (index === onlyIndex || index === onlyIndex + 1) return false;
  return true;
});
if (extra.length) fail(`未知参数：${extra.join(' ')}`);

let html = readFileSync(htmlPath, 'utf8');
const stats = [];

for (const name of names) {
  const result = applySection(html, sections[name]);
  html = result.html;
  stats.push({ name, visible: result.visible, hidden: result.hidden });
}

const changed = html !== readFileSync(htmlPath, 'utf8');

if (check) {
  if (changed) {
    const stale = stats.map((item) => item.name).join('、');
    fail(`index.html 与配置不一致（${stale}），请运行 node scripts/render-content.mjs`);
  }
  console.log(`render-content: 已是最新（${stats.map((item) => `${item.name} ${item.visible} 个`).join('，')}）`);
  process.exit(0);
}

if (changed) {
  writeFileSync(htmlPath, html);
  console.log('render-content: 已更新 index.html');
} else {
  console.log('render-content: 无需更新');
}
for (const item of stats) {
  const hidden = item.hidden.length ? `，隐藏：${item.hidden.join('、')}` : '';
  console.log(`  ${item.name}: ${item.visible} 个${hidden}`);
}
