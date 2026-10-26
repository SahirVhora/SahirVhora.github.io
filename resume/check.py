"""Validate local resume assets, anchors, content boundaries and link hygiene."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []
        self.headings = 0
        self.roles = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        self.headings += tag == 'h1'
        self.roles += tag == 'article' and 'career' in attrs.get('class', '').split()
        if tag == 'img':
            assert attrs.get('alt'), 'Image needs meaningful alternative text'
        if attrs.get('target') == '_blank':
            assert 'noopener' in attrs.get('rel', ''), 'New tabs must be isolated'
        for key in ('src', 'href'):
            if key in attrs:
                self.refs.append(attrs[key])

page = Page()
source = (ROOT / 'index.html').read_text()
page.feed(source)
assert len(page.ids) == len(set(page.ids)), 'Duplicate IDs'
assert page.headings == 1, 'Expected one primary heading'
assert page.roles == 7, 'Expected seven supplied employment roles'
for ref in page.refs:
    parsed = urlparse(ref)
    if parsed.scheme:
        assert parsed.scheme == 'https', f'Unexpected external scheme: {ref}'
    elif ref.startswith('#'):
        assert ref[1:] in page.ids, f'Broken section anchor: {ref}'
    else:
        assert (ROOT / unquote(parsed.path)).exists(), f'Missing local asset: {ref}'
assert 'JAN 2022 - AUG 2024' in source
assert 'AUG 2024 - PRESENT' in source
assert 'AUG 2025' not in source
assert 'prefers-reduced-motion' in (ROOT / 'style.css').read_text()
assert '@media print' in (ROOT / 'style.css').read_text()
print(f'PASS: {len(page.refs)} links/assets, {len(page.ids)} IDs, seven roles, corrected dates, print and reduced-motion styles')
