#!/usr/bin/env python3
"""Build a public, source-attributed reading edition. Python standard library only."""
import concurrent.futures
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
SOURCES = [
    ('OpenAI', 'ai', 'https://openai.com/news/rss.xml', 'Company announcement'),
    ('Google DeepMind', 'ai', 'https://deepmind.google/blog/rss.xml', 'Company research'),
    ('Hugging Face', 'ai', 'https://huggingface.co/blog/feed.xml', 'Community / technical'),
    ('MIT Physics', 'physics', 'https://news.mit.edu/rss/topic/physics', 'University reporting'),
    ('APS Physics', 'physics', 'https://feeds.aps.org/rss/recent/physics.xml', 'Research commentary'),
    ('McKinsey', 'consulting', 'https://www.mckinsey.com/insights/rss', 'Consulting perspective'),
    ('MIT Sloan Management Review', 'consulting', 'https://sloanreview.mit.edu/feed/', 'Management perspective'),
    ('SAP News', 'consulting', 'https://news.sap.com/feed/', 'Company announcement'),
]


def clean(value):
    value = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', value or '', flags=re.I | re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value))).strip()


def parse_date(value):
    if not value:
        return None
    try:
        result = email.utils.parsedate_to_datetime(value)
    except (ValueError, TypeError):
        try:
            result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            try:
                result = datetime.strptime(value, '%a, %d %b %Y')
            except ValueError:
                return None
    return result.replace(tzinfo=UTC) if result.tzinfo is None else result.astimezone(UTC)


def canonical_url(value):
    parsed = urllib.parse.urlsplit(value.strip())
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username:
        return None
    query = [(k, v) for k, v in urllib.parse.parse_qsl(parsed.query) if not k.startswith('utm_')]
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(query), ''))


def parse_feed(body, source, now):
    name, category, _, evidence = source
    root = ET.fromstring(body)
    # RSS 2, Atom, and RSS 1 (RDF) use different namespaces.
    items = [node for node in root.iter() if node.tag.rsplit('}', 1)[-1] in ('item', 'entry')]
    result = []
    for item in items:
        fields = {}
        for node in item:
            key = node.tag.rsplit('}', 1)[-1]
            if key == 'link' and node.get('href') and node.get('rel', 'alternate') == 'alternate':
                fields['link'] = node.get('href')
            elif node.text and key not in fields:
                fields[key] = node.text
        title = clean(fields.get('title'))
        url = canonical_url(fields.get('link', ''))
        date = parse_date(fields.get('pubDate') or fields.get('published') or fields.get('date') or fields.get('updated'))
        if not title or not url or not date or date > now + timedelta(minutes=5) or date < now - timedelta(days=60):
            continue
        # Topic feeds can contain institution news unrelated to physics.
        if category == 'physics' and not re.search(r'physic|quantum|neutrino|particle|atom|cosmo|universe|gravit|photon|electron|magnet|superconduct|fusion|black hole|dark matter|nuclear|laser', title, re.I):
            continue
        description = clean(fields.get('description') or fields.get('summary') or fields.get('encoded'))
        # Short publisher preview, explicitly identified as an excerpt in the UI.
        budget = max(0, 25 - len(title.split()))
        words = description.split()
        excerpt = ' '.join(words[:budget]) + ('…' if len(words) > budget and budget else '')
        result.append(dict(id=hashlib.sha256(url.encode()).hexdigest()[:16], title=title, url=url,
                           category=category, source=name, evidence=evidence,
                           published=date.isoformat(), excerpt=excerpt))
    return sorted(result, key=lambda item: item['published'], reverse=True)[:7]


def fetch(source, now):
    request = urllib.request.Request(source[2], headers={'User-Agent': 'Observatory/1.0 (+https://sahirvhora.github.io/observatory/)'})
    with urllib.request.urlopen(request, timeout=25) as response:
        body = response.read(5_000_001)
    if len(body) > 5_000_000:
        raise ValueError('Feed exceeded size limit')
    entries = parse_feed(body, source, now)
    if not entries:
        raise ValueError('No eligible dated stories within 60 days')
    return entries


def build():
    now = datetime.now(UTC)
    output = ROOT / 'data/edition.json'
    previous = json.loads(output.read_text()) if output.exists() else {'stories': []}
    editorial = json.loads((ROOT / 'data/editorial.json').read_text())
    statuses, stories = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        tasks = {pool.submit(fetch, source, now): source for source in SOURCES}
        for task in concurrent.futures.as_completed(tasks):
            source = tasks[task]
            try:
                entries = task.result()
                for entry in entries:
                    entry['firstSeen'] = next((p.get('firstSeen', p['published']) for p in previous['stories'] if p['id'] == entry['id']), now.isoformat())
                stories.extend(entries)
                statuses.append(dict(name=source[0], category=source[1], url=source[2], ok=True, count=len(entries)))
            except Exception as exc:
                # Keep dated last-known data and explicitly mark it as retained.
                retained = [dict(p, retained=True) for p in previous['stories'] if p['source'] == source[0]
                            and parse_date(p['published']) >= now - timedelta(days=60)]
                stories.extend(retained)
                statuses.append(dict(name=source[0], category=source[1], url=source[2], ok=False, count=len(retained), error=type(exc).__name__))
                print(f'{source[0]}: unavailable ({type(exc).__name__}); retained {len(retained)}', file=sys.stderr)
    if not any(s['ok'] for s in statuses):
        raise SystemExit('No source refreshed; preserve previous edition and fail visibly.')
    unique = {}
    for story in stories:
        if story['url'] in editorial:
            story['brief'] = editorial[story['url']]
        unique.setdefault(story['url'], story)
    stories = sorted(unique.values(), key=lambda item: item['published'], reverse=True)
    edition = dict(version=1, updatedAt=now.isoformat(), sources=sorted(statuses, key=lambda s: s['name']), stories=stories)
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(edition, ensure_ascii=False, indent=2) + '\n')
    create_rss(stories, now)
    print(f'Collected {len(stories)} stories from {sum(s["ok"] for s in statuses)}/{len(statuses)} sources.')


def create_rss(stories, now):
    rss = ET.Element('rss', version='2.0')
    channel = ET.SubElement(rss, 'channel')
    for key, value in [('title', 'The Observatory'), ('link', 'https://sahirvhora.github.io/observatory/'),
                       ('description', 'AI, physics and consulting. A small daily reading ritual.'),
                       ('lastBuildDate', email.utils.format_datetime(now))]:
        ET.SubElement(channel, key).text = value
    for story in stories:
        item = ET.SubElement(channel, 'item')
        for key, value in [('title', story['title']), ('link', story['url']), ('guid', story['url']),
                           ('pubDate', email.utils.format_datetime(parse_date(story['published']))),
                           ('description', story.get('brief', {}).get('summary') or story['excerpt']),
                           ('category', story['category'])]:
            ET.SubElement(item, key).text = value
    ET.indent(rss)
    ET.ElementTree(rss).write(ROOT / 'feed.xml', encoding='utf-8', xml_declaration=True)


if __name__ == '__main__':
    build()
