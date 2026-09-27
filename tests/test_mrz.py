from ocr.mrz import check_digit, parse_mrz_text, parse_td3

# Образец из ICAO 9303
ICAO_L1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
ICAO_L2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10"


def make_uzb_mrz(number="FA1234567", dob="900115", exp="330520", pinfl="31501901234567",
                 surname="TOSHMATOV", given="GAYRAT<ORIFJON<OGLI"):
    l1 = f"P<UZB{surname}<<{given}".ljust(44, "<")
    pers = pinfl.ljust(14, "<")
    body = (number + check_digit(number) + "UZB" + dob + check_digit(dob) + "M"
            + exp + check_digit(exp) + pers + check_digit(pers))
    composite = body[0:10] + body[13:20] + body[21:43]
    return l1, body + check_digit(composite)


def test_check_digit_icao_sample():
    assert check_digit("L898902C3") == "6"
    assert check_digit("740812") == "2"
    assert check_digit("120415") == "9"


def test_parse_icao_sample():
    r = parse_td3(ICAO_L1, ICAO_L2)
    assert r.surname == "ERIKSSON"
    assert r.given_names == "ANNA MARIA"
    assert r.passport_number.value == "L898902C3"
    assert r.date_of_birth.value == "1974-08-12"
    assert r.date_of_expiry.value == "2012-04-15"
    assert r.sex == "F"
    assert r.all_valid
    assert not r.warnings


def test_uzbek_passport():
    l1, l2 = make_uzb_mrz()
    r = parse_td3(l1, l2)
    assert r.all_valid, r.warnings
    assert r.nationality == "UZB"
    assert r.given_names == "GAYRAT ORIFJON OGLI"
    assert r.personal_number.value == "31501901234567"


def test_ocr_confusion_in_dates_is_repaired():
    l1, l2 = make_uzb_mrz()
    broken = l2[:13] + "9O0115" + l2[19:]  # 0 прочитан как O
    r = parse_td3(l1, broken)
    assert r.date_of_birth.valid
    assert r.date_of_birth.corrected
    assert r.date_of_birth.value == "1990-01-15"
    assert r.composite_valid


def test_wrong_digit_is_detected():
    l1, l2 = make_uzb_mrz()
    broken = l2[:2] + ("2" if l2[2] != "2" else "3") + l2[3:]  # ошибка в номере паспорта
    r = parse_td3(l1, broken)
    assert not r.passport_number.valid
    assert not r.all_valid
    assert any("номер паспорта" in w for w in r.warnings)


def test_noisy_ocr_text():
    l1, l2 = make_uzb_mrz()
    raw = f"some text\nREPUBLIC OF UZBEKISTAN\n{l1[:40]} «««\n{l2}\n"
    r = parse_mrz_text(raw)
    assert r is not None
    assert r.surname == "TOSHMATOV"
    assert r.all_valid


def test_empty_personal_number():
    l1, l2 = make_uzb_mrz(pinfl="")
    r = parse_td3(l1, l2)
    assert r.personal_number.value == ""
    assert r.all_valid


def test_digits_in_names_fixed():
    l1, l2 = make_uzb_mrz()
    r = parse_td3(l1.replace("TOSHMATOV", "TOSHMAT0V"), l2)
    assert r.surname == "TOSHMATOV"
