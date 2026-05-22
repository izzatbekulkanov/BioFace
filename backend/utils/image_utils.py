import io
from PIL import Image

def compress_to_webp(raw_bytes: bytes, max_side: int = 1080, quality: int = 80) -> bytes:
    """
    Opens an image from bytes, downscales it to fit within max_side (maintaining aspect ratio),
    and converts it to WebP format with the specified quality.
    
    Returns the compressed WebP image as bytes.
    """
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        
        # Check size and resize if necessary
        width, height = img.size
        if width > max_side or height > max_side:
            if width > height:
                new_width = max_side
                new_height = int(height * (max_side / width))
            else:
                new_height = max_side
                new_width = int(width * (max_side / height))
            
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Convert to RGB (required for saving as WebP/JPEG if it is RGBA/P/etc.)
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            # Keep alpha channel or convert to RGB
            pass
        elif img.mode != "RGB":
            img = img.convert("RGB")
            
        out_io = io.BytesIO()
        img.save(out_io, format="WEBP", quality=quality, method=4)
        return out_io.getvalue()
    except Exception as e:
        # Graceful fallback: return original bytes if processing fails
        return raw_bytes
