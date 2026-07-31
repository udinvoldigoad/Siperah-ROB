"""Uji kontrak output prediksi (PredictionContract di main.py).

Menjaga agar prediksi yang ditulis ke tabel `predictions` selalu memenuhi
kontrak yang disepakati backend: risk_probability & confidence dalam 0..100
(skala persen), risk_class salah satu dari empat kelas resmi.
"""

import pytest
from pydantic import ValidationError

from main import PredictionContract


def _make(**overrides):
    base = {
        "risk_probability": 42.5,
        "risk_class": "sedang",
        "confidence_score": 80.0,
        "max_tidal_height": 1.2,
        "peak_time": "06:30",
    }
    base.update(overrides)
    return PredictionContract(**base)


def test_valid_contract_passes():
    c = _make()
    assert c.risk_probability == 42.5
    assert c.risk_class == "sedang"


@pytest.mark.parametrize("klass", ["rendah", "sedang", "tinggi", "sangat_tinggi"])
def test_all_official_risk_classes_accepted(klass):
    assert _make(risk_class=klass).risk_class == klass


def test_unknown_risk_class_rejected():
    with pytest.raises(ValidationError):
        _make(risk_class="bencana")


@pytest.mark.parametrize("prob", [-1.0, 100.1, 250.0])
def test_risk_probability_out_of_range_rejected(prob):
    with pytest.raises(ValidationError):
        _make(risk_probability=prob)


@pytest.mark.parametrize("conf", [-0.1, 100.5])
def test_confidence_score_out_of_range_rejected(conf):
    with pytest.raises(ValidationError):
        _make(confidence_score=conf)
