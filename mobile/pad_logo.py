from PIL import Image

def pad_image(path, out_path, padding_ratio=0.3):
    img = Image.open(path).convert("RGBA")
    
    # Calculate new size with a lot of padding to avoid Android adaptive icon circular cropping
    width, height = img.size
    max_dim = max(width, height)
    
    # The new dimension makes the original image take up only (1 - padding_ratio)
    new_dim = int(max_dim / (1.0 - padding_ratio))
    
    # Create new background (transparent or dark, since we use #000000 let's do transparent)
    bg = Image.new("RGBA", (new_dim, new_dim), (0, 0, 0, 0))
    
    # Paste original image in the center
    offset = ((new_dim - width) // 2, (new_dim - height) // 2)
    bg.paste(img, offset, img)
    
    bg.save(out_path)
    print(f"Padded image saved to {out_path}")

pad_image("assets/images/logo.png", "assets/images/logo_padded.png", 0.45)
