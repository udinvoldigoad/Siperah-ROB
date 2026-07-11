<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'province' => $this->province,
            'regency' => $this->regency,
            'district' => $this->district,
            'village' => $this->village,
            'population' => $this->population,
            'coastal_flag' => (bool) $this->coastal_flag,
            // Skip large geometry string for list views unless requested or specific to map
        ];
    }
}
