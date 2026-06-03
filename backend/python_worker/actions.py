import pyautogui
import time

pyautogui.FAILSAFE = False

def click_bbox(bbox):
    x = bbox["x"] + bbox["width"] // 2
    y = bbox["y"] + bbox["height"] // 2

    pyautogui.moveTo(x, y, duration=0.12)
    pyautogui.click()

    return {"success": True}


def click_point(x, y):
    pyautogui.moveTo(x, y, duration=0.12)
    pyautogui.click()
    return {"success": True}


def type_text(text):
    pyautogui.typewrite(text, interval=0.018)
    return {"success": True}


def press_key(key):
    pyautogui.press(key)
    return {"success": True}


def scroll(direction="down", amount=400):
    if direction == "down":
        pyautogui.scroll(-abs(amount))
    else:
        pyautogui.scroll(abs(amount))

    return {"success": True}