const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element(dataset = {}) {
  const classes = new Set();
  return { dataset, attributes: {}, textContent: '', handlers: {}, open: false,
    classList: { toggle(name, force) { const on = force === undefined ? !classes.has(name) : force; on ? classes.add(name) : classes.delete(name); return on; } },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(event, fn) { this.handlers[event] = fn; }
  };
}
function setup() {
  const nodes = ['data', 'people', 'systems'].map(focus => element({ focus }));
  const details = [element(), element()]; details[0].open = true;
  const elements = Object.fromEntries(['.visual', '#motion', '#focus-label', '#focus-copy', '#print'].map(id => [id, element()]));
  const events = {}; let printCount = 0;
  vm.runInNewContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), {
    document: { querySelector: id => elements[id], querySelectorAll: selector => selector === '[data-focus]' ? nodes : selector === 'details' ? details : [] },
    window: { addEventListener: (type, fn) => { events[type] = fn; }, print: () => { printCount++; } }
  });
  return { nodes, details, elements, events, prints: () => printCount };
}
test('Selecting disciplines keeps one active selection and updates accessible copy', () => {
  const {nodes, elements} = setup();
  for (const node of nodes) {
    node.handlers.click();
    assert.equal(nodes.filter(n => n.attributes['aria-pressed'] === 'true').length, 1);
    assert.equal(node.attributes['aria-pressed'], 'true');
    assert.ok(elements['#focus-copy'].textContent.length > 10);
  }
  assert.equal(elements['#focus-label'].textContent, '03 / CONNECTED SYSTEMS');
});
test('Motion control pauses and resumes with an accurate accessible label', () => {
  const {elements} = setup(); const button = elements['#motion'];
  button.handlers.click(); assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(button.attributes['aria-label'], 'Resume illustration motion');
  button.handlers.click(); assert.equal(button.attributes['aria-pressed'], 'false');
  assert.equal(button.attributes['aria-label'], 'Pause illustration motion');
});
test('Printing expands all details and restores the original reading state', () => {
  const state = setup();
  state.elements['#print'].handlers.click(); assert.equal(state.prints(), 1);
  state.events.beforeprint(); assert.deepEqual(state.details.map(d => d.open), [true, true]);
  state.events.afterprint(); assert.deepEqual(state.details.map(d => d.open), [true, false]);
});
