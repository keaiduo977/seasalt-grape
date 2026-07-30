#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海盐葡萄 · 剧集热播抓取脚本
数据源：豆瓣电影热门榜（电影/电视剧/综艺/纪录片）
输出 drama.json，供 PWA 前端读取
多源容错：豆瓣 → 兜底静态数据（保证 PWA 始终有内容）
"""
import json
import time
import random
import sys
import os
from datetime import datetime
import urllib.request
import urllib.parse

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://movie.douban.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

# 豆瓣非官方搜索接口（公开可访问）
ENDPOINTS = [
    ('https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&page_limit=15&page_start=0', '电影', '电影'),
    ('https://movie.douban.com/j/search_subjects?type=tv&tag=%E7%83%AD%E9%97%A8&page_limit=15&page_start=0', '电视剧', '热播剧'),
    ('https://movie.douban.com/j/search_subjects?type=tv&tag=%E7%BB%BC%E8%89%BA&page_limit=10&page_start=0', '综艺', '综艺'),
    ('https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%BA%AA%E5%BD%95%E7%89%87&page_limit=10&page_start=0', '纪录片', '纪录片'),
]

# 兜底数据（抓取失败时使用，保证前端有内容）
FALLBACK = [
    {'title': '我的阿勒泰', 'type': '电视剧', 'category': '国产剧', 'rating': 8.8, 'url': 'https://movie.douban.com/', 'summary': '改编自李娟散文集，讲述女孩李文秀在新疆阿勒泰与母亲相依生活，在广袤自然中重新认识自我与亲情的治愈故事。'},
    {'title': '庆余年第二季', 'type': '电视剧', 'category': '国产剧', 'rating': 7.2, 'url': 'https://movie.douban.com/', 'summary': '范闲重返京都，在朝堂与江湖间周旋，权谋与幽默交织的架空历史传奇续作。'},
    {'title': '玫瑰的故事', 'type': '电视剧', 'category': '国产剧', 'rating': 7.4, 'url': 'https://movie.douban.com/', 'summary': '改编自亦舒同名小说，讲述女孩黄玫瑰从青涩到成熟的情感成长史，探讨女性在爱情与自我间的抉择。'},
    {'title': '繁花', 'type': '电视剧', 'category': '国产剧', 'rating': 8.4, 'url': 'https://movie.douban.com/', 'summary': '王家卫执导，胡歌主演，讲述90年代上海黄河路上商界浮沉与时代记忆，镜头美学极致。'},
    {'title': ' stranger things 怪奇物语', 'type': '电视剧', 'category': '美剧', 'rating': 8.6, 'url': 'https://movie.douban.com/', 'summary': '一群孩子在小镇霍金斯遭遇超自然力量与平行世界，友情与勇气对抗未知的经典科幻惊悚美剧。'},
    {'title': '甄嬛传', 'type': '电视剧', 'category': '国产剧', 'rating': 9.4, 'url': 'https://movie.douban.com/', 'summary': '孙俪主演清宫大剧，少女甄嬛入宫从天真到权倾后宫的跌宕人生，台词与表演封神。'},
    {'title': '年会不能停', 'type': '电影', 'category': '电影', 'rating': 8.1, 'url': 'https://movie.douban.com/', 'summary': '大厂裁员背景下的黑色幽默喜剧，打工人嘴替式槽点密集，笑中带泪。'},
    {'title': '宇宙探索编辑部', 'type': '电影', 'category': '电影', 'rating': 8.4, 'url': 'https://movie.douban.com/', 'summary': '伪纪录片风格科幻喜剧，落魄科幻杂志主编踏上寻找外星文明的荒诞旅途，浪漫又荒诞。'},
    {'title': '声生不息', 'type': '综艺', 'category': '综艺', 'rating': 8.0, 'url': 'https://movie.douban.com/', 'summary': '港乐竞唱音综，新老歌手重新演绎经典粤语金曲，唤起一代人的青春记忆。'},
    {'title': '种地吧', 'type': '综艺', 'category': '综艺', 'rating': 8.9, 'url': 'https://movie.douban.com/', 'summary': '十位年轻人真实耕耘万亩土地的劳作纪实综艺，汗水与土地治愈内卷心灵。'},
    {'title': '地球脉动 II', 'type': '纪录片', 'category': '纪录片', 'rating': 9.8, 'url': 'https://movie.douban.com/', 'summary': 'BBC神级自然纪录片，4K镜头记录地球极致地貌与生命奇迹，每一帧都是壁纸。'},
    {'title': '人生一串', 'type': '纪录片', 'category': '纪录片', 'rating': 9.0, 'url': 'https://movie.douban.com/', 'summary': '市井烧烤江湖的美食纪录片，烟火气与人情味交织，深夜慎看容易饿。'},
]


def fetch(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            print(f'  retry {i+1}: {e}', file=sys.stderr)
            time.sleep(2 + random.random() * 3)
    return None


def collect(url, dtype, default_cat):
    j = fetch(url)
    items = []
    if not j or not j.get('subjects'):
        return items
    for s in j['subjects']:
        rate = s.get('rate') or ''
        items.append({
            'title': s.get('title', '').strip(),
            'type': dtype,
            'category': default_cat,
            'rating': float(rate) if rate else 0,
            'url': s.get('url', ''),
            'summary': s.get('card_subtitle', '') or '',
            'source': '豆瓣',
        })
        time.sleep(0.3 + random.random() * 0.5)
    return items


def main():
    print('Fetching douban drama data...')
    items = []
    for url, dtype, cat in ENDPOINTS:
        print(f'  -> {dtype}/{cat}')
        items += collect(url, dtype, cat)
        time.sleep(1 + random.random() * 2)

    # 去重（按标题）
    seen, uniq = set(), []
    for it in items:
        if it['title'] and it['title'] not in seen:
            seen.add(it['title'])
            uniq.append(it)

    if not uniq:
        print('WARN: all fetch failed, using fallback', file=sys.stderr)
        uniq = FALLBACK

    out = {
        'source': '豆瓣',
        'updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'items': uniq[:40],
    }
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drama.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'OK: wrote {len(uniq)} items to drama.json')


if __name__ == '__main__':
    main()
