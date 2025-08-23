import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "final_model.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_columns.pkl")
CITIES_PATH = os.path.join(MODEL_DIR, "city_categories.pkl")

final_model = joblib.load(MODEL_PATH)
feature_columns = joblib.load(FEATURES_PATH)        
city_categories = joblib.load(CITIES_PATH)         

TRAIN_KEYS = {
    "عدد_الغرف": "عدد الغرف",
    "عدد_الحمامات": "عدد الحمامات",
    "مفروشة": "مفروشة",
    "مساحة_البناء": "مساحة البناء",
    "الطابق": "الطابق",
    "عمر_البناء": "عمر البناء",
    "العقار_مرهون": "العقار مرهون",
    "طريقة_الدفع": "طريقة الدفع",
    "مصعد": "مصعد",
}

CITY_PREFIX = "المدينة_"

# ---------- FastAPI ----------
app = FastAPI(title="Aqariy Smart – Price Prediction")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Serve your static frontend at the root
app.mount("/static", StaticFiles(directory="static"), name="static")


class PredictIn(BaseModel):
    عدد_الغرف: int
    عدد_الحمامات: int
    مفروشة: int                   
    مساحة_البناء: float
    الطابق: int
    عمر_البناء: int
    العقار_مرهون: int             
    طريقة_الدفع: int              
    مصعد: int                    
    موقف_سيارات: int | None = 0  
    المدينة: str              

def map_building_age(age: int) -> int:
    if age == 0:
        return 0
    elif age == 1:
        return 1
    elif 2 <= age <= 5:
        return 2
    elif 6 <= age <= 9:
        return 3
    elif 10 <= age <= 19:
        return 4
    else:  # 20+
        return 5

def build_model_input(payload: PredictIn) -> pd.DataFrame:
    base = {
        TRAIN_KEYS["عدد_الغرف"]: payload.عدد_الغرف,
        TRAIN_KEYS["عدد_الحمامات"]: payload.عدد_الحمامات,
        TRAIN_KEYS["مفروشة"]: int(payload.مفروشة),
        TRAIN_KEYS["مساحة_البناء"]: float(payload.مساحة_البناء),
        TRAIN_KEYS["الطابق"]: int(payload.الطابق),
        TRAIN_KEYS["عمر_البناء"]: map_building_age(int(payload.عمر_البناء)),  # <-- map to bin
        TRAIN_KEYS["العقار_مرهون"]: int(payload.العقار_مرهون),
        TRAIN_KEYS["طريقة_الدفع"]: int(payload.طريقة_الدفع),
        TRAIN_KEYS["مصعد"]: int(payload.مصعد),
    }

    city_cols = {f"{CITY_PREFIX}{c}": 0 for c in city_categories}
    if payload.المدينة in city_categories:
        city_cols[f"{CITY_PREFIX}{payload.المدينة}"] = 1

    row = {**base, **city_cols}
    df = pd.DataFrame([row])
    df = df.reindex(columns=feature_columns, fill_value=0)
    return df

@app.post("/predict")
def predict(payload: PredictIn):
    try:
        df_input = build_model_input(payload)
        y_pred = final_model.predict(df_input)[0]
        if payload.موقف_سيارات:
            y_pred *= 1.011 
        return {"predicted_price": float(np.round(y_pred, 2))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    

from fastapi.responses import FileResponse

@app.get("/")
def root():
    return FileResponse("static/index.html")