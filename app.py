import os
import joblib
import logging
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, conint, confloat

MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "model_v2.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_columns.pkl")
CITIES_PATH = os.path.join(MODEL_DIR, "city_categories.pkl")

logger = logging.getLogger("uvicorn.error")

try:
    final_model = joblib.load(MODEL_PATH)
    feature_columns = joblib.load(FEATURES_PATH)
    city_categories = joblib.load(CITIES_PATH)
except Exception as e:
    logger.exception("Failed to load model or metadata")
    raise RuntimeError(f"Failed to load model or metadata: {e}")

TRAIN_KEYS = {
    "عدد_الغرف": "عدد الغرف",
    "عدد_الحمامات": "عدد الحمامات",
    "مفروشة": "مفروشة",
    "مساحة_البناء": "مساحة البناء",
    "الطابق": "الطابق",
    "عمر_البناء": "عمر البناء",
    "العقار_مرهون": "العقار مرهون",
    "طريقة_الدفع": "طريقة الدفع",
}

CITY_PREFIX = "المدينة_"

app = FastAPI(title="Aqariy Smart – Price Prediction")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


class PredictIn(BaseModel):
    عدد_الغرف: conint(ge=1) = Field(..., description="عدد الغرف (>=1)")
    عدد_الحمامات: conint(ge=1) = Field(..., description="عدد الحمامات (>=1)")
    مفروشة: conint(ge=0, le=1) = Field(..., description="0/1")
    مساحة_البناء: confloat(gt=0) = Field(..., description="مساحة البناء بالمتر المربع")
    الطابق: int = Field(..., description="رقم الطابق (0=ground)")
    عمر_البناء: conint(ge=0) = Field(..., description="عمر البناء (سنوات)")
    العقار_مرهون: conint(ge=0, le=1) = Field(..., description="0/1")
    طريقة_الدفع: int = Field(..., description="0=cash,1=mortgage,2=installments etc.")
    موقف_سيارات: Optional[conint(ge=0, le=1)] = 0
    المدينة: str = Field(..., description="اسم المدينة (Arabic)")


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
    else:
        return 5


def build_model_input(payload: PredictIn) -> pd.DataFrame:
    base = {
        TRAIN_KEYS["عدد_الغرف"]: int(payload.عدد_الغرف),
        TRAIN_KEYS["عدد_الحمامات"]: int(payload.عدد_الحمامات),
        TRAIN_KEYS["مفروشة"]: int(payload.مفروشة),
        TRAIN_KEYS["مساحة_البناء"]: float(payload.مساحة_البناء),
        TRAIN_KEYS["الطابق"]: int(payload.الطابق),
        TRAIN_KEYS["عمر_البناء"]: map_building_age(int(payload.عمر_البناء)),
        TRAIN_KEYS["العقار_مرهون"]: int(payload.العقار_مرهون),
        TRAIN_KEYS["طريقة_الدفع"]: int(payload.طريقة_الدفع),
    }

    city_cols = {f"{CITY_PREFIX}{c}": 0 for c in city_categories}

    if payload.المدينة in city_categories:
        city_cols[f"{CITY_PREFIX}{payload.المدينة}"] = 1
    else:
        other_col = f"{CITY_PREFIX}أخرى"
        if other_col in city_cols:
            city_cols[other_col] = 1

    row = {**base, **city_cols}
    df = pd.DataFrame([row])
    df = df.reindex(columns=feature_columns, fill_value=0)
    return df

import shap

explainer = shap.TreeExplainer(final_model)

FEATURE_GROUPS = {
    "المساحة و الغرف": ["مساحة البناء", "عدد الغرف"],
    "الحمامات": ["عدد الحمامات"],
    "حالة العقار": ["مفروشة", "عمر البناء", "العقار مرهون"],
    "الدفع": ["طريقة الدفع"],
    "الطابق": ["الطابق"],
    "المدينة": [col for col in feature_columns if col.startswith(CITY_PREFIX)],
}

