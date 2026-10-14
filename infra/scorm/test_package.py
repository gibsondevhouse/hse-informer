import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

from build import build


class SyntheticScormPackageTest(unittest.TestCase):
    def test_manifest_and_launch_file_are_packaged(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "fixture.zip"
            build(archive)
            with ZipFile(archive) as package:
                self.assertEqual(package.testzip(), None)
                self.assertEqual(set(package.namelist()), {"imsmanifest.xml", "index.html"})
                root = ElementTree.fromstring(package.read("imsmanifest.xml"))
                ns = {"imscp": "http://www.imsproject.org/xsd/imscp_rootv1p1p2"}
                self.assertEqual(root.findtext("imscp:metadata/imscp:schemaversion", namespaces=ns), "1.2")
                self.assertEqual(root.find("imscp:resources/imscp:resource", ns).attrib["href"], "index.html")
                self.assertIn(b"cmi.core.lesson_status", package.read("index.html"))


if __name__ == "__main__":
    unittest.main()
