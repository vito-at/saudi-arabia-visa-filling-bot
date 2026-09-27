from ocr.models import FieldStatus
from ocr.mrz import parse_td3
from ocr.pipeline import merge
from tests.test_mrz import make_uzb_mrz


def vision_for(**overrides):
    base = {
        "is_passport": True, "issuing_country": "UZB", "surname": "TOSHMATOV",
        "given_names": "G'AYRAT ORIFJON O'G'LI", "passport_number": "FA1234567",
        "nationality": "UZB", "date_of_birth": "15.01.1990", "sex": "M",
        "place_of_birth": "TOSHKENT SHAHRI", "date_of_issue": "2023-05-21",
        "date_of_expiry": "2033-05-20", "issuing_authority": "IIV 12345",
        "personal_number": "31501901234567", "mrz_line1": "", "mrz_line2": "",
        "quality_issues": "",
    }
    base.update(overrides)
    return base


def test_all_sources_agree():
    mrz = parse_td3(*make_uzb_mrz())
    data = merge(mrz, vision_for())
    assert data.fields["surname"].status == FieldStatus.OK
    assert data.fields["given_names"].value == "GAYRAT ORIFJON OGLI"
    assert data.fields["given_names"].status == FieldStatus.OK
    assert data.fields["date_of_birth"].status == FieldStatus.OK
    assert data.fields["place_of_birth"].value == "TOSHKENT SHAHRI"
    assert data.fields["place_of_birth"].status == FieldStatus.VISION_ONLY
    assert data.fields_to_review == []


def test_mismatch_marked_for_review():
    mrz = parse_td3(*make_uzb_mrz())
    data = merge(mrz, vision_for(passport_number="FA1234568", date_of_birth="1990-01-16"))
    assert data.fields["passport_number"].status == FieldStatus.REVIEW
    assert data.fields["passport_number"].value == "FA1234567"  # MRZ остаётся главным
    assert data.fields["passport_number"].alternative == "FA1234568"
    assert data.fields["date_of_birth"].status == FieldStatus.REVIEW


def test_no_mrz_everything_review():
    data = merge(None, vision_for())
    assert data.fields["surname"].status == FieldStatus.REVIEW
    assert data.fields["date_of_birth"].value == "1990-01-15"
    assert "passport_number" in data.fields_to_review