def group_shap_values(shap_values: np.ndarray, input_df: pd.DataFrame):
    feature_shap = dict(zip(input_df.columns, shap_values))
    grouped = {}

    for group_name, features in FEATURE_GROUPS.items():
        if group_name == "المدينة":
            # sum only the active city column (value=1 in input_df)
            active_cities = [f for f in features if input_df.iloc[0][f] == 1]
            grouped[group_name] = sum(feature_shap.get(f, 0) for f in active_cities)
        else:
            grouped[group_name] = sum(feature_shap.get(f, 0) for f in features)

    total_abs = sum(abs(v) for v in grouped.values()) or 1e-9
    ranked = {k: round((v / total_abs) * 100, 2) for k, v in grouped.items()}

    # sort by absolute value descending
    ranked = dict(sorted(ranked.items(), key=lambda x: abs(x[1]), reverse=True))

    # keep only top 4
    top_ranked = dict(list(ranked.items())[:4])
    return top_ranked


@app.post("/predict")
def predict(payload: PredictIn):
    try:
        df_input = build_model_input(payload)
        y_pred = final_model.predict(df_input)[0]

        if payload.موقف_سيارات:
            y_pred *= 1.011

        shap_values = explainer(df_input)
        contribs = shap_values.values[0]

        grouped = group_shap_values(contribs, df_input)
        # ensure all values are native floats
        grouped = {k: float(round(v, 2)) for k, v in grouped.items()}

        return {
            "predicted_price": float(np.round(y_pred, 2)),
            "factors": grouped,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/metadata")
def metadata():
    return JSONResponse({
        "feature_columns_count": len(feature_columns),
        "feature_columns": feature_columns,
        "city_categories": city_categories
    })


@app.get("/")
def root():
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Aqariy Smart API is up. Frontend index.html not found."}



class JudgeIn(PredictIn):
    listed_price: confloat(gt=0) = Field(..., description="السعر المعروض من المستخدم")
@app.post("/judge_price")
def judge_price(payload: JudgeIn):
    try:
        variants = []
        # loop over all combinations to get the market range
        for rooms in range(1, 5):
            for baths in range(1, 4):
                for age in [0, 5, 9, 19, 20]:
                    for floor in [0, 1, 2, 3, 4, 11]:
                        for furnished in [0, 1]:
                            for payment in [0, 1, 2]:
                                for mortgaged in [0, 1]:
                                    variant = payload.model_copy(deep=True)
                                    variant.عدد_الغرف = rooms
                                    variant.عدد_الحمامات = baths
                                    variant.عمر_البناء = age
                                    variant.الطابق = floor
                                    variant.مفروشة = furnished
                                    variant.طريقة_الدفع = payment
                                    variant.العقار_مرهون = mortgaged
                                    variants.append(build_model_input(variant))

        all_df = pd.concat(variants, ignore_index=True)
        predicted_prices = final_model.predict(all_df).astype(float)

        price_min = float(np.min(predicted_prices))
        price_max = float(np.max(predicted_prices))
        price_mean = float(np.mean(predicted_prices))
        price_median = float(np.median(predicted_prices))
        price_q1 = float(np.percentile(predicted_prices, 25))
        price_q3 = float(np.percentile(predicted_prices, 75))

        hist_counts, hist_edges = np.histogram(predicted_prices, bins=10)
        hist_counts = hist_counts.tolist()
        hist_edges = hist_edges.tolist()

        listed = float(payload.listed_price)

        df_input = build_model_input(payload)
        predicted_price = float(final_model.predict(df_input)[0])

        if payload.موقف_سيارات:
            predicted_price *= 1.011

        if listed < max(price_min * 0.9, price_mean * 0.7):
            judgment_key = "SUSPICIOUSLY_UNDERPRICED"
        elif listed < price_mean * 0.85:
            judgment_key = "FAIR_LOW"
        elif predicted_price * 0.95 <= listed <= predicted_price * 1.05:
            judgment_key = "PREDICTED_PRICE"
        elif listed < price_mean * 0.95:
            judgment_key = "GOOD_DEAL"
        elif listed < predicted_price:
            judgment_key = "PREDICTED_PRICE"
        elif listed <= price_max:
            judgment_key = "FAIR_PRICE"
        else:
            judgment_key = "OVERPRICED"

        def r(x): 
            try:
                return float(round(x, 2))
            except Exception:
                return x

        return {
            "judgment_key": judgment_key,
            "listed_price": r(listed),
            "predicted_price": r(predicted_price),         
            "market_mean": r(price_mean),
            "market_median": r(price_median),
            "price_q1": r(price_q1),
            "price_q3": r(price_q3),
            "price_range": [r(price_min), r(price_max)],
            "hist": {
                "counts": hist_counts,   
                "edges": hist_edges      
            }
        }

    except Exception as e:
        logger.exception(f"Error in /judge_price: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)
