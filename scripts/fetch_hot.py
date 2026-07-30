"""
海盐葡萄 · 实时热搜抓取脚本
多源容错：微博 → 知乎 → 百度 → 头条，任一成功即采用
输出 hot.json，供 PWA 前端读取
"""
import json
import re
import time
import urllib.parse
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}


def fetch_weibo():
    """微博热搜榜"""
    try:
        r = requests.get('https://s.weibo.com/top/summary', headers=HEADERS, timeout=15, allow_redirects=True)
        r.encoding = 'utf-8'
        soup = BeautifulSoup(r.text, 'html.parser')
        items = []
        for tr in soup.select('table tbody tr'):
            td_rank = tr.select_one('td.td-01')
            td_content = tr.select_one('td.td-02 a')
            td_hot = tr.select_one('td.td-02 span')
            if td_content and td_content.get_text(strip=True):
                title = td_content.get_text(strip=True)
                if title and title != '更多':
                    hot = 0
                    if td_hot:
                        try:
                            hot = int(td_hot.get_text(strip=True))
                        except ValueError:
                            hot = 0
                    items.append({
                        'title': title,
                        'hot': hot,
                        'source': 'weibo',
                        'url': 'https://s.weibo.com' + td_content.get('href', '')
                    })
        if items:
            return items[:30], '微博'
    except Exception as e:
        print(f'微博失败: {e}')
    return None, None


def fetch_zhihu():
    """知乎热榜 API"""
    try:
        h = {**HEADERS, 'Referer': 'https://www.zhihu.com/hot'}
        r = requests.get('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30',
                         headers=h, timeout=15)
        data = r.json()
        items = []
        for d in data.get('data', []):
            target = d.get('target', {})
            title = target.get('title', '')
            if title:
                items.append({
                    'title': title,
                    'hot': d.get('detail_text', '').replace('万热度', '').strip() if d.get('detail_text') else 0,
                    'source': 'zhihu',
                    'url': f"https://www.zhihu.com/question/{target.get('id', '')}"
                })
        if items:
            return items[:30], '知乎'
    except Exception as e:
        print(f'知乎失败: {e}')
    return None, None


def fetch_baidu():
    """百度热搜"""
    try:
        r = requests.get('https://top.baidu.com/board?tab=realtime', headers=HEADERS, timeout=15)
        r.encoding = 'utf-8'
        soup = BeautifulSoup(r.text, 'html.parser')
        items = []
        for item in soup.select('div.c-single-text-clip'):
            title = item.get_text(strip=True)
            if title and len(title) > 1:
                items.append({
                    'title': title,
                    'hot': 0,
                    'source': 'baidu',
                    'url': ''
                })
        if items:
            return items[:30], '百度'
    except Exception as e:
        print(f'百度失败: {e}')
    return None, None


def fetch_toutiao():
    """今日头条热榜"""
    try:
        r = requests.get('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
                         headers=HEADERS, timeout=15)
        data = r.json()
        items = []
        for d in data.get('data', []):
            title = d.get('Title', '')
            if title:
                items.append({
                    'title': title,
                    'hot': d.get('HotValue', 0),
                    'source': 'toutiao',
                    'url': d.get('Url', '')
                })
        if items:
            return items[:30], '头条'
    except Exception as e:
        print(f'头条失败: {e}')
    return None, None


def main():
    print('开始抓取热搜...')
    items = None
    source_name = None

    # 按优先级尝试各源
    for fetcher in [fetch_weibo, fetch_zhihu, fetch_baidu, fetch_toutiao]:
        items, source_name = fetcher()
        if items:
            print(f'✅ {source_name} 成功，{len(items)} 条')
            break
        time.sleep(1)

    if not items:
        print('❌ 所有源都失败，使用兜底数据')
        items = [
            {'title': '今日热点加载中', 'hot': 0, 'source': 'fallback', 'url': ''},
        ]
        source_name = '兜底'

    output = {
        'source': source_name,
        'items': items,
        'updateTime': datetime.now(timezone.utc).isoformat(),
        'total': len(items)
    }

    with open('hot.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'已写入 hot.json，共 {len(items)} 条')


if __name__ == '__main__':
    main()
