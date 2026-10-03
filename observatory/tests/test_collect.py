import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('collect', Path(__file__).resolve().parents[1] / 'scripts/collect.py')
collect = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collect)
NOW = datetime(2026, 10, 3, tzinfo=timezone.utc)
SOURCE = ('Test', 'ai', 'https://example.com/feed', 'Test source')


class FeedTests(unittest.TestCase):
    def test_dates_and_missing_time(self):
        self.assertEqual(collect.parse_date('Fri, 02 Oct 2026').day, 2)
        self.assertEqual(collect.parse_date('2026-10-02T03:00:00Z').hour, 3)
        self.assertIsNone(collect.parse_date('not a date'))

    def test_untrusted_links(self):
        self.assertIsNone(collect.canonical_url('javascript:alert(1)'))
        self.assertIsNone(collect.canonical_url('https://user:pass@example.com/'))
        self.assertEqual(collect.canonical_url('https://example.com/a?utm_source=x&id=1#top'), 'https://example.com/a?id=1')

    def test_rss_filters_future_missing_and_old_dates(self):
        body = '<rss><channel>' + ''.join(f'<item><title>{name}</title><link>https://example.com/{name}</link><pubDate>{date}</pubDate><description>&lt;b&gt;A short description&lt;/b&gt;</description></item>' for name,date in [('recent','Fri, 02 Oct 2026'),('future','Sun, 04 Oct 2026'),('old','Thu, 01 Jan 2026'),('missing','')]) + '</channel></rss>'
        items = collect.parse_feed(body, SOURCE, NOW)
        self.assertEqual([i['title'] for i in items], ['recent'])
        self.assertNotIn('<', items[0]['excerpt'])

    def test_rdf_and_atom(self):
        rdf = '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>RDF story</title><link>https://example.com/rdf</link><dc:date>2026-10-02T00:00:00Z</dc:date></item></rdf:RDF>'
        atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story</title><link href="https://example.com/atom"/><updated>2026-10-02T00:00:00Z</updated><summary>Summary</summary></entry></feed>'
        self.assertEqual(len(collect.parse_feed(rdf, SOURCE, NOW)), 1)
        self.assertEqual(len(collect.parse_feed(atom, SOURCE, NOW)), 1)

    def test_physics_feed_relevance(self):
        body = '<rss><channel><item><title>University podcast</title><link>https://example.com/podcast</link><pubDate>Fri, 02 Oct 2026</pubDate></item><item><title>Neutrino experiment</title><link>https://example.com/neutrinos</link><pubDate>Fri, 02 Oct 2026</pubDate></item></channel></rss>'
        items = collect.parse_feed(body, ('MIT','physics','','University reporting'), NOW)
        self.assertEqual([i['title'] for i in items], ['Neutrino experiment'])

if __name__ == '__main__':
    unittest.main()
