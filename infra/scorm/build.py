#!/usr/bin/env python3
"""Build a deterministic, clearly synthetic SCORM 1.2 test package."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import argparse


SOURCE = Path(__file__).resolve().parent
FILES = ("imsmanifest.xml", "index.html")


def build(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as package:
        for filename in FILES:
            entry = ZipInfo(filename, date_time=(2026, 10, 11, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            package.writestr(entry, (SOURCE / filename).read_bytes())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=SOURCE / "synthetic-scorm-1.2.zip")
    build(parser.parse_args().output)
