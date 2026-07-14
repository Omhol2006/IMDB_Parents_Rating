import time
import random
import re
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

# ---------------------------------------------------------------------------
# Shared HTTP sessions
# ---------------------------------------------------------------------------
SUGGEST_SESSION = requests.Session()
SUGGEST_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
})

GQL_SESSION = requests.Session()
GQL_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/json',
    'x-imdb-client-name': 'imdb-web-next-localized',
    'x-imdb-user-language': 'en-US',
    'x-imdb-user-country': 'US',
})

LB_SESSION = requests.Session()
LB_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
})

RATING_ORDER = {'none': 0, 'mild': 1, 'moderate': 2, 'severe': 3, 'heavy': 3, 'n/a': -1, 'unknown': -1}

CATEGORY_KEY_MAP = {
    'NUDITY':      'nudity',
    'VIOLENCE':    'violence',
    'PROFANITY':   'profanity',
    'ALCOHOL':     'alcohol',
    'FRIGHTENING': 'frightening',
}

CATEGORY_LABEL_MAP = {
    'nudity':      'Sex & Nudity',
    'violence':    'Violence & Gore',
    'profanity':   'Profanity',
    'alcohol':     'Alcohol, Drugs & Smoking',
    'frightening': 'Frightening & Intense Scenes',
}

IMDB_GQL_URL = 'https://api.graphql.imdb.com/'
IMDB_SUGGEST_URL = 'https://v3.sg.media-imdb.com/suggestion/x/{query}.json'

def _sleep():
    time.sleep(random.uniform(0.1, 0.3))


# ---------------------------------------------------------------------------
# IMDb Suggest (Search)
# ---------------------------------------------------------------------------
def search_imdb(title):
    """Use IMDb's autocomplete/suggest API to search for a title."""
    query_encoded = title.lower().replace(' ', '+')
    url = IMDB_SUGGEST_URL.format(query=requests.utils.quote(query_encoded))

    try:
        _sleep()
        resp = SUGGEST_SESSION.get(url, timeout=10)
        if resp.status_code != 200:
            return []

        data = resp.json()
        results = []
        for item in data.get('d', []):
            # Only include movies, TV series, TV movies
            qid = item.get('qid', '')
            if qid not in ('movie', 'tvSeries', 'tvMovie', 'tvMiniSeries', 'short', 'tvSpecial', 'video', 'tvShort'):
                continue

            img = item.get('i', {})
            poster = img.get('imageUrl', '') if img else ''
            # Use crop URL for a smaller thumbnail
            if poster:
                poster = poster.split('._V1_')[0] + '._V1_UX80_CR0,2,80,116_.jpg'

            results.append({
                'imdbId': item.get('id', ''),
                'title': item.get('l', ''),
                'year': str(item.get('y', '')),
                'type': _humanize_type(qid),
                'cast': item.get('s', ''),
                'poster': poster,
            })

        return results[:10]
    except Exception as e:
        print(f"Search error: {e}")
        return []


def _humanize_type(qid):
    mapping = {
        'movie':         'Movie',
        'tvSeries':      'TV Series',
        'tvMiniSeries':  'Mini-Series',
        'tvMovie':       'TV Movie',
        'short':         'Short',
        'tvSpecial':     'TV Special',
        'video':         'Video',
        'tvShort':       'TV Short',
    }
    return mapping.get(qid, qid)


# ---------------------------------------------------------------------------
# IMDb Parental Guide via GraphQL
# ---------------------------------------------------------------------------
PARENTAL_GUIDE_QUERY = """query GetParentsGuide($id: ID!) {
  title(id: $id) {
    id
    titleText { text }
    releaseYear { year }
    primaryImage { url }
    parentsGuide {
      categories {
        category { id text }
        severity { id text }
        guideItems(first: 50) {
          edges {
            node {
              text { plainText }
            }
          }
        }
      }
    }
  }
}"""


def _normalize_rating(severity_text):
    """Normalize severity text from IMDb GraphQL to a clean label."""
    if not severity_text:
        return 'Unknown'
    t = severity_text.lower()
    if 'none' in t:   return 'None'
    if 'mild' in t:   return 'Mild'
    if 'moderate' in t: return 'Moderate'
    if 'severe' in t or 'heavy' in t or 'strong' in t or 'graphic' in t: return 'Severe'
    return severity_text.strip().title()  # Return as-is but title-cased


