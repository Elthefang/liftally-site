import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const navigation = fs.readFileSync(new URL('../site.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../site.css', import.meta.url), 'utf8');
const websiteFaq = fs.readFileSync(new URL('../website-faq.html', import.meta.url), 'utf8');

test('Support navigation contains separate Website FAQ, App FAQ, and Contact destinations', () => {
  assert.match(navigation, /href: '\/website-faq'/);
  assert.match(navigation, /href: '\/app-faq'/);
  assert.match(navigation, /href: '\/request-access'/);
  assert.match(navigation, /aria-haspopup', 'menu'/);
  assert.match(navigation, /toggle\.textContent = 'Support'/);
  assert.match(navigation, /aria-label', 'Support menu'/);
  assert.match(navigation, /insertBefore\(helpItem, mobileDownloadItem\)/);
  assert.match(navigation, /ArrowDown/);
  assert.match(navigation, /Escape/);
});

test('Help navigation has desktop dropdown and mobile accordion styling', () => {
  assert.match(styles, /\.site-shell \.help-menu \{/);
  assert.match(styles, /\.site-shell \.nav-help {/);
  assert.match(styles, /\.site-shell \.nav-links\.open/);
  assert.match(styles, /\.site-shell \.nav-help-toggle/);
  assert.match(styles, /width: min\(240px, calc\(100vw - 32px\)\)/);
  assert.match(styles, /min-height: 46px/);
  assert.doesNotMatch(navigation, /nav-help-chevron/);
  assert.doesNotMatch(navigation, /Benchmarks, percentiles/);
  assert.doesNotMatch(navigation, /Liftally iOS features/);
});

test('desktop navigation keeps primary links leading and auth actions trailing', () => {
  assert.match(styles, /\.site-shell \.header-inner \{[\s\S]*?justify-content: flex-start;/);
  assert.match(styles, /\.site-shell \.site-nav \{[\s\S]*?margin-left: 48px;/);
  assert.match(styles, /\.site-shell \.nav-links \{[\s\S]*?gap: 32px;[\s\S]*?margin-right: auto;/);
  assert.match(styles, /\.site-shell \.site-nav > \.site-auth \+ \.site-download \{[\s\S]*?margin-left: 14px;/);
});

test('Website FAQ is a dedicated FAQ page with matching visible content and schema', () => {
  assert.match(websiteFaq, /<title>Liftally Website FAQ/);
  assert.doesNotMatch(websiteFaq, /Benchmarks, percentiles, data sources, accounts, and website usage\.<\/p>/);
  assert.match(websiteFaq, /data-site-auth/);
  assert.match(websiteFaq, /class="faq-card"/);
  assert.match(websiteFaq, /"@type"\s*:\s*"FAQPage"/);
  assert.match(websiteFaq, /href="\/app-faq"/);
  assert.match(websiteFaq, /What is the Weight Class Explorer\?/);
  assert.doesNotMatch(websiteFaq, /What is Liftally\?/);
  assert.doesNotMatch(websiteFaq, /Does Liftally include powerlifting tools\?/);
});

test('FAQ pages use the shared single-column accordion behavior and dark visual system', () => {
  assert.match(navigation, /faq-accordion/);
  assert.match(navigation, /aria-controls/);
  assert.match(navigation, /aria-hidden/);
  assert.match(styles, /\.site-shell\.faq-page \.faq-accordion \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.site-shell\.faq-page \.faq-accordion__trigger/);
  assert.match(styles, /var\(--site-font-display\)/);
  assert.match(styles, /\.site-shell\.faq-page[\s\S]*#eef3f2/);
});

test('App FAQ owns app feature questions without duplicating website-only content', () => {
  const appFaq = fs.readFileSync(new URL('../app-faq.html', import.meta.url), 'utf8');
  assert.match(appFaq, /What is Liftally\?/);
  assert.match(appFaq, /What can I track with Liftally\?/);
  assert.match(appFaq, /How does Liftally use training data\?/);
  assert.doesNotMatch(appFaq, /What is the Weight Class Explorer\?/);
  assert.doesNotMatch(appFaq, /Quick answers for workout tracking/);
  assert.doesNotMatch(appFaq, /Find practical answers for using Liftally/);
});
