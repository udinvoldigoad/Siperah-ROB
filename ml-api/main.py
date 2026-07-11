from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from model import model_instance

app = FastAPI(
    title="SIPERAH-RoB Machine Learning API",
    description="API for predicting coastal flood risks (Rob) using Machine Learning",
    version="1.0.0"
)

# Allow CORS so the React Frontend or Laravel Backend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    region_id: str
    target_days: int = 30

class PredictionResponse(BaseModel):
    region_id: str
    prediction_trend: List[int]
    status: str

@app.get("/")
def root():
    return {"message": "SIPERAH-RoB ML API is running. Access /docs for API documentation."}

@app.post("/api/v1/predict/30-days", response_model=PredictionResponse)
def get_30_day_prediction(request: PredictionRequest):
    """
    Returns a 30-day array of predicted high-risk villages.
    """
    try:
        if request.target_days != 30:
            raise HTTPException(status_code=400, detail="Only 30 days prediction is supported currently.")

        trend = model_instance.predict_30_days(request.region_id)
        
        return PredictionResponse(
            region_id=request.region_id,
            prediction_trend=trend,
            status="success"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
