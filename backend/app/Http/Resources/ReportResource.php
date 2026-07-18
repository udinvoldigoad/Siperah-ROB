<?php

namespace App\Http\Resources;

use App\Services\RegionMonitoringService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

class ReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $slaDueAt = $this->created_at?->copy()->addDay();
        $isResolved = in_array($this->status, ['divalidasi', 'ditolak', 'duplikat'], true);
        $slaStatus = $isResolved
            ? 'selesai'
            : ($slaDueAt && now()->greaterThan($slaDueAt) ? 'terlambat' : 'berjalan');
        $this->resource->loadMissing('region');
        $isWithinMonitoringArea = app(RegionMonitoringService::class)->isPointMonitored(
            $this->region,
            (float) $this->latitude,
            (float) $this->longitude,
        );

        return [
            'id' => $this->id,
            'report_code' => $this->report_code,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'severity' => $this->severity,
            'water_height_cm' => $this->water_height_cm,
            'incident_time' => $this->incident_time?->toIso8601String(),
            'description' => $this->description,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'validated_at' => $this->validated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'sla_due_at' => $slaDueAt?->toIso8601String(),
            'sla_status' => $slaStatus,
            'is_within_monitoring_area' => $isWithinMonitoringArea,
            
            // Relasi (diload jika dideklarasikan di query `with()`)
            'region' => new RegionResource($this->whenLoaded('region')),
            'reporter' => new UserResource($this->whenLoaded('reporter')),
            'validator' => new UserResource($this->whenLoaded('validator')),
            'photos' => $this->whenLoaded('photos', function() {
                // Foto laporan tervalidasi = URL publik (bisa di-cache & tampil di
                // peta publik). Foto laporan belum divalidasi = signed URL sementara
                // (12 jam) agar hanya pihak berwenang yang menerima payload ini bisa
                // membukanya lewat <img>, tanpa perlu header auth.
                $isPublic = $this->status === 'divalidasi';

                return $this->photos->map(fn($photo) => [
                    'id' => $photo->id,
                    'url' => $isPublic
                        ? '/api/reports/photo/' . $photo->id
                        : URL::temporarySignedRoute('reports.photo', now()->addHours(12), ['photo' => $photo->id], false),
                    'name' => $photo->file_name
                ]);
            }),
        ];
    }
}
