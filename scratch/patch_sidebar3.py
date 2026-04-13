import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "r") as f:
    text = f.read()

# Scale elements slightly smaller
text = text.replace("min-h-[3rem]", "min-h-[2.85rem]")
text = text.replace("px-3 py-3 text-[0.98rem]", "px-3 py-[0.65rem] text-[0.92rem]")
text = text.replace("text-[1.1rem]", "text-[1.05rem]")
text = text.replace("text-[0.75rem]", "text-[0.7rem]")
text = text.replace("w-[1.8rem]", "w-[1.6rem]")
text = text.replace("w-[1.15rem] h-[1.15rem] text-[1.15rem]", "w-[1.05rem] h-[1.05rem] text-[1.05rem]")

# Group title
text = text.replace("text-sm font-semibold", "text-[0.8rem] font-semibold")
text = text.replace("px-3 pt-4 pb-2", "px-3 pt-3 pb-1.5")

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "w") as f:
    f.write(text)

