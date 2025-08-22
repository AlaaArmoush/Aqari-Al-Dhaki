from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
import pandas as pd
import time
import re

eastern_to_western_map = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')

def transform_price(price_text):
    if not price_text: return None
    price_text = price_text.translate(eastern_to_western_map)
    m = re.search(r"([\d,]+)\s*شيكل", price_text)
    return m.group(1) if m else None

def transform_floor(floor_text):
    if not floor_text: return None
    floor_text = floor_text.translate(eastern_to_western_map)
    floor_map = {
        'ارضي': 'G', 'الأرضي': 'G', 'روف': 'R', 'أخير': 'R',
        'تسوية': 'B', 'سفلي': 'B', 'بيسمنت': 'B', 'مواقف': 'P'
    }
    for key, value in floor_map.items():
        if key in floor_text: return value
    number_map = {
        'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5,
        'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10
    }
    for key, value in number_map.items():
        if key in floor_text: return value
    digits = re.search(r'\d+', floor_text)
    if digits: return int(digits.group(0))
    return floor_text

def transform_rooms_bathrooms(text):
    if not text: return None
    western_text = text.translate(eastern_to_western_map)
    digits = re.search(r'\d+', western_text)
    if digits:
        return int(digits.group(0))
    if "حمامين" in text or "غرفتين" in text: return 2
    if "حمام" in text or "غرفة" in text: return 1
    if "أكثر من" in text or "+" in text: return 6
    return text

def transform_age(age_text):
    if not age_text: return None
    age_text = age_text.translate(eastern_to_western_map)
    age_map = {
        "جديد": 0, "قيد الإنشاء": 0, "0 - 11 شهر": 1,
        "1 - 5 سنوات": 2, "6 - 9 سنوات": 3, "10 - 19 سنوات": 4, "20+ سنة": 5
    }
    if age_text in age_map:
        return age_map[age_text]
    digits = re.search(r'\d+', age_text)
    if digits:
        num_age = int(digits.group(0))
        if num_age == 0: return 0
        if num_age >= 1 and num_age <= 5: return 2
        if num_age >= 6 and num_age <= 9: return 3
        if num_age >= 10 and num_age <= 19: return 4
        if num_age >= 20: return 5
        if num_age in [0, 1, 2, 3, 4, 5]: return num_age
    return age_text

def transform_payment(payment_text):
    if not payment_text: return 0
    payment_map = {
        "كاش": 0, "تقسيط": 1, "اقساط": 1,
        "كاش أو أقساط": 2, "كاش واقساط": 2
    }
    return payment_map.get(payment_text, 0)

def transform_furnished(furnished_text):
    if not furnished_text: return 0
    furnished_map = {
        "غير مفروشة": 0, "مفروشة": 1, "مفروش جزئياً": 2
    }
    return furnished_map.get(furnished_text, 0)

def transform_mortgaged(mortgaged_text):
    if not mortgaged_text: return 'F'
    return 'F' if mortgaged_text == "لا" else 'T'

# --- Main Scraper ---
options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
driver = webdriver.Chrome(service=Service(), options=options)

base_list_url = "https://ps.opensooq.com/ar/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA/%D8%B4%D9%82%D9%82-%D9%84%D9%84%D8%A8%D9%8A%D8%B9?sort_code=recent&page="
base_site = "https://ps.opensooq.com"

pages_num = 4  # Set the number of pages to scrape
apts_data = []

for page in range(1, pages_num + 1):
    print(f"Loading listing page {page}")
    driver.get(f"{base_list_url}{page}")
    time.sleep(3)
    soup = BeautifulSoup(driver.page_source, "html.parser")
    cards = soup.select("a.postListItemData")
    print(f"Found {len(cards)} cards on page {page}")
    
    for c in cards:
        price_element = c.select_one("div.priceColor")
        apts_data.append({
            "price_raw": price_element.getText(strip=True) if price_element else None,
            "details_url": base_site + c["href"]
        })

full_data = []
for apt in apts_data:
    if not apt.get("details_url"): continue
    driver.get(apt["details_url"])
    print(f"Scraping {apt['details_url']}...")
    time.sleep(3)
    details_soup = BeautifulSoup(driver.page_source, "html.parser")
    info_ul = details_soup.select_one("section#PostViewInformation ul.flex.flexSpaceBetween.flexWrap.mt-8")
    
    raw_info = {
        "city": None, "neighborhood": None, "num_rooms": None, "num_bathrooms": None,
        "furnished": None, "area": None, "floor": None, "age": None,
        "mortgaged": None, "payment": None, "extras": None
    }
    
    if info_ul:
        for li in info_ul.select("li"):
            label_el = li.select_one("p")
            if not label_el: continue
            label = label_el.get_text(strip=True)
            value_el = label_el.find_next_sibling(["a", "span"])
            if not value_el: continue
            value = value_el.get_text(strip=True)
            label_map = {
                "المدينة": "city", "الحي / المنطقة": "neighborhood", "عدد الغرف": "num_rooms",
                "عدد الحمامات": "num_bathrooms", "مفروشة؟": "furnished",
                "مساحة البناء": "area", "الطابق": "floor", "عمر البناء": "age",
                "هل العقار مرهون": "mortgaged", "طريقة الدفع": "payment", "المزايا": "extras"
            }
            if label in label_map:
                raw_info[label_map[label]] = value

    processed_apt = {
        'price': transform_price(apt['price_raw']),
        'city': raw_info['city'],
        'neighborhood': raw_info['neighborhood'],
        'num_rooms': transform_rooms_bathrooms(raw_info['num_rooms']),
        'num_bathrooms': transform_rooms_bathrooms(raw_info['num_bathrooms']),
        'furnished': transform_furnished(raw_info['furnished']),
        'area': re.search(r'\d+', raw_info['area'].translate(eastern_to_western_map)).group(0) if raw_info['area'] and re.search(r'\d+', raw_info['area'].translate(eastern_to_western_map)) else None,
        'floor': transform_floor(raw_info['floor']),
        'age': transform_age(raw_info['age']),
        'mortgaged': transform_mortgaged(raw_info['mortgaged']),
        'payment': transform_payment(raw_info['payment']),
        'elevator': 'T' if raw_info['extras'] and 'مصعد' in raw_info['extras'] else 'F',
        'parking': 'T' if raw_info['extras'] and 'موقف سيارات' in raw_info['extras'] else 'F'
    }
    full_data.append(processed_apt)

driver.quit()

if full_data:
    df = pd.DataFrame(full_data)
    final_columns = {
        'price': 'السعر بالشيكل', 'city': 'المدينة', 'neighborhood': 'الحي / المنطقة',
        'num_rooms': 'عدد الغرف', 'num_bathrooms': 'عدد الحمامات', 'furnished': 'مفروشة',
        'area': 'مساحة البناء', 'floor': 'الطابق', 'age': 'عمر البناء',
        'mortgaged': 'العقار مرهون', 'payment': 'طريقة الدفع', 'elevator': 'مصعد',
        'parking': 'موقف سيارات'
    }
    df = df[final_columns.keys()]
    df.rename(columns=final_columns, inplace=True)
    print(f"\nTotal scraped: {len(df)} items")
    df.to_csv("apartments_final.csv", index=False, encoding="utf-8-sig")
    print("Data saved to apartments_updated.csv")
else:
    print("No data was scraped.")
