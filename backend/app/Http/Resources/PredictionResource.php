<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PredictionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'prediction_date' => $this->prediction_date,
            'risk_probability' => $this->risk_probability,
            'risk_class' => $this->risk_class,
            'confidence_score' => $this->confidence_score,
            'max_tidal_height' => $this->max_tidal_height,
            'peak_time' => $this->peak_time ? substr($this->peak_time, 0, 5) : null,
            'model_version' => $this->model_version,
            'generated_at' => $this->generated_at,
            
            'region' => new RegionResource($this->whenLoaded('region')),
        ];
    }
}
