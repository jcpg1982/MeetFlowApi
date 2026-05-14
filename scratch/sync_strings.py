import os
import xml.etree.ElementTree as ET


def fix_strings():
    base_path = r"d:\Trabajos\Personal\Android\MeetFlow\core\design\src\commonMain\composeResources"
    default_file = os.path.join(base_path, "values", "strings.xml")

    # Parse default file to get all keys and values
    tree_default = ET.parse(default_file)
    root_default = tree_default.getroot()
    default_dict = {child.attrib['name']: child.text for child in root_default if
                    child.tag == 'string'}

    # Order of keys as in default file
    ordered_keys = [child.attrib['name'] for child in root_default if child.tag == 'string']

    for dir_name in os.listdir(base_path):
        if dir_name.startswith("values-"):
            lang_file = os.path.join(base_path, dir_name, "strings.xml")
            if not os.path.exists(lang_file): continue

            tree_lang = ET.parse(lang_file)
            root_lang = tree_lang.getroot()
            lang_dict = {child.attrib['name']: child.text for child in root_lang if
                         child.tag == 'string'}

            missing_keys = [k for k in ordered_keys if k not in lang_dict]

            if missing_keys:
                print(f"Fixing {dir_name}, missing {len(missing_keys)} keys")
                # Add missing keys to the end of the root
                for k in missing_keys:
                    new_string = ET.SubElement(root_lang, 'string', name=k)
                    new_string.text = default_dict[k]

                # To keep it pretty, we'll just save it. 
                # Note: This might mess up comments/regions, but ensures keys are there.
                tree_lang.write(lang_file, encoding='utf-8', xml_declaration=True)


fix_strings()
