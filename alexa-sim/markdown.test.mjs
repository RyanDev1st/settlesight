import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderMarkdown } from './main.js';

const { document } = parseHTML('<!doctype html><html><body></body></html>');

test('bold renders as <strong>', () => {
  const fragment = renderMarkdown('This is **bold** text', document);
  const strong = fragment.querySelector('strong');
  assert.ok(strong, '<strong> element should exist');
  assert.equal(strong.textContent, 'bold');
});

test('<img src=x onerror=alert(1)> renders as literal text (no element created)', () => {
  const fragment = renderMarkdown('<img src=x onerror=alert(1)>', document);
  const elements = fragment.querySelectorAll('*');
  assert.equal(elements.length, 0, 'no elements should be created');
  const container = document.createElement('div');
  container.appendChild(fragment);
  assert.equal(container.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(container.children.length, 0);
});

test('a list of 2 items renders as 2 <li>', () => {
  const fragment = renderMarkdown('- First item\n- Second item', document);
  const items = fragment.querySelectorAll('li');
  assert.equal(items.length, 2, 'should have 2 li elements');
  assert.equal(items[0].textContent, 'First item');
  assert.equal(items[1].textContent, 'Second item');
  const ul = fragment.querySelector('ul');
  assert.ok(ul, '<ul> element should exist');
});

test('inline code renders as <code>', () => {
  const fragment = renderMarkdown('Here is `code` inline', document);
  const code = fragment.querySelector('code');
  assert.ok(code, '<code> element should exist');
  assert.equal(code.textContent, 'code');
});

test('line breaks render as <br>', () => {
  const fragment = renderMarkdown('Line 1\nLine 2', document);
  const br = fragment.querySelector('br');
  assert.ok(br, '<br> element should exist');
});
