import random
from typing import List

class TidePredictionModel:
    def __init__(self):
        # In a real scenario, this would load a trained ML model (e.g., .h5, .pkl, .joblib)
        # self.model = load_model('path_to_model/lstm_model.h5')
        self.is_loaded = True

    def predict_30_days(self, location_id: str) -> List[int]:
        """
        Simulates an ML inference function predicting the number of high-risk 
        villages for the next 30 days based on tidal patterns.
        
        Args:
            location_id (str): Identifier for the coastal region.
            
        Returns:
            List[int]: 30 integer values representing the predicted high-risk count.
        """
        if not self.is_loaded:
            raise Exception("Model not loaded")

        # Dummy algorithm simulating a tidal wave pattern (peaks in the 3rd week)
        # This mirrors the array [8, 12, 15, 20, 26, 34, 49, 45, 41, 34, 26, 20, 14, 8, 4, 3, 2, 3, 4, 7, 10, 12, 15, 11, 9, 6]
        # used in the React Frontend mock.
        base_pattern = [8, 12, 15, 20, 26, 34, 49, 45, 41, 34, 26, 20, 14, 8, 4, 3, 2, 3, 4, 7, 10, 12, 15, 11, 9, 6]
        
        # Add slight randomness to simulate real predictions
        predicted_trend = [
            max(0, val + random.randint(-2, 2)) for val in base_pattern
        ]
        
        # If the array is less than 30, pad it
        while len(predicted_trend) < 30:
            predicted_trend.append(max(0, predicted_trend[-1] + random.randint(-1, 1)))
            
        return predicted_trend[:30]

# Singleton instance
model_instance = TidePredictionModel()
