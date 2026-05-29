def build_element(id, label, x, y, w, h, confidence=0.5):
    return {
        "id": id,
        "label": label,
        "bbox": {
            "x": int(x),
            "y": int(y),
            "w": int(w),
            "h": int(h)
        },
        "center": {
            "x": int(x + w/2),
            "y": int(y + h/2)
        },
        "confidence": float(confidence)
    }


def build_response(elements):
    return {
        "success": True,
        "elements": elements
    }