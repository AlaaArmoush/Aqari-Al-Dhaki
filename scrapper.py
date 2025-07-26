from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
import pandas as pd
import time
import re


def extract_price(price_text):
    m = re.search(r"([\d,]+)\s*شيكل", price_text)
    return int(m.group(1).replace(",", "")) if m else None

options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
driver = webdriver.Chrome(service = Service(), options=options)

base_list_url = "https://ps.opensooq.com/ar/عقارات/شقق-للبيع?page="
base_site = "https://ps.opensooq.com/"

pages_num = 1
apts_data = []
for page in range(1, pages_num + 1):
    print(f"Loading listing page {page}")
    driver.get(f"{base_list_url}{page}")
    time.sleep(3)
    soup = BeautifulSoup(driver.page_source, "html.parser")
    cards = soup.select("a.postListItemData")
    print(f"Found {len(cards)} cards on page {page}")
    card_id = 0
    for c in cards:
        apt = {
            "id" : card_id,
            "price": extract_price(c.select_one("div.priceColor").getText(strip=True)),
            "details_url": base_site + c["href"]
        }
        apts_data.append(apt)
        card_id += 1

full_data = []
for apt in apts_data:

    driver.get(apt["details_url"])
    print(f"scrapping {apt["details_url"]}...")
    time.sleep(3)
    details_soup = BeautifulSoup(driver.page_source, "html.parser")
    info_ul = details_soup.select_one("section#PostViewInformation ul.flex.flexSpaceBetween.flexWrap.mt-8")
    city = num_rooms = furnished = floor = facade = mortgaged = num_bathrooms = area = age = payment = extras = None
    
    if info_ul:
        for li in info_ul.select("li"): 
            label_el = li.select_one("p")
            if not label_el:
                continue
            label = label_el.get_text(strip=True)
            value_el = label_el.find_next_sibling(["a", "span"])
            if not value_el:
                continue
            value = value_el.get_text(strip=True)

            if label == "المدينة":
                city = value
            elif label == "عدد الغرف":
                num_rooms = value
            elif label == "مفروشة؟":
                furnished = value
            elif label == "الطابق":
                floor = value
            elif label == "الواجهة":
                facade = value
            elif label == "هل العقار مرهون":
                mortgaged = value
            elif label == "عدد الحمامات":
                num_bathrooms = value
            elif label == "مساحة البناء":
                area = value
            elif label == "عمر البناء":
                age = value
            elif label == "طريقة الدفع":
                payment = value
            elif label == "المزايا الاضافية":
                extras = value

    apt.update({
        "city": city,
        "num_rooms": num_rooms,
        "furnished": furnished,
        "floor": floor,
        "facade": facade,
        "mortgaged": mortgaged,
        "num_bathrooms": num_bathrooms,
        "area": area,
        "age": age,
        "payment": payment,
        "extras": extras
    })
    full_data.append(apt)

driver.quit()

df = pd.DataFrame(full_data)
print(f"Total scraped: {len(df)} items")
df.to_csv("apartments.csv", index = False, encoding = "utf-8-sig")
print("Data saved to apartments.csv")

            