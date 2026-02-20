let busyState = {
  active: false,
  type: null,
  freeAt: null,
  timer: null
};

function enableBusy(type, freeAt, onExpire) {

  busyState.active = true;
  busyState.type = type;
  busyState.freeAt = freeAt;

  const duration = new Date(freeAt).getTime() - Date.now();

  if (busyState.timer) clearTimeout(busyState.timer);

  busyState.timer = setTimeout(() => {
    disableBusy();
    if (onExpire) onExpire();
  }, duration);
}

function disableBusy() {
  busyState.active = false;
  busyState.type = null;
  busyState.freeAt = null;

  if (busyState.timer) {
    clearTimeout(busyState.timer);
    busyState.timer = null;
  }
}

function isBusy() {
  return busyState.active;
}

function getBusyState() {
  return busyState;
}

module.exports = {
  enableBusy,
  disableBusy,
  isBusy,
  getBusyState
};