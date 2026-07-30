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

# 分类关键词词典
CATEGORY_RULES = [
    ('时政', ['全会', '中央', '国务院', '习近平', '主席', '总理', '书记', '反腐', '被查', '纪委', '监察', '两会', '人大', '政协', '政策', '外交', '访问', '会见', '外交部', '国防部', '政治局', '党中央', '改革开放', '治理', '党员', '干部']),
    ('经济', ['股市', 'A股', '基金', '经济', '消费', 'GDP', '房价', '楼市', '利率', '降息', '通胀', '金融', '银行', '资本', '市场', '投资', '外贸', '出口', '进口', '新能源', '芯片', '半导体', '科技股', '比特币', '数字货币', '内卷', '就业', '失业']),
    ('科技', ['AI', '人工智能', 'GPT', '大模型', '百度', '腾讯', '阿里', '华为', '小米', '苹果', '谷歌', '微软', 'OpenAI', '火箭', '卫星', '航天', '5G', '6G', '量子', '机器人', '自动驾驶', '芯片', '半导体', '光刻']),
    ('社会', ['地震', '洪水', '台风', '暴雨', '山体', '滑坡', '火灾', '事故', '遇难', '救援', '警方', '刑拘', '逮捕', '判决', '法院', '律师', '学生', '校园', '高校', '高考', '考研', '开学', '毕业', '医疗', '医院', '医生']),
    ('娱乐', ['剧', '综艺', '电影', '票房', '演唱会', '明星', '演员', '歌手', '偶像', '出道', '开播', '杀青', '官宣', '离婚', '结婚', '恋情', '八卦', '粉丝', '爱豆', '选秀']),
    ('体育', ['奥运', '亚运', '世界杯', 'NBA', 'CBA', '足球', '篮球', '乒乓球', '羽毛球', '游泳', '田径', '体操', '滑雪', '冠军', '决赛', '半决赛', '联赛', '欧冠', '英超', '中超', '选手', '运动员', '教练']),
    ('美妆', ['美妆', '护肤', '化妆', '口红', '粉底', '精华', '面膜', '防晒', '美白', '抗老', '医美', '整形', '美容', '穿搭', '时尚', '品牌', '限定', '联名', '香水']),
    ('新媒体', ['短视频', '直播', '抖音', '快手', 'B站', '小红书', '微博', '热搜', '网红', '主播', 'UP主', '博主', '流量', '爆款', '出圈']),
]


def categorize(title):
    """根据标题关键词自动分类"""
    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in title:
                return category
    return '热点'


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
                        'url': 'https://s.weibo.com' + td_content.get('href', ''),
                        'category': categorize(title)
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
                    'url': f"https://www.zhihu.com/question/{target.get('id', '')}",
                    'category': categorize(title)
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
                    'url': '',
                    'category': categorize(title)
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
                    'url': d.get('Url', ''),
                    'category': categorize(title)
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
            {'title': '今日热点加载中', 'hot': 0, 'source': 'fallback', 'url': '', 'category': '热点'},
        ]
        source_name = '兜底'

    now = datetime.now(timezone.utc)
    output = {
        'source': source_name,
        'updated': now.strftime('%Y-%m-%d %H:%M UTC'),
        'items': items,
        'updateTime': now.isoformat(),
        'total': len(items)
    }

    with open('hot.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'已写入 hot.json，共 {len(items)} 条')


if __name__ == '__main__':
    main()
