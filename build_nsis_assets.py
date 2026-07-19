from PIL import Image, ImageOps
import os

# Create setup dir
os.makedirs("src-tauri/setup", exist_ok=True)

# 1. Header Image (150x57)
# Let's use the logo and scale it to fit, centered on a white background
header = Image.new("RGB", (150, 57), "white")
try:
    logo = Image.open("public/logo.png").convert("RGBA")
    logo.thumbnail((150, 57))
    offset = ((150 - logo.width) // 2, (57 - logo.height) // 2)
    header.paste(logo, offset, mask=logo)
except Exception as e:
    print(f"Error loading logo for header: {e}")
header.save("src-tauri/setup/header.bmp")
print("Saved header.bmp")

# 2. Sidebar Image (164x314)
# Let's use the standing red panda ("searching") as the sidebar
sidebar = Image.new("RGB", (164, 314), (30, 41, 59)) # bg-slate-800 color for a cool background
try:
    panda = Image.open("public/pandas_png/standing.png").convert("RGBA")
    panda.thumbnail((160, 310))
    offset = ((164 - panda.width) // 2, (314 - panda.height) // 2)
    sidebar.paste(panda, offset, mask=panda)
except Exception as e:
    print(f"Error loading panda for sidebar: {e}")
sidebar.save("src-tauri/setup/sidebar.bmp")
print("Saved sidebar.bmp")