def get_parental_guide(imdb_id):
    """Fetch parental guide via IMDb GraphQL API."""
    try:
        _sleep()
        resp = GQL_SESSION.post(
            IMDB_GQL_URL,
            json={'query': PARENTAL_GUIDE_QUERY, 'variables': {'id': imdb_id}},
            timeout=15
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        title_data = data.get('data', {}).get('title')
        if not title_data:
            return None

        title_text = title_data.get('titleText', {}).get('text', '')
        year = title_data.get('releaseYear', {}).get('year', '')
        poster = title_data.get('primaryImage', {}).get('url', '')
        if poster:
            poster = poster.split('._V1_')[0] + '._V1_UX80_CR0,2,80,116_.jpg'

        categories_raw = title_data.get('parentsGuide', {}).get('categories', [])
        categories = {}

        for cat in categories_raw:
            cat_id = cat.get('category', {}).get('id', '')
            key = CATEGORY_KEY_MAP.get(cat_id, cat_id.lower())
            label = cat.get('category', {}).get('text', '') or CATEGORY_LABEL_MAP.get(key, key)
            severity_text = cat.get('severity', {}).get('text', '') if cat.get('severity') else ''
            rating = _normalize_rating(severity_text)

            descriptions = []
            for edge in cat.get('guideItems', {}).get('edges', []):
                text = edge.get('node', {}).get('text', {}).get('plainText', '')
                if text:
                    descriptions.append(text)

            categories[key] = {
                'label': label,
                'rating': rating,
                'descriptions': descriptions,
            }

        # Ensure all 5 categories exist (fill missing ones)
        for key, label in CATEGORY_LABEL_MAP.items():
            if key not in categories:
                categories[key] = {'label': label, 'rating': 'Unknown', 'descriptions': []}

        return {
            'imdbId': imdb_id,
            'title': title_text,
            'year': str(year) if year else '',
            'poster': poster,
            'imdbUrl': f'https://www.imdb.com/title/{imdb_id}/',
            'parentalGuideUrl': f'https://www.imdb.com/title/{imdb_id}/parentalguide',
            'categories': categories,
        }

    except Exception as e:
        print(f"Parental guide error for {imdb_id}: {e}")
        return None


# ---------------------------------------------------------------------------
# Letterboxd Scraper
# ---------------------------------------------------------------------------
def scrape_letterboxd_list(list_url):
    """Scrape all film slugs from a Letterboxd list (handles pagination).
    Supports: /username/list/list-name/, /username/watchlist/, /username/films/
    """
    from bs4 import BeautifulSoup

    base_url = list_url.rstrip('/')
    # Strip sort/display suffixes
    for suffix in ['/detail', '/grid', '/by/entry-rating', '/by/rating',
                   '/by/release', '/by/title', '/by/added', '/by/shuffle']:
        if base_url.endswith(suffix):
            base_url = base_url[:-len(suffix)]

    films = []
    seen_slugs = set()
    page = 1

    while True:
        page_url = f"{base_url}/page/{page}/" if page > 1 else f"{base_url}/"
        try:
            _sleep()
            resp = LB_SESSION.get(page_url, timeout=15)

            if resp.status_code == 404 and page > 1:
                break
            if resp.status_code not in (200,):
                print(f"Letterboxd status {resp.status_code} on page {page}")
                break

            soup = BeautifulSoup(resp.text, 'html.parser')

            # NEW (2024+): react-component divs with data-target-link="/film/slug/"
            film_items = soup.select('[data-target-link*="/film/"]')

            # LEGACY fallback: data-film-slug attribute
            if not film_items:
                film_items = soup.select('[data-film-slug]')

            if not film_items:
                if page == 1:
                    print(f"No film items found at {page_url}")
                break

            found_new = False
            for item in film_items:
                # Extract slug from data-target-link (new) or data-film-slug (old)
                target_link = item.get('data-target-link', '')
                if target_link:
                    m = re.match(r'^/film/([^/]+)/?$', target_link)
                    slug = m.group(1) if m else ''
                else:
                    slug = item.get('data-film-slug', '').strip()

                if not slug or slug in seen_slugs:
                    continue

                # Get title from img alt text
                img = item.find('img')
                title = img.get('alt', '').strip() if img else ''
                if not title:
                    span = item.find('span', class_=re.compile(r'frame-title|film-title'))
                    title = span.get_text(strip=True) if span else ''
                if not title:
                    title = slug.replace('-', ' ').title()

                films.append({'slug': slug, 'title': title})
                seen_slugs.add(slug)
                found_new = True

            if not found_new:
                break

            # Check for next page
            next_page_el = soup.select_one('a.next, li.next a')
            if not next_page_el:
                break

            page += 1
            if page > 50:
                break

        except Exception as e:
            print(f"Error scraping Letterboxd page {page}: {e}")
            break

    return films


def get_imdb_id_from_letterboxd(slug):

    """Visit the Letterboxd film page and extract the IMDb link."""
    from bs4 import BeautifulSoup

    url = f"https://letterboxd.com/film/{slug}/"
    try:
        _sleep()
        resp = LB_SESSION.get(url, timeout=12)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        # IMDb link in sidebar
        imdb_link = soup.find('a', href=re.compile(r'imdb\.com/title/(tt\d+)'))
        if imdb_link:
            match = re.search(r'imdb\.com/title/(tt\d+)', imdb_link.get('href', ''))
            if match:
                return match.group(1)

        # Try meta tags or script tags
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '{}')
                same_as = data.get('sameAs', [])
                if isinstance(same_as, list):
                    for link in same_as:
                        match = re.search(r'imdb\.com/title/(tt\d+)', link)
                        if match:
                            return match.group(1)
                elif isinstance(same_as, str):
                    match = re.search(r'imdb\.com/title/(tt\d+)', same_as)
                    if match:
                        return match.group(1)
            except Exception:
                pass

        # Search text for IMDb ID pattern as last resort
        match = re.search(r'imdb\.com/title/(tt\d+)', resp.text)
        if match:
            return match.group(1)

        return None
    except Exception as e:
        print(f"Error getting IMDb ID for {slug}: {e}")
        return None


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/search')
def api_search():
    title = request.args.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    try:
        results = search_imdb(title)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/parental-guide')
