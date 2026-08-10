from decimal import Decimal

from app.comparison import compare_numeric


def test_lower_is_better():
    change, improvement, assessment = compare_numeric(
        Decimal("35"), Decimal("12"), "lower_is_better"
    )
    assert change == Decimal("-23")
    assert improvement.quantize(Decimal("0.1")) == Decimal("65.7")
    assert assessment == "better"


def test_higher_is_better():
    _, improvement, assessment = compare_numeric(Decimal("80"), Decimal("100"), "higher_is_better")
    assert improvement == Decimal("25.00")
    assert assessment == "better"


def test_missing_values_are_not_comparable():
    assert compare_numeric(None, Decimal("10"), "lower_is_better") == (
        None,
        None,
        "not_comparable",
    )
