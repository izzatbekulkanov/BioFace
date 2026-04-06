import json
import os
from typing import Dict, List, Any, Union

MENU_FILE = "menu.json"

def get_menu_data() -> Dict[str, Any]:
    """Reads menu structure from menu.json. Auto-migrates plain strings to dicts for multi-language."""
    if not os.path.exists(MENU_FILE):
        return {"menus": {}, "order": []}
    
    try:
        with open(MENU_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            
            menus = data.get("menus", {})
            for k, v in menus.items():
                if isinstance(v, str):
                    # Backward compatibility map
                    menus[k] = {"uz": v, "ru": v}
            
            data["menus"] = menus
            return data
    except Exception as e:
        print(f"Error reading {MENU_FILE}: {e}")
        return {"menus": {}, "order": []}

def save_menu_data(menus: Dict[str, Union[str, Dict[str, str]]], order: List[str] = None) -> bool:
    """Saves updated menus and order to menu.json."""
    data = get_menu_data()
    
    if menus is not None:
        for k, v in menus.items():
            if isinstance(v, dict):
                clean_v = {}
                for lang, text in v.items():
                    if text and text.strip():
                        clean_v[lang] = text.strip()
                if clean_v:
                    data["menus"][k] = clean_v
            elif isinstance(v, str) and v.strip():
                # Just in case API sends flat string
                data["menus"][k] = {"uz": v.strip(), "ru": v.strip()}
                
    if order is not None:
        data["order"] = order
        
    try:
        with open(MENU_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving {MENU_FILE}: {e}")
        return False
