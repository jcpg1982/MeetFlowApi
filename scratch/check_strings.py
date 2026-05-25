import os
import xml.etree.ElementTree as ET


def get_string_keys(file_path):
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        return {child.attrib['name'] for child in root if child.tag == 'string'}
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return set()


base_path = r"d:\Trabajos\Personal\Android\MeetFlow\core\design\src\commonMain\composeResources"
default_file = os.path.join(base_path, "values", "strings.xml")
default_keys = get_string_keys(default_file)

print(f"Default keys count: {len(default_keys)}")

for dir_name in os.listdir(base_path):
    if dir_name.startswith("values-"):
        lang_file = os.path.join(base_path, dir_name, "strings.xml")
        lang_keys = get_string_keys(lang_file)
        missing = default_keys - lang_keys
        extra = lang_keys - default_keys
        if missing:
            print(f"Missing in {dir_name}: {sorted(list(missing))}")
        if extra:
            print(f"Extra in {dir_name}: {sorted(list(extra))}")
