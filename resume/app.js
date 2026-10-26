'use strict';
const visual = document.querySelector('.visual');
const focusContent = {
  data: ['01 / DATA FOUNDATIONS', 'Trusted data. Confident decisions.'],
  people: ['02 / PEOPLE & PURPOSE', 'Human needs shape better systems.'],
  systems: ['03 / CONNECTED SYSTEMS', 'Architecture that supports real work.']
};
document.querySelectorAll('[data-focus]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-focus]').forEach(node => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    const [label, copy] = focusContent[button.dataset.focus];
    document.querySelector('#focus-label').textContent = label;
    document.querySelector('#focus-copy').textContent = copy;
  });
});
const motion = document.querySelector('#motion');
motion.addEventListener('click', () => {
  const paused = visual.classList.toggle('paused');
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute('aria-label', paused ? 'Resume illustration motion' : 'Pause illustration motion');
  motion.textContent = paused ? '▷' : 'Ⅱ';
});
document.querySelector('#print').addEventListener('click', () => window.print());
// Expand role details for print, then restore the reader's previous choices.
let detailStates = [];
window.addEventListener('beforeprint', () => {
  detailStates = [...document.querySelectorAll('details')].map(detail => [detail, detail.open]);
  detailStates.forEach(([detail]) => { detail.open = true; });
});
window.addEventListener('afterprint', () => {
  detailStates.forEach(([detail, open]) => { detail.open = open; });
});
if ('IntersectionObserver' in window) {
  const links = [...document.querySelectorAll('nav a')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
}
