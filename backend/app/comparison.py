from decimal import Decimal


def compare_numeric(
    current: Decimal | None,
    proposed: Decimal | None,
    direction: str,
) -> tuple[Decimal | None, Decimal | None, str]:
    if current is None or proposed is None:
        return None, None, "not_comparable"

    change = proposed - current
    if current == proposed:
        return change, Decimal("0"), "unchanged"

    if current == 0:
        percentage = None
    elif direction == "higher_is_better":
        percentage = (proposed - current) / abs(current) * 100
    else:
        percentage = (current - proposed) / abs(current) * 100

    if direction == "neutral" or direction == "target_is_better":
        assessment = "not_comparable"
    elif direction == "higher_is_better":
        assessment = "better" if proposed > current else "worse"
    else:
        assessment = "better" if proposed < current else "worse"

    return change, percentage, assessment
