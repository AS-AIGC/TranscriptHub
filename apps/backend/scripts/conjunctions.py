from __future__ import annotations


def get_comma(lang: str | None) -> str:
    lang = (lang or "").lower()
    if lang in {"zh", "zh-cn", "zh-tw", "zh-hans", "zh-hant"}:
        return "，"
    if lang in {"ja"}:
        return "、"
    return ","


def get_conjunctions(lang: str | None) -> list[str]:
    lang = (lang or "").lower()

    if lang in {"zh", "zh-cn", "zh-tw", "zh-hans", "zh-hant"}:
        return [
            "但是",
            "而且",
            "並且",
            "然後",
            "所以",
            "因為",
            "如果",
            "以及",
            "或者",
            "不過",
        ]

    # Default: English-ish list
    return [
        "and",
        "but",
        "or",
        "so",
        "because",
        "then",
        "however",
        "therefore",
    ]

