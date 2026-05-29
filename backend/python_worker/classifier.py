def classify(boxes, image_size):

    elements = []

    w, h = image_size

    for i, b in enumerate(boxes):

        # SUPER SIMPLE RULES (safe start)
        if b["y"] > h*0.7:
            label = "input_box"
        else:
            label = "unknown"

        elements.append({
            "id": f"{label}_{i}",
            "label": label,
            **b
        })

    return elements