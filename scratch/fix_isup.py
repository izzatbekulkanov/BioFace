import sys

with open("isup_sdk_server.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = lines[:1929] + ["            ])\n"] + lines[1995:]

with open("isup_sdk_server.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