def api_parental_guide():
    imdb_id = request.args.get('imdbId', '').strip()
    if not imdb_id or not re.match(r'^tt\d+$', imdb_id):
        return jsonify({'error': 'Valid IMDb ID (e.g. tt1234567) is required'}), 400

    try:
        data = get_parental_guide(imdb_id)
        if not data:
            return jsonify({'error': 'Could not fetch parental guide. Try again in a moment.'}), 503
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/letterboxd-list', methods=['POST'])
def api_letterboxd_list():
    body = request.get_json(force=True, silent=True) or {}
    list_url = body.get('url', '').strip()

    if not list_url or 'letterboxd.com' not in list_url:
        return jsonify({'error': 'A valid Letterboxd list URL is required'}), 400

    try:
        films = scrape_letterboxd_list(list_url)
        if not films:
            return jsonify({'error': 'No films found. Make sure the list URL is correct and the list is public.'}), 404
        return jsonify({'films': films, 'total': len(films)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/letterboxd-film-guide', methods=['POST'])
def api_letterboxd_film_guide():
    """Get parental guide for a single Letterboxd film slug."""
    body = request.get_json(force=True, silent=True) or {}
    slug = body.get('slug', '').strip()
    title = body.get('title', slug)

    if not slug:
        return jsonify({'error': 'Slug is required'}), 400

    imdb_id = None
    error_msg = None

    try:
        imdb_id = get_imdb_id_from_letterboxd(slug)
    except Exception as e:
        error_msg = str(e)

    if not imdb_id:
        return jsonify({
            'slug': slug,
            'title': title,
            'imdbId': None,
            'error': error_msg or 'IMDb ID not found on Letterboxd',
            'categories': {k: {'label': v, 'rating': 'Unknown', 'descriptions': []}
                           for k, v in CATEGORY_LABEL_MAP.items()},
        })

    guide = None
    try:
        guide = get_parental_guide(imdb_id)
    except Exception as e:
        error_msg = str(e)

    if not guide:
        return jsonify({
            'slug': slug,
            'title': title,
            'imdbId': imdb_id,
            'error': error_msg or 'Could not fetch parental guide from IMDb',
            'categories': {k: {'label': v, 'rating': 'Unknown', 'descriptions': []}
                           for k, v in CATEGORY_LABEL_MAP.items()},
        })

    guide['slug'] = slug
    if not guide.get('title'):
        guide['title'] = title

    return jsonify(guide)


if __name__ == '__main__':
    print("=" * 60)
    print("  CineGuard Server Starting...")
    print("  Open http://localhost:5000 in your browser")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=False)
