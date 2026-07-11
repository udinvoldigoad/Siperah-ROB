<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'report_code' => $this->report_code,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'severity' => $this->severity,
            'water_height_cm' => $this->water_height_cm,
            'incident_time' => $this->incident_time,
            'description' => $this->description,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'validated_at' => $this->validated_at,
            'created_at' => $this->created_at,
            
            // Relasi (diload jika dideklarasikan di query `with()`)
            'region' => new RegionResource($this->whenLoaded('region')),
            'reporter' => new UserResource($this->whenLoaded('reporter')),
            'validator' => new UserResource($this->whenLoaded('validator')),
            'photos' => $this->whenLoaded('photos', function() {
                return $this->photos->map(fn($photo) => [
                    'id' => $photo->id,
                    'url' => asset('storage/' . $photo->file_url),
                    'name' => $photo->file_name
                ]);
            }),
        ];
    }
}
