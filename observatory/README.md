# The Observatory

Reading-first AI, physics and consulting desk at https://sahirvhora.github.io/observatory/.

## Read and return

- The daily three selects one story per topic. Recent editorial briefs take priority within three days of that topic's latest story.
- Explore all collected stories, filter by topic, or see stories first collected since the previous visit.
- Save full cards and reflection notes in browser local storage. These do not sync across devices.
- Open a card for a question, caution, original source, and optional browser read-aloud.
- Install from Chrome's menu on Android. The service worker retains the last opened edition for offline reading.
- Subscribe to `https://sahirvhora.github.io/observatory/feed.xml` in an RSS reader. The site itself does not send notifications.

## Sources and limitations

Eight public publisher feeds are collected. Feed descriptions are not full articles. The small editorial seed is paraphrased from feed descriptions, with its basis stated. Future entries display short publisher previews, not generated AI summaries. Questions and cross-topic connections are editorial prompts, not article findings. Source, publication date, source type, collection time, retained data, and stale editions are visible.

The collector supports RSS 2, RSS 1/RDF, and Atom. It discards undated, future-dated, and over-60-day items. Source failures retain dated data without pretending it refreshed. A complete collection failure exits nonzero without replacing the previous edition.

No API keys or paid services are required. Public sources and public code only. No analytics. Google Fonts is an external request. Voice availability and processing depend on the browser and device.

## Refresh

GitHub Actions runs at 06:17 and 17:17 UTC (07:17/18:17 BST, 06:17/17:17 GMT). Scheduled execution can be delayed. GitHub may disable scheduled workflows in inactive public repositories; inspect Actions if the freshness warning appears.

The workflow commits only the edition and RSS feed, then explicitly requests a Pages rebuild because commits made with `GITHUB_TOKEN` do not themselves trigger a Pages build. Manual refresh: GitHub repository > Actions > Refresh Observatory > Run workflow. The in-app refresh button fetches the current published edition; it does not invoke GitHub Actions.

## Local verification

From the repository root:

```sh
python3 -m unittest discover -s observatory/tests -v
node --check observatory/app.js
node --check observatory/sw.js
python3 observatory/scripts/collect.py
python3 -m http.server 8765
```

Open http://localhost:8765/observatory/.

Run the existing `.github/workflows/ci.yml` HTML/local-link check as well. No build dependencies are required.
