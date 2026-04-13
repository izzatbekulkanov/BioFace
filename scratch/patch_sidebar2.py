import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "r") as f:
    text = f.read()

# Sidebar overall width
text = text.replace("w-[16.5rem]", "w-[18.5rem]")

# Bump links slightly more
text = text.replace("text-[0.92rem]", "text-[0.98rem]")
text = text.replace("min-h-[2.75rem]", "min-h-[3rem]")

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "w") as f:
    f.write(text)

