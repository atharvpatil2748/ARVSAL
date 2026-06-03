class ElementTracker:

    def __init__(self):
        self.memory = {}

    def track(self, label, bbox):

        if label in self.memory:
            prev = self.memory[label]

            # smoothing
            bbox["x"] = int((bbox["x"] + prev["x"]) / 2)
            bbox["y"] = int((bbox["y"] + prev["y"]) / 2)

        self.memory[label] = bbox

        return bbox