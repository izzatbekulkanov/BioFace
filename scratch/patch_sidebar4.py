import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "r") as f:
    text = f.read()

# Scale elements to the sweet spot between version 2 and 3
text = text.replace("min-h-[2.85rem]", "min-h-[2.95rem]")
text = text.replace("px-3 py-[0.65rem] text-[0.92rem]", "px-3 py-[0.7rem] text-[0.95rem]")
text = text.replace("w-[1.6rem]", "w-[1.7rem]")
text = text.replace("w-[1.05rem] h-[1.05rem] text-[1.05rem]", "w-[1.1rem] h-[1.1rem] text-[1.1rem]")

# Group title
text = text.replace("text-[0.8rem] font-semibold", "text-[0.85rem] font-semibold")
text = text.replace("px-3 pt-3 pb-1.5", "px-3 pt-3.5 pb-2")

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "w") as f:
    f.write(text)

