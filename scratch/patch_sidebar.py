import re

with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "r") as f:
    text = f.read()


# App title
text = text.replace("text-[0.94rem] font-bold", "text-[1.1rem] font-bold")
text = text.replace("text-[0.68rem] tracking-wider", "text-[0.75rem] tracking-wider")
text = text.replace("text-[0.68rem] font-bold tracking-wider", "text-[0.72rem] font-bold tracking-wider")
text = text.replace("h-9 w-9 items-center", "h-11 w-11 items-center")

# Group title
text = text.replace("text-xs font-semibold", "text-sm font-semibold")
text = text.replace("px-2.5 pt-3 pb-1", "px-3 pt-4 pb-2")

# Nav links
text = text.replace("min-h-[2rem] gap-2.5 rounded-[0.82rem] px-[0.6rem] py-[0.45rem] text-[0.76rem]", 
                    "min-h-[2.75rem] gap-3.5 rounded-xl px-3 py-3 text-[0.92rem]")
text = text.replace("w-[1.3rem]", "w-[1.8rem]")
text = text.replace("w-[0.86rem] h-[0.86rem]", "w-[1.15rem] h-[1.15rem] text-[1.15rem]")

# Profile Button
text = text.replace("w-9 h-9", "w-11 h-11")
text = text.replace("text-[0.8rem] font-bold tracking-tight", "text-[0.95rem] font-bold tracking-tight")
text = text.replace("text-[0.65rem] font-medium text-slate-500", "text-[0.75rem] font-medium text-slate-500")

# Dropdown links
text = text.replace("text-[0.8rem] font-medium text-slate-700", "text-[0.9rem] font-medium text-slate-700")
text = text.replace("text-[0.8rem] font-medium text-rose-600", "text-[0.9rem] font-medium text-rose-600")

# Write changes
with open("/Users/macbookpro/Documents/GitHub/BioFace/templates/components/sidebar.html", "w") as f:
    f.write(text)

